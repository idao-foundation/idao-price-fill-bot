import * as dotenv from 'dotenv';
import axios from 'axios';

// Load environment variables from .env file
dotenv.config();

async function createAlchemyVariable(variable: string, values: string[]) {
    const alchemyKey = process.env.ALCHEMY_AUTH_TOKEN;

    const url = `https://dashboard.alchemy.com/api/graphql/variables/${variable}`;
    const data = {
        items: values
    };

    try {
        await axios.post(url, data, {
            headers: {
                'X-Alchemy-Token': alchemyKey,
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        console.error('Error updating Alchemy variable:', error);
    }
}

async function getVariable(variable: string) {
    const alchemyKey = process.env.ALCHEMY_AUTH_TOKEN;

    const url = `https://dashboard.alchemy.com/api/graphql/variables/${variable}?limit=50000`;

    try {
        const response = await axios.get(url, {
            headers: {
                'X-Alchemy-Token': alchemyKey,
                'Content-Type': 'application/json'
            }
        });
        return response.data.data as string[];
    } catch (error) {
        console.error('Error updating Alchemy variable:', error);
        return [];
    }
}

async function deleteAlchemyVariable(variable: string) {
    const alchemyKey = process.env.ALCHEMY_AUTH_TOKEN;

    const url = `https://dashboard.alchemy.com/api/graphql/variables/${variable}`;

    try {
        await axios.delete(url, {
            headers: {
                'X-Alchemy-Token': alchemyKey,
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        console.error('Error updating Alchemy variable:', error);
    }
}

async function main() {
    const variable = 'monitoredAddresses';

    const currentValues = await getVariable(variable);
    if (currentValues.length > 0) {
        await deleteAlchemyVariable(variable);
    }

    await createAlchemyVariable(variable, [
        // Sepolia.BetContract
        '0x5E945200e9eFF3d4414a4466B5008643dceC7073',
        // Sepolia.RegisterPoints.BetPoints
        '0x22629Ab96Afc9E1e5964eD3926Ba740d233393Af'
    ]);

    const values = await getVariable(variable);
    console.log('Current values:', values);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});