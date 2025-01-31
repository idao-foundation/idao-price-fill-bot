import { SSM } from 'aws-sdk';

export async function validateUuid(uuid: string) {
    const ssm = new SSM();

    try {
        const parameter = await ssm.getParameter({
            Name: 'ALCHEMY_REQUEST_UUID',
            WithDecryption: true,
        }).promise();

        const expectedUuid = parameter.Parameter?.Value;
        return uuid === expectedUuid;
    } catch (error) {
        console.error('Error retrieving ALCHEMY_REQUEST_UUID parameter:', error);
        return false;
    }
}