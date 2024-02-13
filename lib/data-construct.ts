import { Construct } from 'constructs';
import { Table, AttributeType } from 'aws-cdk-lib/aws-dynamodb';

export class Data extends Construct {
  public readonly ordersTable: Table;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.ordersTable = new Table(this, 'Orders', {
      partitionKey: {
        name: 'id',
        type: AttributeType.STRING,
      },
    });
  }
}
