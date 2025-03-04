import * as cdk from 'aws-cdk-lib';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';

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

    // Create the SSM parameter for Alckemy RPC key
    const alchemyRpcKey = new ssm.StringParameter(this, 'AlchemyRpcKey', {
      parameterName: 'ALCHEMY_RPC_KEY',
      stringValue: process.env.ALCHEMY_RPC_KEY as string,
    });

    // Create the SSM parameter for the wallet private key
    const walletPrivateKey = new ssm.StringParameter(this, 'WalletPrivateKey', {
      parameterName: 'WALLET_PRIVATE_KEY',
      stringValue: process.env.WALLET_PRIVATE_KEY as string,
    });

    // Create the SSM parameter for the wallet private key
    const lostBetsBackendUuid = new ssm.StringParameter(this, 'LostBetsBackendUuid', {
      parameterName: 'LOST_BETS_BACKEND_UUID',
      stringValue: process.env.LOST_BETS_BACKEND_UUID as string,
    });

    // Create the SQS FIFO queue
    const priceFillAndVisibilityTimeout = cdk.Duration.minutes(5);
    const priceFillQueue = new sqs.Queue(this, 'PriceFillQueue', {
      queueName: 'priceFillQueue.fifo',
      fifo: true,
      contentBasedDeduplication: true,
      visibilityTimeout: priceFillAndVisibilityTimeout,
    });

    // Create the IAM role for EventBridge Scheduler to assume
    const scheduleExecutionRole = new iam.Role(this, 'ScheduleExecutionRole', {
      assumedBy: new iam.ServicePrincipal('scheduler.amazonaws.com'),
    });

    // Attach policy to allow EventBridge Scheduler to invoke the target
    scheduleExecutionRole.addToPolicy(new iam.PolicyStatement({
      actions: ['sqs:SendMessage'],
      resources: [priceFillQueue.queueArn], // Adjust the resource ARN as needed
    }));

    // Lambda function to handle all incoming webhooks and route them to the appropriate handler
    const webhookRouter = new NodejsFunction(this, 'webhookRouter', {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 180,
      timeout: cdk.Duration.minutes(5),
      handler: 'webhookRouter',
      entry: path.join(__dirname, '../src/index.ts'),
      bundling: {
        nodeModules: ['aws-sdk'],
      },
      environment: {
        PRICE_FILL_QUEUE_ARN: priceFillQueue.queueArn,
        SCHEDULE_PRICE_FILL_ROLE_ARN: scheduleExecutionRole.roleArn,
      },
      insightsVersion: lambda.LambdaInsightsVersion.fromInsightVersionArn(
        process.env.LAMBDA_INSIGHTS_EXTENSION as string
      )
    });

    // Add permissions to the webhookRouter function to read the ALCHEMY_REQUEST_UUID parameter
    webhookRouter.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ssm:GetParameter'],
      resources: [alchemyRequestUuid.parameterArn],
    }));

    // Add permissions to the webhookRouter function to read the ALCHEMY_RPC_KEY parameter
    webhookRouter.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ssm:GetParameter'],
      resources: [alchemyRpcKey.parameterArn],
    }));

    // Add permissions to the webhookRouter function to create schedules on EventBridge
    webhookRouter.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'scheduler:GetSchedule',
        'scheduler:CreateSchedule',
        'scheduler:DeleteSchedule',
      ],
      resources: ['arn:aws:scheduler:*:*:schedule/*'],
    }));

    // Add permissions to the webhookRouter function to pass the schedule execution role
    webhookRouter.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'iam:PassRole'
      ],
      resources: [scheduleExecutionRole.roleArn],
    }));

    // Lambda function to handle all incoming webhooks and route them to the appropriate handler
    const fillPrice = new NodejsFunction(this, 'fillPrice', {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 180,
      timeout: priceFillAndVisibilityTimeout,
      handler: 'fillPrice',
      entry: path.join(__dirname, '../src/index.ts'),
      bundling: {
        nodeModules: ['aws-sdk'],
      },
      insightsVersion: lambda.LambdaInsightsVersion.fromInsightVersionArn(
        process.env.LAMBDA_INSIGHTS_EXTENSION as string
      )
    });

    // Add permissions to the fillPrice function to read the WALLET_PRIVATE_KEY parameter
    fillPrice.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ssm:GetParameter'],
      resources: [walletPrivateKey.parameterArn],
    }));

    // Add permissions to the fillPrice function to read the ALCHEMY_RPC_KEY parameter
    fillPrice.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ssm:GetParameter'],
      resources: [alchemyRpcKey.parameterArn],
    }));

    // Add the SQS queue as an event source for the fillPrice Lambda function
    fillPrice.addEventSource(new lambdaEventSources.SqsEventSource(priceFillQueue, {
      batchSize: 1, // Adjust the batch size as needed
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
    uuidResource.addMethod('POST', new apigw.LambdaIntegration(webhookRouter), {
      requestValidator: new apigw.RequestValidator(this, 'UUIDValidator', {
        restApi: api,
        validateRequestParameters: true,
      }),
      requestParameters: {
        'method.request.path.uuid': true,
      },
    });

    // Cron to retrieve the lost bets
    const cronBetChecker = new NodejsFunction(this, 'cronBetChecker', {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 180,
      timeout: cdk.Duration.minutes(5),
      handler: 'cronBetChecker',
      entry: path.join(__dirname, '../src/index.ts'),
      bundling: {
        nodeModules: ['aws-sdk'],
      },
      environment: {
        PRICE_FILL_QUEUE_ARN: priceFillQueue.queueArn,
        SCHEDULE_PRICE_FILL_ROLE_ARN: scheduleExecutionRole.roleArn,
      },
      insightsVersion: lambda.LambdaInsightsVersion.fromInsightVersionArn(
        process.env.LAMBDA_INSIGHTS_EXTENSION as string
      )
    });

    // Add permissions to the webhookRouter function to read the LOST_BETS_BACKEND_UUID parameter
    cronBetChecker.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ssm:GetParameter'],
      resources: [lostBetsBackendUuid.parameterArn],
    }));

    // Add permissions to the cronBetChecker function to read the ALCHEMY_RPC_KEY parameter
    cronBetChecker.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ssm:GetParameter'],
      resources: [alchemyRpcKey.parameterArn],
    }));

    // Add permissions to the cronBetChecker function to create schedules on EventBridge
    cronBetChecker.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'scheduler:GetSchedule',
        'scheduler:CreateSchedule',
        'scheduler:DeleteSchedule',
      ],
      resources: ['arn:aws:scheduler:*:*:schedule/*'],
    }));

    // Add permissions to the cronBetChecker function to pass the schedule execution role
    cronBetChecker.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'iam:PassRole'
      ],
      resources: [scheduleExecutionRole.roleArn],
    }));

    // Create an EventBridge rule to invoke cronBetChecker Lambda every minute
    const rule = new events.Rule(this, 'CronBetCheckerRule', {
      schedule: events.Schedule.rate(cdk.Duration.minutes(1)),
    });
    rule.addTarget(new targets.LambdaFunction(cronBetChecker));

    // Enable lambda insights
    webhookRouter.role?.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchLambdaInsightsExecutionRolePolicy')
    );
    fillPrice.role?.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchLambdaInsightsExecutionRolePolicy')
    );
    cronBetChecker.role?.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchLambdaInsightsExecutionRolePolicy')
    );
  }
}