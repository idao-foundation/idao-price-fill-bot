import { ethers } from "ethers";
import { ExecutionScheduleInput } from "../src/models/executionScheduleInput";
import { scheduleExecution } from "../src/utils/aws";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
    const betIds: number[] = [];
    const network = "MATIC_MAINNET";

    const provider = new ethers.AlchemyProvider(137n, process.env.ALCHEMY_RPC_KEY);
    const contractAddress = "0x1Ad528c5d7906543E369a605f6EF0Be503aBff76";
    const abi = [
        "function betInfo(uint256 _betId) external view returns (address bidder, uint256 poolId, uint256 bidPrice, uint256 resultPrice, uint256 bidStartTimestamp, uint256 bidEndTimestamp, uint256 bidSettleTimestamp, uint256 priceAtBid)",
    ];
    const contract = new ethers.Contract(contractAddress, abi, provider);

    for (const betId of betIds) {
        const info = await contract.betInfo(betId);
        const bidEndTimestamp = Number(info.bidEndTimestamp);

        const scheduleExecutionAt = new Date(bidEndTimestamp * 1000);
        const input: ExecutionScheduleInput = { betId, network, isLostBet: true };
        const scheduleId = `fill-price-${betId}-${network}`;

        // Schedule the execution
        await scheduleExecution(
            scheduleId,
            input,
            process.env.PRICE_FILL_QUEUE_ARN as string,
            process.env.SCHEDULE_PRICE_FILL_ROLE_ARN as string,
            scheduleExecutionAt,
            network
        )
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});