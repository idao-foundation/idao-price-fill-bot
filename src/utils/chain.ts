import { ethers } from "ethers";
import { getAlchemyRpcKey } from "./aws";

export enum Chain {
    Polygon = "polygon",
    Sepolia = "sepolia"
}


export async function getProvider(chain: Chain) {
    const alchemyApiKey = await getAlchemyRpcKey();

    switch (chain) {
        case Chain.Polygon:
            return new ethers.AlchemyProvider(137, alchemyApiKey);
        case Chain.Sepolia:
            return new ethers.AlchemyProvider(11155111, alchemyApiKey);
    }
}