import { IBucket } from '@aws-cdk/aws-s3';
import { CfnElement, Fn, Resource, Stack } from '@aws-cdk/core';
import { OperatingSystemType } from './machine-image';

/**
 * Options when constructing UserData for Linux
 */
export interface LinuxUserDataOptions {
  /**
   * Shebang for the UserData script
   *
   * @default "#!/bin/bash"
   */
  readonly shebang?: string;
}

/**
 * Options when downloading files from S3
 */
export interface S3DownloadOptions {

  /**
   * Name of the S3 bucket to download from
   */
  readonly bucket: IBucket;

  /**
   * The key of the file to download
   */
  readonly bucketKey: string;

  /**
   * The name of the local file.
   *
   * @default Linux   - /tmp/bucketKey
   *          Windows - %TEMP%/bucketKey
   */
  readonly localFile?: string;

}

/**
 * Options when executing a file.
 */
export interface ExecuteFileOptions {

  /**
   * The path to the file.
   */
  readonly filePath: string;

  /**
   * The arguments to be passed to the file.
   *
   * @default No arguments are passed to the file.
   */
  readonly arguments?: string;

}

/**
 * Instance User Data
 */
export abstract class UserData {
  /**
   * Create a userdata object for Linux hosts
   */
  public static forLinux(options: LinuxUserDataOptions = {}): UserData {
    return new LinuxUserData(options);
  }

  /**
   * Create a userdata object for Windows hosts
   */
  public static forWindows(): UserData {
    return new WindowsUserData();
  }

  /**
   * Create a userdata object with custom content
   */
  public static custom(content: string): UserData {
    const userData = new CustomUserData();
    userData.addCommands(content);
    return userData;
  }

  public static forOperatingSystem(os: OperatingSystemType): UserData {
    switch (os) {
      case OperatingSystemType.LINUX: return UserData.forLinux();
      case OperatingSystemType.WINDOWS: return UserData.forWindows();
      case OperatingSystemType.UNKNOWN: throw new Error('Cannot determine UserData for unknown operating system type');
    }
  }

  /**
   * Add one or more commands to the user data
   */
  public abstract addCommands(...commands: string[]): void;

  /**
   * Add one or more commands to the user data that will run when the script exits.
   */
  public abstract addOnExitCommands(...commands: string[]): void;

  /**
   * Render the UserData for use in a construct
   */
  public abstract render(): string;

  /**
   * Adds commands to download a file from S3
   *
   * @returns: The local path that the file will be downloaded to
   */
  public abstract addS3DownloadCommand(params: S3DownloadOptions): string;

  /**
   * Adds commands to execute a file
   */
  public abstract addExecuteFileCommand( params: ExecuteFileOptions): void;

  /**
   * Adds a command which will send a cfn-signal when the user data script ends
   */
  public abstract addSignalOnExitCommand( resource: Resource ): void;
}

/**
 * Linux Instance User Data
 */
class LinuxUserData extends UserData {
  private readonly lines: string[] = [];
  private readonly onExitLines: string[] = [];

  constructor(private readonly props: LinuxUserDataOptions = {}) {
    super();
  }

  public addCommands(...commands: string[]) {
    this.lines.push(...commands);
  }

  public addOnExitCommands(...commands: string[]) {
    this.onExitLines.push(...commands);
  }

  public render(): string {
    const shebang = this.props.shebang ?? '#!/bin/bash';
    return [shebang, ...(this.renderOnExitLines()), ...this.lines].join('\n');
  }

  public addS3DownloadCommand(params: S3DownloadOptions): string {
    const s3Path = `s3://${params.bucket.bucketName}/${params.bucketKey}`;
    const localPath = ( params.localFile && params.localFile.length !== 0 ) ? params.localFile : `/tmp/${ params.bucketKey }`;
    this.addCommands(
      `mkdir -p $(dirname '${localPath}')`,
      `aws s3 cp '${s3Path}' '${localPath}'`,
    );

    return localPath;
  }

  public addExecuteFileCommand( params: ExecuteFileOptions): void {
    this.addCommands(
      'set -e',
      `chmod +x '${params.filePath}'`,
      `'${params.filePath}' ${params.arguments ?? ''}`.trim(),
    );
  }

  public addSignalOnExitCommand( resource: Resource ): void {
    const stack = Stack.of(resource);
    const resourceID = stack.getLogicalId(resource.node.defaultChild as CfnElement);
    this.addOnExitCommands(`/opt/aws/bin/cfn-signal --stack ${stack.stackName} --resource ${resourceID} --region ${stack.region} -e $exitCode || echo 'Failed to send Cloudformation Signal'`);
  }

  private renderOnExitLines(): string[] {
    if ( this.onExitLines.length > 0 ) {
      return ['function exitTrap(){', 'exitCode=$?', ...this.onExitLines, '}', 'trap exitTrap EXIT'];
    }
    return [];
  }
}

/**
 * Windows Instance User Data
 */
class WindowsUserData extends UserData {
  private readonly lines: string[] = [];
  private readonly onExitLines: string[] = [];

  constructor() {
    super();
  }

  public addCommands(...commands: string[]) {
    this.lines.push(...commands);
  }

  public addOnExitCommands(...commands: string[]) {
    this.onExitLines.push(...commands);
  }

  public render(): string {
    return `<powershell>${
      [...(this.renderOnExitLines()),
        ...this.lines,
        ...( this.onExitLines.length > 0 ? ['throw "Success"'] : [] )].join('\n')
    }</powershell>`;
  }

  public addS3DownloadCommand(params: S3DownloadOptions): string {
    const localPath = ( params.localFile && params.localFile.length !== 0 ) ? params.localFile : `C:/temp/${ params.bucketKey }`;
    this.addCommands(
      `mkdir (Split-Path -Path '${localPath}' ) -ea 0`,
      `Read-S3Object -BucketName '${params.bucket.bucketName}' -key '${params.bucketKey}' -file '${localPath}' -ErrorAction Stop`,
    );
    return localPath;
  }

  public addExecuteFileCommand( params: ExecuteFileOptions): void {
    this.addCommands(
      `&'${params.filePath}' ${params.arguments ?? ''}`.trim(),
      `if (!$?) { Write-Error 'Failed to execute the file "${params.filePath}"' -ErrorAction Stop }`,
    );
  }

  public addSignalOnExitCommand( resource: Resource ): void {
    const stack = Stack.of(resource);
    const resourceID = stack.getLogicalId(resource.node.defaultChild as CfnElement);

    this.addOnExitCommands(`cfn-signal --stack ${stack.stackName} --resource ${resourceID} --region ${stack.region} --success ($success.ToString().ToLower())`);
  }

  private renderOnExitLines(): string[] {
    if ( this.onExitLines.length > 0 ) {
      return ['trap {', '$success=($PSItem.Exception.Message -eq "Success")', ...this.onExitLines, 'break', '}'];
    }
    return [];
  }
}

/**
 * Custom Instance User Data
 */
class CustomUserData extends UserData {
  private readonly lines: string[] = [];

  constructor() {
    super();
  }

  public addCommands(...commands: string[]) {
    this.lines.push(...commands);
  }

  public addOnExitCommands(): void {
    throw new Error('CustomUserData does not support addOnExitCommands, use UserData.forLinux() or UserData.forWindows() instead.');
  }

  public render(): string {
    return this.lines.join('\n');
  }

  public addS3DownloadCommand(): string {
    throw new Error('CustomUserData does not support addS3DownloadCommand, use UserData.forLinux() or UserData.forWindows() instead.');
  }

  public addExecuteFileCommand(): void {
    throw new Error('CustomUserData does not support addExecuteFileCommand, use UserData.forLinux() or UserData.forWindows() instead.');
  }

  public addSignalOnExitCommand(): void {
    throw new Error('CustomUserData does not support addSignalOnExitCommand, use UserData.forLinux() or UserData.forWindows() instead.');
  }
}

/**
 * Options when creating `MultipartBody`.
 */
export interface MultipartBodyOptions {

  /**
   * `Content-Type` header of this part.
   *
   * Some examples of content types:
   * * `text/x-shellscript; charset="utf-8"` (shell script)
   * * `text/cloud-boothook; charset="utf-8"` (shell script executed during boot phase)
   *
   * For Linux shell scripts use `text/x-shellscript`.
   */
  readonly contentType: string;

  /**
   * `Content-Transfer-Encoding` header specifying part encoding.
   *
   * @default undefined - body is not encoded
   */
  readonly transferEncoding?: string;

  /**
   * The body of message.
   *
   * @default undefined - body will not be added to part
   */
  readonly body?: string,
}

/**
 * The base class for all classes which can be used as {@link MultipartUserData}.
 */
export abstract class MultipartBody {
  /**
   * Content type for shell scripts
   */
  public static readonly SHELL_SCRIPT = 'text/x-shellscript; charset="utf-8"';

  /**
   * Content type for boot hooks
   */
  public static readonly CLOUD_BOOTHOOK = 'text/cloud-boothook; charset="utf-8"';

  /**
   * Constructs the new `MultipartBody` wrapping existing `UserData`. Modification to `UserData` are reflected
   * in subsequent renders of the part.
   *
   * For more information about content types see {@link MultipartBodyOptions.contentType}.
   *
   * @param userData user data to wrap into body part
   * @param contentType optional content type, if default one should not be used
   */
  public static fromUserData(userData: UserData, contentType?: string): MultipartBody {
    return new MultipartBodyUserDataWrapper(userData, contentType);
  }

  /**
   * Constructs the raw `MultipartBody` using specified body, content type and transfer encoding.
   *
   * When transfer encoding is specified (typically as Base64), it's caller responsibility to convert body to
   * Base64 either by wrapping with `Fn.base64` or by converting it by other converters.
   */
  public static fromRawBody(opts: MultipartBodyOptions): MultipartBody {
    return new MultipartBodyRaw(opts);
  }

  public constructor() {
  }

  /**
   * Render body part as the string.
   *
   * Subclasses should not add leading nor trailing new line characters (\r \n)
   */
  public abstract renderBodyPart(): string[];
}

/**
 * The raw part of multi-part user data, which can be added to {@link MultipartUserData}.
 */
class MultipartBodyRaw extends MultipartBody {
  public constructor(private readonly props: MultipartBodyOptions) {
    super();
  }

  /**
   * Render body part as the string.
   */
  public renderBodyPart(): string[] {
    const result: string[] = [];

    result.push(`Content-Type: ${this.props.contentType}`);

    if (this.props.transferEncoding != null) {
      result.push(`Content-Transfer-Encoding: ${this.props.transferEncoding}`);
    }
    // One line free after separator
    result.push('');

    if (this.props.body != null) {
      result.push(this.props.body);
      // The new line added after join will be consumed by encapsulating or closing boundary
    }

    return result;
  }
}

/**
 * Wrapper for `UserData`.
 */
class MultipartBodyUserDataWrapper extends MultipartBody {
  private readonly contentType: string;

  public constructor(private readonly userData: UserData, contentType?: string) {
    super();

    this.contentType = contentType || MultipartBody.SHELL_SCRIPT;
  }

  /**
   * Render body part as the string.
   */
  public renderBodyPart(): string[] {
    const result: string[] = [];

    result.push(`Content-Type: ${this.contentType}`);
    result.push('Content-Transfer-Encoding: base64');
    result.push('');
    result.push(Fn.base64(this.userData.render()));

    return result;
  }
}

/**
 * Options for creating {@link MultipartUserData}
 */
export interface MultipartUserDataOptions {
  /**
   * The string used to separate parts in multipart user data archive (it's like MIME boundary).
   *
   * This string should contain [a-zA-Z0-9()+,-./:=?] characters only, and should not be present in any part, or in text content of archive.
   *
   * @default `+AWS+CDK+User+Data+Separator==`
   */
  readonly partsSeparator?: string;
}

/**
 * Mime multipart user data.
 *
 * This class represents MIME multipart user data, as described in.
 * [Specifying Multiple User Data Blocks Using a MIME Multi Part Archive](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/bootstrap_container_instance.html#multi-part_user_data)
 *
 */
export class MultipartUserData extends UserData {
  private static readonly USE_PART_ERROR = 'MultipartUserData only supports this operation if it has a default UserData. Call addUserDataPart with makeDefault=true.';
  private static readonly BOUNDRY_PATTERN = '[^a-zA-Z0-9()+,-./:=?]';

  private parts: MultipartBody[] = [];

  private opts: MultipartUserDataOptions;

  private defaultUserData?: UserData;

  constructor(opts?: MultipartUserDataOptions) {
    super();

    let partsSeparator: string;

    // Validate separator
    if (opts?.partsSeparator != null) {
      if (new RegExp(MultipartUserData.BOUNDRY_PATTERN).test(opts!.partsSeparator)) {
        throw new Error(`Invalid characters in separator. Separator has to match pattern ${MultipartUserData.BOUNDRY_PATTERN}`);
      } else {
        partsSeparator = opts!.partsSeparator;
      }
    } else {
      partsSeparator = '+AWS+CDK+User+Data+Separator==';
    }

    this.opts = {
      partsSeparator: partsSeparator,
    };
  }

  /**
   * Adds a part to the list of parts.
   */
  public addPart(part: MultipartBody) {
    this.parts.push(part);
  }

  /**
   * Adds a multipart part based on a UserData object.
   *
   * If `makeDefault` is true, then the UserData added by this method
   * will also be the target of calls to the `add*Command` methods on
   * this MultipartUserData object.
   *
   * If `makeDefault` is false, then this is the same as calling:
   *
   * ```ts
   * multiPart.addPart(MultipartBody.fromUserData(userData, contentType));
   * ```
   *
   * An undefined `makeDefault` defaults to either:
   * - `true` if no default UserData has been set yet; or
   * - `false` if there is no default UserData set.
   */
  public addUserDataPart(userData: UserData, contentType?: string, makeDefault?: boolean) {
    this.addPart(MultipartBody.fromUserData(userData, contentType));
    makeDefault = makeDefault ?? (this.defaultUserData === undefined ? true : false);
    if (makeDefault) {
      this.defaultUserData = userData;
    }
  }

  public render(): string {
    const boundary = this.opts.partsSeparator;
    // Now build final MIME archive - there are few changes from MIME message which are accepted by cloud-init:
    // - MIME RFC uses CRLF to separate lines - cloud-init is fine with LF \n only
    // Note: new lines matters, matters a lot.
    var resultArchive = new Array<string>();
    resultArchive.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
    resultArchive.push('MIME-Version: 1.0');

    // Add new line, the next one will be boundary (encapsulating or closing)
    // so this line will count into it.
    resultArchive.push('');

    // Add parts - each part starts with boundary
    this.parts.forEach(part => {
      resultArchive.push(`--${boundary}`);
      resultArchive.push(...part.renderBodyPart());
    });

    // Add closing boundary
    resultArchive.push(`--${boundary}--`);
    resultArchive.push(''); // Force new line at the end

    return resultArchive.join('\n');
  }

  public addS3DownloadCommand(params: S3DownloadOptions): string {
    if (this.defaultUserData) {
      return this.defaultUserData.addS3DownloadCommand(params);
    } else {
      throw new Error(MultipartUserData.USE_PART_ERROR);
    }
  }

  public addExecuteFileCommand(params: ExecuteFileOptions): void {
    if (this.defaultUserData) {
      this.defaultUserData.addExecuteFileCommand(params);
    } else {
      throw new Error(MultipartUserData.USE_PART_ERROR);
    }
  }

  public addSignalOnExitCommand(resource: Resource): void {
    if (this.defaultUserData) {
      this.defaultUserData.addSignalOnExitCommand(resource);
    } else {
      throw new Error(MultipartUserData.USE_PART_ERROR);
    }
  }

  public addCommands(...commands: string[]): void {
    if (this.defaultUserData) {
      this.defaultUserData.addCommands(...commands);
    } else {
      throw new Error(MultipartUserData.USE_PART_ERROR);
    }
  }

  public addOnExitCommands(...commands: string[]): void {
    if (this.defaultUserData) {
      this.defaultUserData.addOnExitCommands(...commands);
    } else {
      throw new Error(MultipartUserData.USE_PART_ERROR);
    }
  }
}
