import { ethers } from "ethers";
import { ExecutionScheduleInput } from "../models/executionScheduleInput";
import { LostBetsResponse, validateLostBetsResponse } from "../models/lostBetsResponse";
import * as aws from "../utils/aws";

async function retrieveLostBetsForNetwork(network: string, uuid: string) {
    const url = `https://api.${network}.idao.finance/api/v1/not_closed_prices/${uuid}`;

    const response = await fetch(url);

    if (response.status !== 200) {
        console.error('Error retrieving lost bets for network', network, ', status:', response.status, response.statusText, 'response:', await response.text());
        return { lostBets: [], success: false };
    }

    const responseBody = await response.json();

    const { parsedBody: lostBets, error } = validateLostBetsResponse(responseBody);

    if (!lostBets) {
        console.error(`Error parsing lost bets: ${error}`);
        return { lostBets: [], success: false };
    }

    return { lostBets, success: true };
}

async function scheduleLostBets(network: string, lostBets: LostBetsResponse) {
    for (const lostBet of lostBets) {
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

async function checkIfBetsAreFilled(network: string, betIds: LostBetsResponse): Promise<number[]> {
    if (betIds.length === 0) {
        return [];
    }

    let chainId: number;
    let contractAddress: string;
    switch (network) {
        case "sepolia":
            chainId = 11155111;
            contractAddress = "0x5E945200e9eFF3d4414a4466B5008643dceC7073";
            break;
        case "polygon":
            chainId = 137;
            contractAddress = "0x1Ad528c5d7906543E369a605f6EF0Be503aBff76";
            break;
        default:
            throw new Error("Invalid network");
    }

    // Create a provider and wallet
    const provider = new ethers.AlchemyProvider(
        chainId,
        await aws.getAlchemyRpcKey()
    );

    const abi = [
        "function fillPrice(uint256 betId) external",
        "function betInfo(uint256 _betId) external view returns (address bidder, uint256 poolId, uint256 bidPrice, uint256 resultPrice, uint256 bidStartTimestamp, uint256 bidEndTimestamp, uint256 bidSettleTimestamp, uint256 priceAtBid)",
        "function isBetCancelled(uint256 _betId) external view returns (bool)"
    ];
    const contract = new ethers.Contract(contractAddress, abi, provider);

    const result: number[] = [];
    for (const betId of betIds) {
        const betInfo = await contract.betInfo(BigInt(betId.id));
        if (betInfo.resultPrice == 0n && !(await contract.isBetCancelled(BigInt(betId.id)))) {
            result.push(betId.id);
        }
    }

    return result;
}

export async function cronBetChecker() {
    const uuid = await aws.getLostBetsBackendUuid();

    const lostBets = {
        polygonLostBets: await retrieveLostBetsForNetwork("polygon", uuid),
        sepoliaLostBets: await retrieveLostBetsForNetwork("sepolia", uuid),
    }

    // check if these bets are already filled
    const notFilledBetsPolygon = await checkIfBetsAreFilled("polygon", lostBets.polygonLostBets.lostBets);
    const notFillBetsSepolia = await checkIfBetsAreFilled("sepolia", lostBets.sepoliaLostBets.lostBets);

    const filteredBetsPresent = notFilledBetsPolygon.length != lostBets.polygonLostBets.lostBets.length
        || notFillBetsSepolia.length != lostBets.sepoliaLostBets.lostBets.length;

    const lostBetsFiltered = {
        polygonLostBets: lostBets.polygonLostBets.lostBets.filter(bet => notFilledBetsPolygon.includes(bet.id)),
        sepoliaLostBets: lostBets.sepoliaLostBets.lostBets.filter(bet => notFillBetsSepolia.includes(bet.id)),
    };

    if (lostBetsFiltered.polygonLostBets.length === 0 && lostBetsFiltered.sepoliaLostBets.length === 0) {
        console.log(`No lost bets found ${filteredBetsPresent ? "(some bets were filtered)" : ""}`);
    }
    else {
        console.log(`Lost bets found ${filteredBetsPresent ? "(some bets were filtered)" : ""}:`, {
            polygonLostBets: lostBetsFiltered.polygonLostBets.map(bet => bet.id),
            sepoliaLostBets: lostBetsFiltered.sepoliaLostBets.map(bet => bet.id),
        });

        await scheduleLostBets("MATIC_MAINNET", lostBetsFiltered.polygonLostBets);
        await scheduleLostBets("ETH_SEPOLIA", lostBetsFiltered.sepoliaLostBets);
    }

    if (!lostBets.polygonLostBets.success || !lostBets.sepoliaLostBets.success) {
        throw new Error("Error retrieving lost bets");
    }
}