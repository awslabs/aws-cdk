import { bold, reset, green, yellow, red } from 'colors/safe';
import { HistoryActivityPrinter } from '../../lib/api/util/cloudformation/stack-activity-monitor';
import { stderr } from './console-listener';

let TIMESTAMP: number;
let HUMAN_TIME: string;

beforeAll(() => {
  TIMESTAMP = new Date().getTime();
  HUMAN_TIME = new Date(TIMESTAMP).toLocaleTimeString();
});


test('prints 0/4 progress report, when addActivity is called with an "IN_PROGRESS" ResourceStatus', () => {
  const historyActivityPrinter = new HistoryActivityPrinter({
    resourceTypeColumnWidth: 23,
    resourcesTotal: 3,
    stream: process.stderr,
  });

  const output = stderr.inspectSync(() => {
    historyActivityPrinter.addActivity({
      event: {
        LogicalResourceId: 'stack1',
        ResourceStatus: 'IN_PROGRESS',
        Timestamp: new Date(TIMESTAMP),
        ResourceType: 'AWS::CloudFormation::Stack',
        StackId: '',
        EventId: '',
        StackName: '',
      },
    });
  });

  expect(output[0].trim()).toStrictEqual(`0/4 |${HUMAN_TIME} | ${reset('IN_PROGRESS         ')} | AWS::CloudFormation::Stack | ${reset(bold('stack1'))}`);
});

test('prints 1/4 progress report, when addActivity is called with an "UPDATE_COMPLETE" ResourceStatus', () => {
  const historyActivityPrinter = new HistoryActivityPrinter({
    resourceTypeColumnWidth: 23,
    resourcesTotal: 3,
    stream: process.stderr,
  });

  const output = stderr.inspectSync(() => {
    historyActivityPrinter.addActivity({
      event: {
        LogicalResourceId: 'stack1',
        ResourceStatus: 'UPDATE_COMPLETE',
        Timestamp: new Date(TIMESTAMP),
        ResourceType: 'AWS::CloudFormation::Stack',
        StackId: '',
        EventId: '',
        StackName: '',
      },
    });
  });

  expect(output[0].trim()).toStrictEqual(`1/4 |${HUMAN_TIME} | ${green('UPDATE_COMPLETE     ')} | AWS::CloudFormation::Stack | ${green(bold('stack1'))}`);
});

test('prints 1/4 progress report, when addActivity is called with an "UPDATE_COMPLETE_CLEAN_IN_PROGRESS" ResourceStatus', () => {
  const historyActivityPrinter = new HistoryActivityPrinter({
    resourceTypeColumnWidth: 23,
    resourcesTotal: 3,
    stream: process.stderr,
  });

  const output = stderr.inspectSync(() => {
    historyActivityPrinter.addActivity({
      event: {
        LogicalResourceId: 'stack1',
        ResourceStatus: 'UPDATE_COMPLETE_CLEANUP_IN_PROGRESS',
        Timestamp: new Date(TIMESTAMP),
        ResourceType: 'AWS::CloudFormation::Stack',
        StackId: '',
        EventId: '',
        StackName: '',
      },
    });
  });

  expect(output[0].trim()).toStrictEqual(`1/4 |${HUMAN_TIME} | ${green('UPDATE_COMPLETE_CLEA')} | AWS::CloudFormation::Stack | ${green(bold('stack1'))}`);
});


test('prints 1/4 progress report, when addActivity is called with an "ROLLBACK_COMPLETE_CLEAN_IN_PROGRESS" ResourceStatus', () => {
  const historyActivityPrinter = new HistoryActivityPrinter({
    resourceTypeColumnWidth: 23,
    resourcesTotal: 3,
    stream: process.stderr,
  });

  const output = stderr.inspectSync(() => {
    historyActivityPrinter.addActivity({
      event: {
        LogicalResourceId: 'stack1',
        ResourceStatus: 'ROLLBACK_COMPLETE_CLEANUP_IN_PROGRESS',
        Timestamp: new Date(TIMESTAMP),
        ResourceType: 'AWS::CloudFormation::Stack',
        StackId: '',
        EventId: '',
        StackName: '',
      },
    });
  });

  expect(output[0].trim()).toStrictEqual(`1/4 |${HUMAN_TIME} | ${yellow('ROLLBACK_COMPLETE_CL')} | AWS::CloudFormation::Stack | ${yellow(bold('stack1'))}`);
});

test('prints 0/4 progress report, when addActivity is called with an "UPDATE_FAILED" ResourceStatus', () => {
  const historyActivityPrinter = new HistoryActivityPrinter({
    resourceTypeColumnWidth: 23,
    resourcesTotal: 3,
    stream: process.stderr,
  });

  const output = stderr.inspectSync(() => {
    historyActivityPrinter.addActivity({
      event: {
        LogicalResourceId: 'stack1',
        ResourceStatus: 'UPDATE_FAILED',
        Timestamp: new Date(TIMESTAMP),
        ResourceType: 'AWS::CloudFormation::Stack',
        StackId: '',
        EventId: '',
        StackName: '',
      },
    });
  });

  expect(output[0].trim()).toStrictEqual(`0/4 |${HUMAN_TIME} | ${red('UPDATE_FAILED       ')} | AWS::CloudFormation::Stack | ${red(bold('stack1'))}`);
});


test('does not print "Failed Resources:" list, when all deployments are successful', () => {
  const historyActivityPrinter = new HistoryActivityPrinter({
    resourceTypeColumnWidth: 23,
    resourcesTotal: 1,
    stream: process.stderr,
  });

  const output = stderr.inspectSync(() => {
    historyActivityPrinter.addActivity({
      event: {
        LogicalResourceId: 'stack1',
        ResourceStatus: 'IN_PROGRESS',
        Timestamp: new Date(TIMESTAMP),
        ResourceType: 'AWS::CloudFormation::Stack',
        StackId: '',
        EventId: '',
        StackName: '',
      },
    });
    historyActivityPrinter.addActivity({
      event: {
        LogicalResourceId: 'stack1',
        ResourceStatus: 'UPDATE_COMPLETE',
        Timestamp: new Date(TIMESTAMP),
        ResourceType: 'AWS::CloudFormation::Stack',
        StackId: '',
        EventId: '',
        StackName: '',
      },
    });
    historyActivityPrinter.addActivity({
      event: {
        LogicalResourceId: 'stack2',
        ResourceStatus: 'UPDATE_COMPLETE',
        Timestamp: new Date(TIMESTAMP),
        ResourceType: 'AWS::CloudFormation::Stack',
        StackId: '',
        EventId: '',
        StackName: '',
      },
    });
    historyActivityPrinter.stop();
  });

  expect(output.length).toStrictEqual(3);
  expect(output[0].trim()).toStrictEqual(`0/2 |${HUMAN_TIME} | ${reset('IN_PROGRESS         ')} | AWS::CloudFormation::Stack | ${reset(bold('stack1'))}`);
  expect(output[1].trim()).toStrictEqual(`1/2 |${HUMAN_TIME} | ${green('UPDATE_COMPLETE     ')} | AWS::CloudFormation::Stack | ${green(bold('stack1'))}`);
  expect(output[2].trim()).toStrictEqual(`2/2 |${HUMAN_TIME} | ${green('UPDATE_COMPLETE     ')} | AWS::CloudFormation::Stack | ${green(bold('stack2'))}`);
});

test('prints "Failed Resources:" list, when at least one deployment fails', () => {
  const historyActivityPrinter = new HistoryActivityPrinter({
    resourceTypeColumnWidth: 23,
    resourcesTotal: 1,
    stream: process.stderr,
  });

  const output = stderr.inspectSync(() => {
    historyActivityPrinter.addActivity({
      event: {
        LogicalResourceId: 'stack1',
        ResourceStatus: 'IN_PROGRESS',
        Timestamp: new Date(TIMESTAMP),
        ResourceType: 'AWS::CloudFormation::Stack',
        StackId: '',
        EventId: '',
        StackName: '',
      },
    });
    historyActivityPrinter.addActivity({
      event: {
        LogicalResourceId: 'stack1',
        ResourceStatus: 'UPDATE_FAILED',
        Timestamp: new Date(TIMESTAMP),
        ResourceType: 'AWS::CloudFormation::Stack',
        StackId: '',
        EventId: '',
        StackName: '',
      },
    });
    historyActivityPrinter.stop();
  });

  expect(output.length).toStrictEqual(4);
  expect(output[0].trim()).toStrictEqual(`0/2 |${HUMAN_TIME} | ${reset('IN_PROGRESS         ')} | AWS::CloudFormation::Stack | ${reset(bold('stack1'))}`);
  expect(output[1].trim()).toStrictEqual(`0/2 |${HUMAN_TIME} | ${red('UPDATE_FAILED       ')} | AWS::CloudFormation::Stack | ${red(bold('stack1'))}`);
  expect(output[2].trim()).toStrictEqual('Failed resources:');
  expect(output[3].trim()).toStrictEqual(`${HUMAN_TIME} | ${red('UPDATE_FAILED       ')} | AWS::CloudFormation::Stack | ${red(bold('stack1'))}`);
});
