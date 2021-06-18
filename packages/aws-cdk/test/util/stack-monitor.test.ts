import { StackActivityMonitor, IActivityPrinter, StackActivity } from '../../lib/api/util/cloudformation/stack-activity-monitor';
import { sleep } from '../integ/helpers/aws';
import { MockSdk } from './mock-sdk';

let sdk: MockSdk;
let printer: FakePrinter;
beforeEach(() => {
  sdk = new MockSdk();
  printer = new FakePrinter();
});

test('continue to the next page if it exists', async () => {
  await testMonitorWithEventCalls([
    (request) => {
      expect(request.NextToken).toBeUndefined();
      return {
        StackEvents: [event(102)],
        NextToken: 'some-token',
      };
    },
    (request) => {
      expect(request.NextToken).toBe('some-token');
      return {
        StackEvents: [event(101)],
      };
    },
  ]);

  // Printer sees them in chronological order
  expect(printer.eventIds).toEqual(['101', '102']);
});

test('do not page further if we already saw the last event', async () => {
  await testMonitorWithEventCalls([
    (request) => {
      expect(request.NextToken).toBeUndefined();
      return {
        StackEvents: [event(101)],
      };
    },
    (request) => {
      expect(request.NextToken).toBeUndefined();
      return {
        StackEvents: [event(102), event(101)],
        NextToken: 'some-token',
      };
    },
    (request) => {
      // Did not use the token
      expect(request.NextToken).toBeUndefined();
      return {};
    },
  ]);

  // Seen in chronological order
  expect(printer.eventIds).toEqual(['101', '102']);
});

test('do not page further if the last event is too old', async () => {
  await testMonitorWithEventCalls([
    (request) => {
      expect(request.NextToken).toBeUndefined();
      return {
        StackEvents: [event(101), event(95)],
        NextToken: 'some-token',
      };
    },
    (request) => {
      // Start again from the top
      expect(request.NextToken).toBeUndefined();
      return {};
    },
  ]);

  // Seen only the new one
  expect(printer.eventIds).toEqual(['101']);
});

test('do a final request after the monitor is stopped', async () => {
  await testMonitorWithEventCalls([
    // Before stop
    (request) => {
      expect(request.NextToken).toBeUndefined();
      return {
        StackEvents: [event(101)],
      };
    },
  ],
  // After stop
  [
    (request) => {
      expect(request.NextToken).toBeUndefined();
      return {
        StackEvents: [event(102), event(101)],
      };
    },
  ]);

  // Seen both
  expect(printer.eventIds).toEqual(['101', '102']);
});

const T0 = 1597837230504;

// Events 0-99 are before we started paying attention
const T100 = T0 + 100 * 1000;

function event(nr: number): AWS.CloudFormation.StackEvent {
  return {
    EventId: `${nr}`,
    StackId: 'StackId',
    StackName: 'StackName',
    Timestamp: new Date(T0 + nr * 1000),
  };
}

async function testMonitorWithEventCalls(
    beforeStopInvocations: Array<(x: AWS.CloudFormation.DescribeStackEventsInput) => AWS.CloudFormation.DescribeStackEventsOutput>,
    afterStopInvocations: Array<(x: AWS.CloudFormation.DescribeStackEventsInput) => AWS.CloudFormation.DescribeStackEventsOutput> = [],
) {
  let describeStackEvents = (jest.fn() as jest.Mock<AWS.CloudFormation.DescribeStackEventsOutput, [AWS.CloudFormation.DescribeStackEventsInput]>);

  let finished = false;

  for (const invocation of beforeStopInvocations) {
    const invocation_ = invocation; // Capture loop variable in local because of closure semantics
    const isLast = invocation === beforeStopInvocations[beforeStopInvocations.length - 1];
    describeStackEvents = describeStackEvents.mockImplementationOnce(request => {
      const ret = invocation_(request);
      if (isLast) {
        finished = true;
      }
      return ret;
    });
  }
  for (const invocation of afterStopInvocations) {
    describeStackEvents = describeStackEvents.mockImplementationOnce(invocation);
  }
  describeStackEvents.mockImplementation(() => { return {}; });

  sdk.stubCloudFormation({ describeStackEvents });

  const monitor = new StackActivityMonitor(sdk.cloudFormation(), 'StackName', printer, undefined, new Date(T100)).start();
  await waitForCondition(() => finished);
  await monitor.stop();
}


class FakePrinter implements IActivityPrinter {
  public updateSleep: number = 0;
  public readonly activities: StackActivity[] = [];

  public get eventIds() {
    return this.activities.map(a => a.event.EventId);
  }

  public addActivity(activity: StackActivity): void {
    this.activities.push(activity);
  }

  public print(): void { }
  public start(): void { }
  public stop(): void { }
}

async function waitForCondition(cb: () => boolean): Promise<void> {
  while (!cb()) {
    await sleep(10);
  }
}
