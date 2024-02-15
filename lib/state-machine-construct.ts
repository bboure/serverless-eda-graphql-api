import { Construct } from 'constructs';
import {
  EventBus,
  EventField,
  Rule,
  RuleTargetInput,
} from 'aws-cdk-lib/aws-events';
import {
  Chain,
  DefinitionBody,
  Pass,
  StateMachine,
  TaskInput,
  Wait,
  WaitTime,
} from 'aws-cdk-lib/aws-stepfunctions';
import { Duration } from 'aws-cdk-lib';
import { EventBridgePutEvents } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { SfnStateMachine } from 'aws-cdk-lib/aws-events-targets';

type OrderHandlerProps = {
  eventBus: EventBus;
};

export class OrderHandler extends Construct {
  private eventBus: EventBus;

  constructor(scope: Construct, id: string, props: OrderHandlerProps) {
    super(scope, id);

    const { eventBus } = props;

    this.eventBus = eventBus;

    const chain = Chain.start(this.createWait('Payment', 30))
      .next(this.createUpdateOrder('PAID'))
      .next(this.createNotifyUpdate('Paid'))
      .next(this.createWait('Confirmation', 5))
      .next(this.createUpdateOrder('PREPARING'))
      .next(this.createNotifyUpdate('Preparing'))
      .next(this.createWait('Ready', 10))
      .next(this.createUpdateOrder('OUT_FOR_DELIVERY'))
      .next(this.createNotifyUpdate('OutForDelivery'))
      .next(this.createWait('Delivery', 15))
      .next(this.createUpdateOrder('DELIVERED'))
      .next(this.createNotifyUpdate('Delivered'));

    const sm = new StateMachine(this, 'OrderHandler', {
      definitionBody: DefinitionBody.fromChainable(chain),
    });

    new Rule(this, 'OrderHandlerRule', {
      eventBus: eventBus,
      eventPattern: {
        source: ['order.api'],
        detailType: ['order.created'],
      },
      targets: [
        new SfnStateMachine(sm, {
          input: RuleTargetInput.fromObject({
            order: EventField.fromPath('$.detail'),
          }),
        }),
      ],
    });
  }

  // Simulates a task update by the system
  createUpdateOrder(status: string) {
    return new Pass(this, `Update Order to ${status}`, {
      parameters: {
        'id.$': '$.order.id',
        status: status,
        'updatedAt.$': '$$.State.EnteredTime',
      },
      resultPath: '$.order',
    });
  }

  createWait(name: string, duration: number) {
    return new Wait(this, `Wait for ${name}`, {
      time: WaitTime.duration(Duration.seconds(duration)),
    });
  }

  createNotifyUpdate(name: string) {
    return new EventBridgePutEvents(this, `Notify ${name}`, {
      entries: [
        {
          source: 'order.processing',
          detailType: 'order.updated',
          detail: TaskInput.fromObject({
            'order.$': '$.order',
          }),
          eventBus: this.eventBus,
        },
      ],
      resultPath: '$.eventBridgeResult',
    });
  }
}
