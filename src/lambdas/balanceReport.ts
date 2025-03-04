import { Chain, getProvider } from "../utils/chain";
import * as aws from "./../utils/aws";
import { Client, GatewayIntentBits, TextChannel } from "discord.js";
import { ethers } from "ethers";

async function sendMessage(client: Client, channelId: string, message: string) {
    const channel = (await client.channels.fetch(channelId)) as TextChannel;

    await channel.send(message);
}

async function getBalances(chain: Chain) {
    const provider = await getProvider(chain);

    let addresses: { value: string; label: string; }[] = [];
    switch (chain) {
        case Chain.Polygon:
            addresses = [
                { value: "0x1Ad528c5d7906543E369a605f6EF0Be503aBff76", label: "BetContract" },
                { value: "0x290BFBea3340b715d963f47ae19bb00aB24D4210", label: "BadgeContract" },
                { value: "0x808493F887975fcF51FcE3B9aC69d2ACbFefF13e", label: "BetPoints" },
                { value: "0x157C17F4E0F6944166142095dedB3785c931948E", label: "ReferalPoints" },
                { value: "0x127F8188d615362290db52CBA04E88E76B467FA3", label: "PriceFillBot" },
            ];
            break;
        case Chain.Sepolia:
            addresses = [

            ];
            break;
    }

    let result: {
        addressLabel: string;
        balance: string;
        isCritical: boolean;
    }[] = [];

    for (const address of addresses) {
        const balance = await provider.getBalance(address.value);
        let isCritical = false;

        if (
            chain == Chain.Polygon &&
            address.label == 'PriceFillBot' &&
            balance < ethers.parseEther('100')
        ) {
            isCritical = true;
        }

        result.push({
            addressLabel: address.label,
            balance: Number(ethers.formatEther(balance)).toFixed(2),
            isCritical,
        });
    }

    return result;
}

export async function balanceReport() {
    const apiKey = await aws.getDiscordApiKey();
    const channelIdPolygon = await aws.getDiscordReportChannelIdPolygon();
    const channelIdSepolia = await aws.getDiscordReportChannelIdSepolia();

    const client = new Client({
        intents: []
    });

    const [polygonBalances, sepoliaBalances] = await Promise.all([
        getBalances(Chain.Polygon),
        getBalances(Chain.Sepolia)
    ]);

    const polygonMessage = `Polygon balances:\n${polygonBalances.map((balance) => `- ${balance.addressLabel}: ${balance.balance} POL ${balance.isCritical ? "⚠️" : ""}`).join('\n')}`;
    const sepoliaMessage = `Sepolia balances:\n${sepoliaBalances.map((balance) => `- ${balance.addressLabel}: ${balance.balance} ETH`).join('\n')}`;

    await client.login(apiKey);

    if (polygonBalances.length > 0) {
        await sendMessage(client, channelIdPolygon, polygonMessage);
    }

    if (sepoliaBalances.length > 0) {
        await sendMessage(client, channelIdSepolia, sepoliaMessage);
    }
}