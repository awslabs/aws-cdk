import * as util from 'util';
import * as cxschema from '@aws-cdk/cloud-assembly-schema';
import * as cxapi from '@aws-cdk/cx-api';
import * as aws from 'aws-sdk';
import * as colors from 'colors/safe';
import { error, logLevel, LogLevel, setLogLevel } from '../../../logging';
import { RewritableBlock } from '../display';

interface StackActivity {
  readonly event: aws.CloudFormation.StackEvent;
  readonly metadata?: ResourceMetadata;
  flushed: boolean;
}

interface ResourceMetadata {
  entry: cxschema.MetadataEntry;
  constructPath: string;
}

export interface StackActivityMonitorProps {
  /**
   * Total number of resources to update
   *
   * Used to calculate a progress bar.
   *
   * @default - No progress reporting.
   */
  readonly resourcesTotal?: number;

  /**
   * The log level that was requested in the CLI
   *
   * If verbose or trace is requested, we'll always use the full history printer.
   *
   * @default - Use value from logging.logLevel
   */
  readonly logLevel?: LogLevel;

  /**
   * Whether we are on a CI system
   *
   * If so, disable the "optimized" stack monitor.
   *
   * @default false
   */
  readonly ci?: boolean;
}

export class StackActivityMonitor {
  private active = false;
  private activity: { [eventId: string]: StackActivity } = { };

  /**
   * Number of ms to wait between pagination calls
   */
  private readonly pageSleep = 500;

  /**
   * Determines which events not to display
   */
  private startTime = Date.now();

  /**
   * Current tick timer
   */
  private tickTimer?: NodeJS.Timer;

  /**
   * Set to the activity of reading the current events
   */
  private readPromise?: Promise<AWS.CloudFormation.StackEvent[]>;

  private readonly printer: ActivityPrinterBase;

  constructor(
    private readonly cfn: aws.CloudFormation,
    private readonly stackName: string,
    private readonly stack: cxapi.CloudFormationStackArtifact,
    options: StackActivityMonitorProps = {}) {

    const stream = process.stderr;

    const props: PrinterProps = {
      resourceTypeColumnWidth: calcMaxResourceTypeLength(this.stack.template),
      resourcesTotal: options.resourcesTotal,
      stream,
    };

    const isWindows = process.platform === 'win32';
    const verbose = options.logLevel ?? logLevel;
    // On some CI systems (such as CircleCI) output still reports as a TTY so we also
    // need an individual check for whether we're running on CI.
    // see: https://discuss.circleci.com/t/circleci-terminal-is-a-tty-but-term-is-not-set/9965
    const fancyOutputAvailable = !isWindows && stream.isTTY && !options.ci;

    this.printer = fancyOutputAvailable && !verbose
      ? new CurrentActivityPrinter(props)
      : new HistoryActivityPrinter(props);
  }

  public start() {
    this.active = true;
    this.printer.start();
    this.scheduleNextTick();
    return this;
  }

  public async stop() {
    this.active = false;
    this.printer.stop();
    if (this.tickTimer) {
      clearTimeout(this.tickTimer);
    }

    if (this.readPromise) {
      // We're currently reading events, wait for it to finish and print them before continuing.
      await this.readPromise;
      this.flushEvents();
    }
  }

  private scheduleNextTick() {
    if (!this.active) {
      return;
    }
    this.tickTimer = setTimeout(() => this.tick().then(), this.printer.updateSleep);
  }

  private async tick() {
    if (!this.active) {
      return;
    }

    try {
      this.readPromise = this.readEvents();
      await this.readPromise;
      this.readPromise = undefined;

      // We might have been stop()ped while the network call was in progress.
      if (!this.active) { return; }

      this.flushEvents();
    } catch (e) {
      error('Error occurred while monitoring stack: %s', e);
    }
    this.scheduleNextTick();
  }

  /**
   * Flushes all unflushed events sorted by timestamp.
   */
  private flushEvents() {
    Object.keys(this.activity)
      .map(a => this.activity[a])
      .filter(a => a.event.Timestamp.valueOf() > this.startTime)
      .filter(a => !a.flushed)
      .sort((lhs, rhs) => lhs.event.Timestamp.valueOf() - rhs.event.Timestamp.valueOf())
      .forEach(a => {
        a.flushed = true;
        this.printer.addActivity(a);
      });

    this.printer.print();
  }

  private findMetadataFor(logicalId: string | undefined): ResourceMetadata | undefined {
    const metadata = this.stack.manifest.metadata;
    if (!logicalId || !metadata) { return undefined; }
    for (const path of Object.keys(metadata)) {
      const entry = metadata[path]
        .filter(e => e.type === cxschema.ArtifactMetadataEntryType.LOGICAL_ID)
        .find(e => e.data === logicalId);
      if (entry) {
        return {
          entry,
          constructPath: this.simplifyConstructPath(path),
        };
      }
    }
    return undefined;
  }

  private async readEvents(nextToken?: string): Promise<AWS.CloudFormation.StackEvent[]> {
    const output = await this.cfn.describeStackEvents({ StackName: this.stackName, NextToken: nextToken }).promise()
      .catch( e => {
        if (e.code === 'ValidationError' && e.message === `Stack [${this.stackName}] does not exist`) {
          return undefined;
        }
        throw e;
      });

    let events = output && output.StackEvents || [];
    let allNew = true;

    // merge events into the activity and dedup by event id
    for (const e of events) {
      if (e.EventId in this.activity) {
        allNew = false;
        break;
      }

      this.activity[e.EventId] = {
        flushed: false,
        event: e,
        metadata: this.findMetadataFor(e.LogicalResourceId),
      };
    }

    // only read next page if all the events we read are new events. otherwise, we can rest.
    if (allNew && output && output.NextToken) {
      await new Promise(cb => setTimeout(cb, this.pageSleep));
      events = events.concat(await this.readEvents(output.NextToken));
    }

    return events;
  }

  private simplifyConstructPath(path: string) {
    path = path.replace(/\/Resource$/, '');
    path = path.replace(/^\//, ''); // remove "/" prefix

    // remove "<stack-name>/" prefix
    if (path.startsWith(this.stackName + '/')) {
      path = path.substr(this.stackName.length + 1);
    }
    return path;
  }
}

function padRight(n: number, x: string): string {
  return x + ' '.repeat(Math.max(0, n - x.length));
}

/**
 * Infamous padLeft()
 */
function padLeft(n: number, x: string): string {
  return ' '.repeat(Math.max(0, n - x.length)) + x;
}

function calcMaxResourceTypeLength(template: any) {
  const resources = (template && template.Resources) || {};
  let maxWidth = 0;
  for (const id of Object.keys(resources)) {
    const type = resources[id].Type || '';
    if (type.length > maxWidth) {
      maxWidth = type.length;
    }
  }
  return maxWidth;
}

interface PrinterProps {
  /**
   * Total resources to deploy
   */
  readonly resourcesTotal?: number

  /**
   * The with of the "resource type" column.
   */
  readonly resourceTypeColumnWidth: number;

  /**
   * Stream to write to
   */
  readonly stream: NodeJS.WriteStream;
}

abstract class ActivityPrinterBase {
  /**
   * Fetch new activity every 5 seconds
   */
  public readonly updateSleep: number = 5_000;

  /**
   * A list of resource IDs which are currently being processed
   */
  protected resourcesInProgress: Record<string, StackActivity> = {};

  /**
   * Previous completion state observed by logical ID
   *
   * We use this to detect that if we see a DELETE_COMPLETE after a
   * CREATE_COMPLETE, it's actually a rollback and we should DECREASE
   * resourcesDone instead of increase it
   */
  protected resourcesPrevCompleteState: Record<string, string> = {};

  /**
   * Count of resources that have reported a _COMPLETE status
   */
  protected resourcesDone: number = 0;

  /**
   * How many digits we need to represent the total count (for lining up the status reporting)
   */
  protected readonly resourceDigits: number = 0;

  protected readonly resourcesTotal?: number;

  protected rollingBack = false;

  protected readonly failures = new Array<StackActivity>();

  protected readonly stream: NodeJS.WriteStream;

  constructor(protected readonly props: PrinterProps) {
    // +1 because the stack also emits a "COMPLETE" event at the end, and that wasn't
    // counted yet. This makes it line up with the amount of events we expect.
    this.resourcesTotal = props.resourcesTotal ? props.resourcesTotal + 1 : undefined;

    // How many digits does this number take to represent?
    this.resourceDigits = this.resourcesTotal ? Math.ceil(Math.log10(this.resourcesTotal)) : 0;

    this.stream = props.stream;
  }

  public addActivity(activity: StackActivity) {
    const status = activity.event.ResourceStatus;
    if (!status || !activity.event.LogicalResourceId) { return; }

    if (status === 'ROLLBACK_IN_PROGRESS') {
      // Only triggered on the stack once we've strated doing a rollback
      this.rollingBack = true;
    }

    if (status.endsWith('_IN_PROGRESS')) {
      this.resourcesInProgress[activity.event.LogicalResourceId] = activity;
    }

    if (status.endsWith('_FAILED')) {
      const isCancelled = (activity.event.ResourceStatusReason ?? '').indexOf('cancelled') > -1;

      // Cancelled is not an interesting failure reason
      if (!isCancelled) {
        this.failures.push(activity);
      }
    }

    if (status.endsWith('_COMPLETE') || status.endsWith('_FAILED')) {
      delete this.resourcesInProgress[activity.event.LogicalResourceId];
    }

    if (status.endsWith('_COMPLETE')) {
      const prevState = this.resourcesPrevCompleteState[activity.event.LogicalResourceId];
      if (!prevState) {
        this.resourcesDone++;
      } else {
        // If we completed this before and we're completing it AGAIN, means we're rolling back.
        // Protect against silly underflow.
        this.resourcesDone--;
        if (this.resourcesDone < 0) {
          this.resourcesDone = 0;
        }
      }
      this.resourcesPrevCompleteState[activity.event.LogicalResourceId] = status;
    }
  }

  public abstract print(): void;

  public start() {
    // Empty on purpose
  }

  public stop() {
    // Empty on purpose
  }
}

/**
 * Activity Printer which shows a full log of all CloudFormation events
 *
 * When there hasn't been activity for a while, it will print the resources
 * that are currently in progress, to show what's holding up the deployment.
 */
export class HistoryActivityPrinter extends ActivityPrinterBase {
  /**
   * Last time we printed something to the console.
   *
   * Used to measure timeout for progress reporting.
   */
  private lastPrintTime = Date.now();

  /**
   * Number of ms of change absence before we tell the user about the resources that are currently in progress.
   */
  private readonly inProgressDelay = 30_000;

  private readonly printable = new Array<StackActivity>();

  constructor(props: PrinterProps) {
    super(props);
  }

  public addActivity(activity: StackActivity) {
    super.addActivity(activity);
    this.printable.push(activity);
  }

  public print() {
    for (const activity of this.printable) {
      this.printOne(activity);
    }
    this.printable.splice(0, this.printable.length);
    this.printInProgress();
  }

  private printOne(activity: StackActivity) {
    const e = activity.event;
    const color = colorFromStatusResult(e.ResourceStatus);
    let reasonColor = colors.cyan;

    let stackTrace = '';
    const md = activity.metadata;
    if (md && e.ResourceStatus && e.ResourceStatus.indexOf('FAILED') !== -1) {
      stackTrace = md.entry.trace ? `\n\t${md.entry.trace.join('\n\t\\_ ')}` : '';
      reasonColor = colors.red;
    }

    const resourceName = md ? md.constructPath : (e.LogicalResourceId || '');

    const logicalId = resourceName !== e.LogicalResourceId ? `(${e.LogicalResourceId}) ` : '';

    this.stream.write(util.format(' %s | %s | %s | %s | %s %s%s%s\n',
      this.progress(),
      new Date(e.Timestamp).toLocaleTimeString(),
      color(padRight(STATUS_WIDTH, (e.ResourceStatus || '').substr(0, STATUS_WIDTH))), // pad left and trim
      padRight(this.props.resourceTypeColumnWidth, e.ResourceType || ''),
      color(colors.bold(resourceName)),
      logicalId,
      reasonColor(colors.bold(e.ResourceStatusReason ? e.ResourceStatusReason : '')),
      reasonColor(stackTrace)));

    this.lastPrintTime = Date.now();
  }

  /**
   * Report the current progress as a [34/42] string, or just [34] if the total is unknown
   */
  private progress(): string {
    if (this.resourcesTotal == null) {
      // Don't have total, show simple count and hope the human knows
      return padLeft(3, util.format('%s', this.resourcesDone)); // max 200 resources
    }

    return util.format('%s/%s',
      padLeft(this.resourceDigits, this.resourcesDone.toString()),
      padLeft(this.resourceDigits, this.resourcesTotal != null ? this.resourcesTotal.toString() : '?'));
  }

  /**
   * If some resources are taking a while to create, notify the user about what's currently in progress
   */
  private printInProgress() {
    if (Date.now() < this.lastPrintTime + this.inProgressDelay) {
      return;
    }

    if (Object.keys(this.resourcesInProgress).length > 0) {
      this.stream.write(util.format('%s Currently in progress: %s\n',
        this.progress(),
        colors.bold(Object.keys(this.resourcesInProgress).join(', '))));
    }

    // We cheat a bit here. To prevent printInProgress() from repeatedly triggering,
    // we set the timestamp into the future. It will be reset whenever a regular print
    // occurs, after which we can be triggered again.
    this.lastPrintTime = +Infinity;
  }

}

/**
 * Activity Printer which shows the resources currently being updated
 *
 * It will continuously reupdate the terminal and show only the resources
 * that are currently being updated, in addition to a progress bar which
 * shows how far along the deployment is.
 *
 * Resources that have failed will always be shown, and will be recapitulated
 * along with their stack trace when the monitoring ends.
 *
 * Resources that failed deployment because they have been cancelled are
 * not included.
 */
export class CurrentActivityPrinter extends ActivityPrinterBase {
  /**
   * This looks very disorienting sleeping for 5 seconds. Update quicker.
   */
  public readonly updateSleep: number = 2_000;

  private oldLogLevel: LogLevel = LogLevel.DEFAULT;
  private block = new RewritableBlock(this.stream);

  constructor(props: PrinterProps) {
    super(props);
  }

  public print(): void {
    const lines = [];

    // Add a progress bar at the top
    const progressWidth = Math.max(Math.min((this.block.width ?? 80) - PROGRESSBAR_EXTRA_SPACE - 1, MAX_PROGRESSBAR_WIDTH), MIN_PROGRESSBAR_WIDTH);
    const prog = this.progressBar(progressWidth);
    if (prog) {
      lines.push('  ' + prog, '');
    }

    // Normally we'd only print "resources in progress", but it's also useful
    // to keep an eye on the failures and know about the specific errors asquickly
    // as possible (while the stack is still rolling back), so add those in.
    const toPrint: StackActivity[] = [...this.failures, ...Object.values(this.resourcesInProgress)];
    toPrint.sort((a, b) => a.event.Timestamp.getTime() - b.event.Timestamp.getTime());

    lines.push(...toPrint.map(res => {
      const color = colorFromStatusActivity(res.event.ResourceStatus);
      const resourceName = res.metadata?.constructPath ?? res.event.LogicalResourceId ?? '';

      return util.format('%s | %s | %s | %s%s',
        padLeft(TIMESTAMP_WIDTH, new Date(res.event.Timestamp).toLocaleTimeString()),
        color(padRight(STATUS_WIDTH, (res.event.ResourceStatus || '').substr(0, STATUS_WIDTH))),
        padRight(this.props.resourceTypeColumnWidth, res.event.ResourceType || ''),
        color(colors.bold(shorten(40, resourceName))),
        this.failureReasonOnNextLine(res));
    }));

    this.block.displayLines(lines);
  }

  public start() {
    // Need to prevent the waiter from printing 'stack not stable' every 5 seconds, it messes
    // with the output calculations.
    this.oldLogLevel = logLevel;
    setLogLevel(LogLevel.DEFAULT);
  }

  public stop() {
    setLogLevel(this.oldLogLevel);

    // Print failures at the end
    const lines = new Array<string>();
    for (const failure of this.failures) {
      lines.push(util.format(colors.red('%s | %s | %s | %s%s') + '\n',
        padLeft(TIMESTAMP_WIDTH, new Date(failure.event.Timestamp).toLocaleTimeString()),
        padRight(STATUS_WIDTH, (failure.event.ResourceStatus || '').substr(0, STATUS_WIDTH)),
        padRight(this.props.resourceTypeColumnWidth, failure.event.ResourceType || ''),
        shorten(40, failure.event.LogicalResourceId ?? ''),
        this.failureReasonOnNextLine(failure)));

      const trace = failure.metadata?.entry?.trace;
      if (trace) {
        lines.push(colors.red(`\t${trace.join('\n\t\\_ ')}\n`));
      }
    }

    // Display in the same block space, otherwise we're going to have silly empty lines.
    this.block.displayLines(lines);
  }

  private progressBar(width: number) {
    if (!this.resourcesTotal) { return ''; }
    const fraction = Math.min(this.resourcesDone / this.resourcesTotal, 1);
    const innerWidth = Math.max(1, width - 2);
    const chars = innerWidth * fraction;
    const remainder = chars - Math.floor(chars);

    const fullChars = FULL_BLOCK.repeat(Math.floor(chars));
    const partialChar = PARTIAL_BLOCK[Math.floor(remainder * PARTIAL_BLOCK.length)];
    const filler = '·'.repeat(innerWidth - Math.floor(chars) - (partialChar ? 1 : 0));

    const color = this.rollingBack ? colors.yellow : colors.green;

    return '[' + color(fullChars + partialChar) + filler + `] (${this.resourcesDone}/${this.resourcesTotal})`;
  }

  private failureReasonOnNextLine(activity: StackActivity) {
    return (activity.event.ResourceStatus ?? '').endsWith('_FAILED')
      ? `\n${' '.repeat(TIMESTAMP_WIDTH + STATUS_WIDTH + 6)}${colors.red(activity.event.ResourceStatusReason ?? '')}`
      : '';
  }
}

const FULL_BLOCK = '█';
const PARTIAL_BLOCK = ['', '▏', '▎', '▍', '▌', '▋', '▊', '▉'];
const MAX_PROGRESSBAR_WIDTH = 60;
const MIN_PROGRESSBAR_WIDTH = 10;
const PROGRESSBAR_EXTRA_SPACE = 2 /* leading spaces */ + 2 /* brackets */ + 4 /* progress number decoration */ + 6 /* 2 progress numbers up to 999 */;

function colorFromStatusResult(status?: string) {
  if (!status) {
    return colors.reset;
  }

  if (status.indexOf('FAILED') !== -1) {
    return colors.red;
  }
  if (status.indexOf('ROLLBACK') !== -1) {
    return colors.yellow;
  }
  if (status.indexOf('COMPLETE') !== -1) {
    return colors.green;
  }

  return colors.reset;
}

function colorFromStatusActivity(status?: string) {
  if (!status) {
    return colors.reset;
  }

  if (status.endsWith('_FAILED')) {
    return colors.red;
  }

  if (status.startsWith('CREATE_') || status.startsWith('UPDATE_')) {
    return colors.green;
  }
  if (status.startsWith('ROLLBACK_')) {
    return colors.yellow;
  }
  if (status.startsWith('DELETE_')) {
    return colors.yellow;
  }

  return colors.reset;
}

function shorten(maxWidth: number, p: string) {
  if (p.length <= maxWidth) { return p; }
  const half = Math.floor((maxWidth - 3) / 2);
  return p.substr(0, half) + '...' + p.substr(p.length - half);
}

const TIMESTAMP_WIDTH = 12;
const STATUS_WIDTH = 20;
