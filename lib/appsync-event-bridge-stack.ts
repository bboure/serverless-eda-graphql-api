import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import { AppSync } from './appsync-construct';
import { Data } from './data-construct';
import { EventBus } from 'aws-cdk-lib/aws-events';

export class AppsyncEventBridgeStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const eventBus = new EventBus(this, 'EventBus');

    const data = new Data(this, 'DataConstruct');

    new AppSync(this, 'AppSyncConstruct', {
      ordersTable: data.ordersTable,
      eventBus,
    });
  }
}
