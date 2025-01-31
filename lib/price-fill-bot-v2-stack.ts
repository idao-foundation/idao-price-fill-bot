import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

export class PriceFillBotV2Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create the SSM parameter for Alckemy webhook path parameter
    const alchemyRequestUuid = new ssm.StringParameter(this, 'AlchemyRequestUuid', {
      parameterName: 'ALCHEMY_REQUEST_UUID',
      stringValue: process.env.ALCHEMY_REQUEST_UUID as string,
    });

    // Lambda function to handle all incoming webhooks and route them to the appropriate handler
    const webhookRouter = new NodejsFunction(this, 'webhookRouter', {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 180,
      timeout: cdk.Duration.minutes(5),
      handler: 'webhookRouter',
      entry: path.join(__dirname, '../src/webhookRouter.ts'),
      bundling: {
        nodeModules: ['aws-sdk'],
      },
    });

    // Add permissions to the webhookRouter function to read the ALCHEMY_REQUEST_UUID parameter
    webhookRouter.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ssm:GetParameter'],
      resources: [alchemyRequestUuid.parameterArn],
    }));

    // API Gateway to route incoming webhooks
    const api = new apigw.RestApi(this, 'webhookRouterApi', {
      restApiName: 'Webhook Router Service',
      description: 'This service handles incoming webhook events routing.',
    });

    // Create the webhook router resource with a path parameter for the UUID
    const webhook = api.root.addResource('webhook-router');
    const uuidResource = webhook.addResource('{uuid}');

    // Add the webhook router method to the UUID resource
    uuidResource.addMethod('ANY', new apigw.LambdaIntegration(webhookRouter), {
      requestValidator: new apigw.RequestValidator(this, 'UUIDValidator', {
        restApi: api,
        validateRequestParameters: true,
      }),
      requestParameters: {
        'method.request.path.uuid': true,
      },
    });
  }
}