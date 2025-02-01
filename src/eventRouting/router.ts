import { AlchemyLog } from "../models/alchemyWebhook";
import * as handlers from "./handlers/betPlacedHandler";

export async function routeEvent(event: AlchemyLog, network: string) {
    // Ethereum Sepolia Testnet
    if (network == "ETH_SEPOLIA") {
        // BetContract
        if (event.account.address == "0x5e945200e9eff3d4414a4466b5008643dcec7073") {
            // BetPlaced
            if (event.topics[0] == "0x9e4ad81a505fc8a24407fca5bf334977871fb70d112d0b02a91949862b7894ec") {
                console.log('Caught ETH_SEPOLIA.BetContract.BetPlaced event');

                await handlers.handleBetPlaced(event, network);

                return { accepted: true };
            }
        }
    }

    // Polygon Mainnet
    if (network == "MATIC_MAINNET") {
        // BetContract
        if (event.account.address == "0x1ad528c5d7906543e369a605f6ef0be503abff76") {
            // BetPlaced (version without reservation in event)
            if (event.topics[0] == "0x69d86545c929d33bd342fd834422253fa147698f4ba07e90cd40252fe11fb59f") {
                console.log('Caught MATIC_MAINNET.BetContract.BetPlacedNoReservation event');

                await handlers.handleBetPlaced(event, network);

                return { accepted: true };
            }
        }
    }

    console.log(`Dropped event: ${network}.${event.account.address}.${event.topics[0]}`);
    return { accepted: false };
}