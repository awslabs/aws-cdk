import * as fs from 'fs';
import { IResource, Names, Resource, Stack } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { CfnFunction } from './cloudfront.generated';

/**
 * Represents the function's source code
 */
export abstract class FunctionCode {
  /**
   * Inline code for function
   * @returns code object with inline code.
   * @param code The actual function code
   */
  public static fromInline(code: string): FunctionCode {
    return new InlineCode(code);
  }

  /**
   * Code from external file for function
   * @returns code object with contents from file.
   * @param options the options for the external file
   */
  public static fromFile(options: FileCodeOptions): FunctionCode {
    return new FileCode(options);
  }

  /**
   * renders the function code
   */
  public abstract render(): string;
}

/**
 * Options when reading the function's code from an external file
 */
export interface FileCodeOptions {
  /**
   * The path of the file to read the code from
   */
  readonly filePath: string;
}

/**
 * Represents the function's source code as inline code
 */
class InlineCode extends FunctionCode {
  constructor(private code: string) {
    super();
  }

  public render(): string {
    return this.code;
  }
}


/**
 * Represents the function's source code loaded from an external file
 */
class FileCode extends FunctionCode {
  constructor(private options: FileCodeOptions) {
    super();
  }

  public render(): string {
    return fs.readFileSync(this.options.filePath, { encoding: 'utf-8' });
  }
}

/**
 * Represents a CloudFront Function
 */
export interface IFunction extends IResource {
  /**
   * The name of the function.
   * @attribute
   */
  readonly functionName: string;

  /**
   * The ARN of the function.
   * @attribute
   */
  readonly functionArn: string;
}

/**
 * Attributes of an existing CloudFront Function to import it
 */
export interface FunctionAttributes {
  /**
   * The name of the function.
   */
  readonly functionName: string;

  /**
   * The ARN of the function.
   */
  readonly functionArn: string;
}

/**
 * Properties for creating a CloudFront Function
 */
export interface FunctionProps {
  /**
   * A name to identify the function.
   * @default - generated from the `id`
   */
  readonly functionName?: string;

  /**
   * A comment to describe the function.
   * @default - same as `functionName`
   */
  readonly comment?: string;

  /**
   * The source code of the function.
   */
  readonly code: FunctionCode;
}

/**
 * A CloudFront Function
 *
 * @resource AWS::CloudFront::Function
 */
export class Function extends Resource implements IFunction {
  /** Imports a function by its name and ARN */
  public static fromFunctionAttributes(scope: Construct, id: string, attrs: FunctionAttributes): IFunction {
    return new class extends Resource implements IFunction {
      public readonly functionName = attrs.functionName;
      public readonly functionArn = attrs.functionArn;
    }(scope, id);
  }

  /**
   * the name of the CloudFront function
   * @attribute
   */
  public readonly functionName: string;
  /**
   * the ARN of the CloudFront function
   * @attribute
   */
  public readonly functionArn: string;
  /**
   * the deployment stage of the CloudFront function
   * @attribute
   */
  public readonly functionStage: string;

  constructor(scope: Construct, id: string, props: FunctionProps) {
    super(scope, id);

    this.functionName = props.functionName ?? this.generateName();

    const resource = new CfnFunction(this, 'Resource', {
      autoPublish: true,
      functionCode: props.code.render(),
      functionConfig: {
        comment: props.comment ?? this.functionName,
        runtime: 'cloudfront-js-1.0',
      },
      name: this.functionName,
    });

    this.functionArn = resource.attrFunctionArn;
    this.functionStage = resource.attrStage;
  }

  private generateName(): string {
    const name = Stack.of(this).region + Names.uniqueId(this);
    if (name.length > 64) {
      return name.substring(0, 32) + name.substring(name.length - 32);
    }
    return name;
  }
}

/**
 * The type of events that a CloudFront function can be invoked in response to.
 */
export enum FunctionEventType {

  /**
   * The viewer-request specifies the incoming request
   */
  VIEWER_REQUEST = 'viewer-request',

  /**
   * The viewer-response specifies the outgoing response
   */
  VIEWER_RESPONSE = 'viewer-response',
}

/**
 * Represents a CloudFront function and event type when using CF Functions.
 * The type of the {@link AddBehaviorOptions.functionAssociations} property.
 */
export interface FunctionAssociation {
  /**
   * The CloudFront function that will be invoked.
   */
  readonly function: IFunction;

  /** The type of event which should invoke the function. */
  readonly eventType: FunctionEventType;
}
