import { validateUuid } from "../utils/aws";
import { routeEvent } from "../eventRouting/router";
import { validateAlchemyWebhookEvent } from "../models/alchemyWebhook";

export async function webhookRouter(event: any) {
    const uuid = event.pathParameters?.uuid;
    const authorized = await validateUuid(uuid);

    if (!authorized) {
        console.log('Dropped request, unauthorized');
        return {
            statusCode: 401,
            body: JSON.stringify({ message: 'Unauthorized' }),
        };
    }

    const { parsedBody, error } = validateAlchemyWebhookEvent(JSON.parse(event.body));
    if (!parsedBody) {
        console.log('Dropped request, invalid body');
        return {
            statusCode: 400,
            body: JSON.stringify({ message: 'Invalid event', error }),
        };
    }

    let acceptedEvents = 0;
    for (const event of parsedBody.event.data.block.logs) {
        const result = await routeEvent(event, parsedBody.event.network);
        if (result.accepted) {
            acceptedEvents++;
        }
    }

    const output = `Events routed: ${acceptedEvents} out of ${parsedBody.event.data.block.logs.length}`
    console.log(output);
    return {
        statusCode: 200,
        body: JSON.stringify({ message: output }),
    };
}