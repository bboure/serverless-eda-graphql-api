#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AppsyncEventBridgeStack } from '../lib/appsync-event-bridge-stack';

const app = new cdk.App();
new AppsyncEventBridgeStack(app, 'ServerlessFood', {});
