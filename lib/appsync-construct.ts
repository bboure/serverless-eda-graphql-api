import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ITable } from 'aws-cdk-lib/aws-dynamodb';
import {
  AppsyncFunction,
  AuthorizationType,
  CfnGraphQLApi,
  Code,
  Definition,
  FieldLogLevel,
  FunctionRuntime,
  GraphqlApi,
} from 'aws-cdk-lib/aws-appsync';
import { CfnRule, EventBus } from 'aws-cdk-lib/aws-events';
import {
  Effect,
  PolicyDocument,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from 'aws-cdk-lib/aws-iam';

type AppSyncConstructProps = {
  ordersTable: ITable;
  eventBus: EventBus;
};

export class AppSync extends Construct {
  constructor(scope: Construct, id: string, props: AppSyncConstructProps) {
    super(scope, id);

    const { ordersTable, eventBus } = props;

    // Define the AppSync API
    const api = new GraphqlApi(this, 'Api', {
      name: 'E-commerce',
      definition: Definition.fromFile('schema.graphql'),
      logConfig: {
        fieldLogLevel: FieldLogLevel.ALL,
      },
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: AuthorizationType.API_KEY,
        },
        additionalAuthorizationModes: [
          { authorizationType: AuthorizationType.IAM },
        ],
      },
    });

    const ordersDs = api.addDynamoDbDataSource('Orders', ordersTable);
    const eventBridgeDs = api.addEventBridgeDataSource('EventBridge', eventBus);
    const noneDs = api.addNoneDataSource('None');

    const createOrderFunction = new AppsyncFunction(this, 'CreateOrder', {
      api: api,
      name: 'CreateOrder',
      dataSource: ordersDs,
      runtime: FunctionRuntime.JS_1_0_0,
      code: Code.fromAsset('./src/resolvers/createOrder.js'),
    });

    const putEvent = new AppsyncFunction(this, 'PutEvent', {
      api: api,
      name: 'PutEvent',
      dataSource: eventBridgeDs,
      runtime: FunctionRuntime.JS_1_0_0,
      code: Code.fromAsset('./src/resolvers/putEvent.js'),
    });

    api.createResolver('CreateOrder', {
      typeName: 'Mutation',
      fieldName: 'createOrder',
      runtime: FunctionRuntime.JS_1_0_0,
      pipelineConfig: [createOrderFunction, putEvent],
      code: Code.fromInline(`
        export const request = () => { return {}; }
        export const response = (ctx) => { return ctx.result; }
      `),
    });

    api.createResolver('UpdateOrder', {
      typeName: 'Mutation',
      fieldName: 'notifyOrderUpdated',
      runtime: FunctionRuntime.JS_1_0_0,
      dataSource: noneDs,
      code: Code.fromAsset('./src/resolvers/notifyOrderUpdated.js'),
    });

    const policyStatement = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['appsync:GraphQL'],
      resources: [`${api.arn}/types/Mutation/fields/updateOrder`],
    });

    const ebRuleRole = new Role(scope, 'AppSyncEventBridgeRole', {
      assumedBy: new ServicePrincipal('events.amazonaws.com'),
      inlinePolicies: {
        PolicyStatement: new PolicyDocument({
          statements: [policyStatement],
        }),
      },
    });

    new CfnRule(scope, 'UpdateOrder', {
      eventBusName: eventBus.eventBusName,
      eventPattern: {
        source: ['order.processing'],
      },
      targets: [
        {
          id: 'myAppsyncTarget',
          arn: (api.node.defaultChild as CfnGraphQLApi).attrGraphQlEndpointArn,
          roleArn: ebRuleRole.roleArn,
          appSyncParameters: {
            graphQlOperation: `mutation UpdateOrder($input: UpdateOrderInput!) { updateOrder(input: $input) { id status total updatedAt } }`,
          },
          inputTransformer: {
            inputPathsMap: {
              id: '$.detail.order.id',
              status: '$.detail.order.status',
              updatedAt: '$.detail.order.status',
            },
            inputTemplate: JSON.stringify({
              input: {
                id: '<id>',
                status: '<status>',
                updatedAt: '<updatedAt>',
              },
            }),
          },
        },
      ],
    });

    // Output the API URL and API Key
    new cdk.CfnOutput(this, 'GraphQLAPIURL', {
      value: api.graphqlUrl,
    });

    new cdk.CfnOutput(this, 'GraphQLAPIKey', {
      value: api.apiKey || '',
    });
  }
}
