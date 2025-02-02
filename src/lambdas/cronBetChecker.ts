import { ExecutionScheduleInput } from "../models/executionScheduleInput";
import { validateLostBetsResponse } from "../models/lostBetsResponse";
import * as aws from "../utils/aws";

async function retrieveLostBets() {
    const uuid = await aws.getLostBetsBackendUuid();

    const urlPolygon = `https://api.polygon.idao.finance/api/v1/not_closed_prices/${uuid}`;
    const urlSepolia = `https://api.sepolia.idao.finance/api/v1/not_closed_prices/${uuid}`;

    const responsePolygon = await fetch(urlPolygon);
    const responseSepolia = await fetch(urlSepolia);

    const responseBodyPolygon = await responsePolygon.json();
    const responseBodySepolia = await responseSepolia.json();

    const { parsedBody: polygonLostBets, error: errorPolygon } = validateLostBetsResponse(responseBodyPolygon);
    const { parsedBody: sepoliaLostBets, error: errorSepolia } = validateLostBetsResponse(responseBodySepolia);

    if (!polygonLostBets || !sepoliaLostBets) {
        console.error(`Error parsing lost bets: ${errorPolygon || errorSepolia}`);
        return {
            polygonLostBets: [],
            sepoliaLostBets: [],
        }
    }

    return {
        polygonLostBets,
        sepoliaLostBets,
    }
}

export async function cronBetChecker(event: any) {
    const lostBets = await retrieveLostBets();
    if (lostBets.polygonLostBets.length === 0 && lostBets.sepoliaLostBets.length === 0) {
        console.log("No lost bets found");
        return;
    }

    console.log("Lost bets found:", {
        polygonLostBets: lostBets.polygonLostBets.map(bet => bet.id),
        sepoliaLostBets: lostBets.sepoliaLostBets.map(bet => bet.id),
    });

    for (const lostBet of lostBets.polygonLostBets) {
        const network = "MATIC_MAINNET";
        const scheduleId = `fill-price-${lostBet.id}-${network}`;
        const input: ExecutionScheduleInput = {
            betId: lostBet.id,
            network,
            isLostBet: true,
        }
        const scheduleExecutionAt = new Date(lostBet.bid_end_timestamp * 1000);

        await aws.scheduleExecution(
            scheduleId,
            input,
            process.env.PRICE_FILL_QUEUE_ARN as string,
            process.env.SCHEDULE_PRICE_FILL_ROLE_ARN as string,
            scheduleExecutionAt,
            network
        )
    }

    for (const lostBet of lostBets.sepoliaLostBets) {
        const network = "ETH_SEPOLIA";
        const scheduleId = `fill-price-${lostBet.id}-${network}`;
        const input: ExecutionScheduleInput = {
            betId: lostBet.id,
            network,
            isLostBet: true,
        }
        const scheduleExecutionAt = new Date(lostBet.bid_end_timestamp * 1000);

        await aws.scheduleExecution(
            scheduleId,
            input,
            process.env.PRICE_FILL_QUEUE_ARN as string,
            process.env.SCHEDULE_PRICE_FILL_ROLE_ARN as string,
            scheduleExecutionAt,
            network
        )
    }
}