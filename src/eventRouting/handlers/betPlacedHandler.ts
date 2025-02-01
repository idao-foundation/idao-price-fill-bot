import { AlchemyLog } from "../../models/alchemyWebhook";
import { ethers } from "ethers";
import { ExecutionScheduleInput } from "../../models/executionScheduleInput";
import * as aws from "../../utils/aws";

export async function handleBetPlaced(event: AlchemyLog, network: string): Promise<void> {
    // Bet ID is the second topic (first indexed parameter) in the event
    const betId = ethers.getNumber(event.topics[1]);

    // Bid end timestamp (the time when fillPrice must be called) is the fourth parameter in the event data
    const bidEndTimestamp = ethers.AbiCoder.defaultAbiCoder().decode(
        ["uint256", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256"],
        event.data
    )[3] as bigint

    const scheduleExecutionAt = new Date(Number(bidEndTimestamp) * 1000);
    const input: ExecutionScheduleInput = {
        betId,
        network
    };
    const scheduleId = `fill-price-${betId}-${network}`;

    await aws.scheduleExecution(
        scheduleId,
        input,
        process.env.PRICE_FILL_QUEUE_ARN as string,
        process.env.SCHEDULE_PRICE_FILL_ROLE_ARN as string,
        scheduleExecutionAt,
        network
    );
}