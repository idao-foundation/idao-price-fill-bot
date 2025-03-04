import { ethers } from "ethers";
import { validateExecutionScheduleInput } from "../models/executionScheduleInput";
import * as aws from "../utils/aws";

let gasPct = 150;
let gasPricePct = 150;

async function fillPrice(event: any) {
    const messages = (event.Records as any[]).map((record: any) => {
        const { parsedBody, error } = validateExecutionScheduleInput(JSON.parse(record?.body));

        if (!parsedBody) {
            console.error('Dropped message:', record, "error", error);
            return null;
        }

        return parsedBody;
    }).filter((message) => message !== null);

    if (messages.length === 0) {
        console.error('No valid messages found');
        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'No valid messages found' }),
        }
    }

    // batchSize is set to 1, so we only have one message in the array
    const message = messages[0];

    let chainId: number;
    let contractAddress: string;
    switch (message.network) {
        case "ETH_SEPOLIA":
            chainId = 11155111;
            contractAddress = "0x5E945200e9eFF3d4414a4466B5008643dceC7073";
            break;
        case "MATIC_MAINNET":
            chainId = 137;
            contractAddress = "0x1Ad528c5d7906543E369a605f6EF0Be503aBff76";
            break;
        default:
            return {
                statusCode: 400,
                body: JSON.stringify({ message: 'Invalid network' }),
            }
    }

    // Create a provider and wallet
    const provider = new ethers.AlchemyProvider(
        chainId,
        await aws.getAlchemyRpcKey()
    );
    const wallet = new ethers.Wallet(
        await aws.getWalletPrivateKey(),
        provider
    );
    console.log(`Using wallet ${wallet.address}`);

    const abi = [
        "function fillPrice(uint256 betId) external",
        "function betInfo(uint256 _betId) external view returns (address bidder, uint256 poolId, uint256 bidPrice, uint256 resultPrice, uint256 bidStartTimestamp, uint256 bidEndTimestamp, uint256 bidSettleTimestamp, uint256 priceAtBid)",
        "function isBetCancelled(uint256 _betId) external view returns (bool)"
    ];
    const contract = new ethers.Contract(contractAddress, abi, wallet);
    const betId = BigInt(message.betId);

    console.log(`${betId} (${message.isLostBet ? "lost bet" : ""}): Checking if fillPrice is executable on network ${message.network} at ${contractAddress}`);
    // Wait for fillPrice to be executable
    while (true) {
        try {
            await contract.fillPrice.staticCall(betId);
            console.log(`${betId} (${message.isLostBet ? "lost bet" : ""}): fillPrice is executable`);
            break;
        } catch (err: any) {
            await new Promise(r => setTimeout(r, 2000));
            const betInfo = await contract.betInfo(betId);
            if (betInfo.resultPrice !== 0n) {
                console.log(`${betId} (${message.isLostBet ? "lost bet" : ""}): resultPrice is already set to ${betInfo.resultPrice}`);
                return {
                    statusCode: 200,
                    body: JSON.stringify({ message: 'resultPrice is already set' }),
                }
            }
            if (await contract.isBetCancelled(betId)) {
                console.log(`${betId} (${message.isLostBet ? "lost bet" : ""}): bet is cancelled`);
                return {
                    statusCode: 200,
                    body: JSON.stringify({ message: 'bet is cancelled' }),
                }
            }
            continue;
        }
    }

    // Execute fillPrice
    const estimateGas = await contract.fillPrice.estimateGas(betId);
    const gasLimit = (estimateGas * BigInt(gasPct)) / 100n
    console.log(`${betId} (${message.isLostBet ? "lost bet" : ""}): will use gasLimit ${gasLimit} (estimated ${estimateGas}, factor ${gasPct}%`)

    const feeData = await provider.getFeeData();
    const currentGasPrice = feeData.gasPrice!;
    const gasPrice = (currentGasPrice * BigInt(gasPricePct)) / 100n;
    console.log(`${betId} (${message.isLostBet ? "lost bet" : ""}): will use gasPrice ${ethers.formatUnits(gasPrice, 9)} (current ${ethers.formatUnits(currentGasPrice, 9)}, factor ${gasPricePct}%`)

    let nonce = await provider.getTransactionCount(wallet.address);

    const tx = await contract.fillPrice(betId, { gasPrice, gasLimit, nonce });
    console.log(`${betId} (${message.isLostBet ? "lost bet" : ""}): Broadcasted tx: ${tx.hash}`);

    await tx.wait();
    console.log(`${betId} (${message.isLostBet ? "lost bet" : ""}): Transaction mined on ${message.network}`);

    return {
        statusCode: 200,
        body: JSON.stringify({ message: 'fillPrice executed successfully' }),
    }
}

export async function fillPriceWrapper(event: any) {
    try {
        return await fillPrice(event);
    } catch (err) {
        console.error(err);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Internal server error' }),
        }
    }
}