import { AlchemyLog } from "../../models/alchemyWebhook";
import { ethers } from "ethers";
import { ExecutionScheduleInput } from "../../models/executionScheduleInput";
import * as aws from "../../utils/aws";

export async function handleBetPlaced(event: AlchemyLog, network: string): Promise<void> {
    // Bet ID is the second topic (first indexed parameter) in the event
    const betId = ethers.getNumber(event.topics[1]);

    // Bid end timestamp (the time when fillPrice must be called) is the fourth parameter in the event data
    let bidEndTimestamp: bigint;
    if (event.data.length == (64 * 7) + 2) {
        bidEndTimestamp = ethers.AbiCoder.defaultAbiCoder().decode(
            ["uint256", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256"],
            event.data
        )[3] as bigint
    }
    else {
        bidEndTimestamp = ethers.AbiCoder.defaultAbiCoder().decode(
            ["uint256", "uint256", "uint256", "uint256", "uint256", "uint256"],
            event.data
        )[3] as bigint;
    }

    let chainId: number;
    let contractAddress: string;
    switch (network) {
        case "ETH_SEPOLIA":
            chainId = 11155111;
            contractAddress = "0x5E945200e9eFF3d4414a4466B5008643dceC7073";
            break;
        case "MATIC_MAINNET":
            chainId = 137;
            contractAddress = "0x1Ad528c5d7906543E369a605f6EF0Be503aBff76";
            break;
        default:
            throw new Error("Invalid network");
    }

    const abi = [
        "function fillPrice(uint256 betId) external",
        "function betInfo(uint256 _betId) external view returns (address bidder, uint256 poolId, uint256 bidPrice, uint256 resultPrice, uint256 bidStartTimestamp, uint256 bidEndTimestamp, uint256 bidSettleTimestamp, uint256 priceAtBid)",
        "function isBetCancelled(uint256 _betId) external view returns (bool)"
    ];
    const provider = new ethers.AlchemyProvider(
        chainId,
        await aws.getAlchemyRpcKey()
    );
    const contract = new ethers.Contract(contractAddress, abi, provider);
    const betInfo = await contract.betInfo(BigInt(betId));
    if (betInfo.resultPrice != 0n || (await contract.isBetCancelled(BigInt(betId)))) {
        console.log(`Bet ${betId} is already filled or cancelled`);
        return;
    }

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