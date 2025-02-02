import { Scheduler, SSM } from 'aws-sdk';

const scheduler = new Scheduler();
const ssm = new SSM();

export async function validateUuid(uuid: string) {
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

export async function getAlchemyRpcKey() {
    const parameter = await ssm.getParameter({
        Name: 'ALCHEMY_RPC_KEY',
        WithDecryption: true,
    }).promise();

    if (!parameter.Parameter?.Value) {
        throw new Error('ALCHEMY_RPC_KEY parameter not found');
    }

    return parameter.Parameter.Value;
}

export async function getWalletPrivateKey() {
    const parameter = await ssm.getParameter({
        Name: 'WALLET_PRIVATE_KEY',
        WithDecryption: true,
    }).promise();

    if (!parameter.Parameter?.Value) {
        throw new Error('WALLET_PRIVATE_KEY parameter not found');
    }

    return parameter.Parameter.Value;
}

export async function getLostBetsBackendUuid() {
    const parameter = await ssm.getParameter({
        Name: 'LOST_BETS_BACKEND_UUID',
        WithDecryption: true,
    }).promise();

    if (!parameter.Parameter?.Value) {
        throw new Error('LOST_BETS_BACKEND_UUID parameter not found');
    }

    return parameter.Parameter.Value;
}

export async function scheduleExecution(scheduleId: string, input: any, targetArn: string, role: string, executeAt: Date, executionGroup?: string) {
    // check if rule exists
    try {
        await scheduler.getSchedule({
            Name: scheduleId
        }).promise();

        // delete existing rule
        await scheduler.deleteSchedule({
            Name: scheduleId
        }).promise();
    } catch (e: any) {
        if (e.code !== 'ResourceNotFoundException') {
            console.error('Failed to get rule:', e);
            throw e;
        }
    }

    const schedule = {
        Name: scheduleId,
        ScheduleExpression: `at(${executeAt.toISOString().replace('.000Z', '')})`,
        FlexibleTimeWindow: {
            Mode: "OFF",
        },
        ActionAfterCompletion: "DELETE",
        Target: {
            Arn: targetArn,
            Input: JSON.stringify(input),
            RoleArn: role,
            SqsParameters: {
                MessageGroupId: executionGroup
            }
        }
    }

    await scheduler.createSchedule(schedule).promise();

    console.log(`Rule '${scheduleId}' created: executing ${targetArn} at ${executeAt.toISOString()} with input: ${JSON.stringify(input)}`);
}