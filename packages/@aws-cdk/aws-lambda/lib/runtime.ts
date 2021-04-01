import { BundlingDockerImage, DockerImage } from '@aws-cdk/core';

export interface LambdaRuntimeProps {
  /**
   * Whether the ``ZipFile`` (aka inline code) property can be used with this runtime.
   * @default false
   */
  readonly supportsInlineCode?: boolean;

  /**
   * The Docker image name to be used for bundling in this runtime.
   * @default - the latest docker image "amazon/public.ecr.aws/sam/build-<runtime>" from https://gallery.ecr.aws
   */
  readonly bundlingDockerImage?: string;

  /**
   * Whether this runtime is integrated with and supported for profiling using Amazon CodeGuru Profiler.
   * @default false
   */
  readonly supportsCodeGuruProfiling?: boolean;
}

export enum RuntimeFamily {
  NODEJS,
  JAVA,
  PYTHON,
  DOTNET_CORE,
  GO,
  RUBY,
  OTHER
}

/**
 * Lambda function runtime environment.
 *
 * If you need to use a runtime name that doesn't exist as a static member, you
 * can instantiate a `Runtime` object, e.g: `new Runtime('nodejs99.99')`.
 */
export class Runtime {
  /** A list of all known `Runtime`'s. */
  public static readonly ALL = new Array<Runtime>();

  /**
   * The NodeJS runtime (nodejs)
   * Legacy runtime no longer supported by AWS Lambda.
   */
  public static readonly NODEJS = new Runtime('nodejs', RuntimeFamily.NODEJS, { supportsInlineCode: true });

  /**
   * The NodeJS 4.3 runtime (nodejs4.3)
   * Legacy runtime no longer supported by AWS Lambda.
   */
  public static readonly NODEJS_4_3 = new Runtime('nodejs4.3', RuntimeFamily.NODEJS, { supportsInlineCode: true });

  /**
   * The NodeJS 6.10 runtime (nodejs6.10)
   * Legacy runtime no longer supported by AWS Lambda.
   */
  public static readonly NODEJS_6_10 = new Runtime('nodejs6.10', RuntimeFamily.NODEJS, { supportsInlineCode: true });

  /**
   * The NodeJS 8.10 runtime (nodejs8.10)
   * Legacy runtime no longer supported by AWS Lambda.
   */
  public static readonly NODEJS_8_10 = new Runtime('nodejs8.10', RuntimeFamily.NODEJS, { supportsInlineCode: true });

  /**
   * The NodeJS 10.x runtime (nodejs10.x)
   */
  public static readonly NODEJS_10_X = new Runtime('nodejs10.x', RuntimeFamily.NODEJS, { supportsInlineCode: true });

  /**
   * The NodeJS 12.x runtime (nodejs12.x)
   */
  public static readonly NODEJS_12_X = new Runtime('nodejs12.x', RuntimeFamily.NODEJS, { supportsInlineCode: true });

  /**
   * The NodeJS 14.x runtime (nodejs14.x)
   */
  public static readonly NODEJS_14_X = new Runtime('nodejs14.x', RuntimeFamily.NODEJS, { supportsInlineCode: false });

  /**
   * The Python 2.7 runtime (python2.7)
   */
  public static readonly PYTHON_2_7 = new Runtime('python2.7', RuntimeFamily.PYTHON, { supportsInlineCode: true });

  /**
   * The Python 3.6 runtime (python3.6)
   */
  public static readonly PYTHON_3_6 = new Runtime('python3.6', RuntimeFamily.PYTHON, {
    supportsInlineCode: true,
    supportsCodeGuruProfiling: true,
  });

  /**
   * The Python 3.7 runtime (python3.7)
   */
  public static readonly PYTHON_3_7 = new Runtime('python3.7', RuntimeFamily.PYTHON, {
    supportsInlineCode: true,
    supportsCodeGuruProfiling: true,
  });

  /**
   * The Python 3.8 runtime (python3.8)
   */
  public static readonly PYTHON_3_8 = new Runtime('python3.8', RuntimeFamily.PYTHON, {
    supportsInlineCode: true,
    supportsCodeGuruProfiling: true,
  });

  /**
   * The Java 8 runtime (java8)
   */
  public static readonly JAVA_8 = new Runtime('java8', RuntimeFamily.JAVA, {
    supportsCodeGuruProfiling: true,
  });

  /**
   * The Java 8 Corretto runtime (java8.al2)
   */
  public static readonly JAVA_8_CORRETTO = new Runtime('java8.al2', RuntimeFamily.JAVA, {
    supportsCodeGuruProfiling: true,
  });

  /**
   * The Java 11 runtime (java11)
   */
  public static readonly JAVA_11 = new Runtime('java11', RuntimeFamily.JAVA, {
    supportsCodeGuruProfiling: true,
  });

  /**
   * The .NET Core 1.0 runtime (dotnetcore1.0)
   * Legacy runtime no longer supported by AWS Lambda.
   */
  public static readonly DOTNET_CORE_1 = new Runtime('dotnetcore1.0', RuntimeFamily.DOTNET_CORE);

  /**
   * The .NET Core 2.0 runtime (dotnetcore2.0)
   * Legacy runtime no longer supported by AWS Lambda.
   */
  public static readonly DOTNET_CORE_2 = new Runtime('dotnetcore2.0', RuntimeFamily.DOTNET_CORE);

  /**
   * The .NET Core 2.1 runtime (dotnetcore2.1)
   */
  public static readonly DOTNET_CORE_2_1 = new Runtime('dotnetcore2.1', RuntimeFamily.DOTNET_CORE, {
    bundlingDockerImage: 'lambci/lambda:build-dotnetcore2.1',
  });

  /**
   * The .NET Core 3.1 runtime (dotnetcore3.1)
   */
  public static readonly DOTNET_CORE_3_1 = new Runtime('dotnetcore3.1', RuntimeFamily.DOTNET_CORE, {
    bundlingDockerImage: 'lambci/lambda:build-dotnetcore3.1',
  });

  /**
   * The Go 1.x runtime (go1.x)
   */
  public static readonly GO_1_X = new Runtime('go1.x', RuntimeFamily.GO, {
    bundlingDockerImage: 'lambci/lambda:build-go1.x',
  });

  /**
   * The Ruby 2.5 runtime (ruby2.5)
   */
  public static readonly RUBY_2_5 = new Runtime('ruby2.5', RuntimeFamily.RUBY);

  /**
   * The Ruby 2.7 runtime (ruby2.7)
   */
  public static readonly RUBY_2_7 = new Runtime('ruby2.7', RuntimeFamily.RUBY);

  /**
   * The custom provided runtime (provided)
   */
  public static readonly PROVIDED = new Runtime('provided', RuntimeFamily.OTHER);

  /**
   * The custom provided runtime (provided)
   */
  public static readonly PROVIDED_AL2 = new Runtime('provided.al2', RuntimeFamily.OTHER);

  /**
   * A special runtime entry to be used when function is using a docker image.
   */
  public static readonly FROM_IMAGE = new Runtime('FROM_IMAGE');

  /**
   * The name of this runtime, as expected by the Lambda resource.
   */
  public readonly name: string;

  /**
   * Whether the ``ZipFile`` (aka inline code) property can be used with this
   * runtime.
   */
  public readonly supportsInlineCode: boolean;

  /**
   * Whether this runtime is integrated with and supported for profiling using Amazon CodeGuru Profiler.
   */
  public readonly supportsCodeGuruProfiling: boolean;

  /**
   * The runtime family.
   */
  public readonly family?: RuntimeFamily;

  /**
   * DEPRECATED
   * @deprecated use `bundlingImage`
   */
  public readonly bundlingDockerImage: BundlingDockerImage;

  /**
   * The bundling Docker image for this runtime.
   */
  public readonly bundlingImage: DockerImage;

  constructor(name: string, family?: RuntimeFamily, props: LambdaRuntimeProps = {}) {
    this.name = name;
    this.supportsInlineCode = !!props.supportsInlineCode;
    this.family = family;

    const imageName = props.bundlingDockerImage ?? `public.ecr.aws/sam/build-${name}`;
    this.bundlingDockerImage = DockerImage.fromRegistry(imageName);
    this.bundlingImage = this.bundlingDockerImage;
    this.supportsCodeGuruProfiling = props.supportsCodeGuruProfiling ?? false;

    Runtime.ALL.push(this);
  }

  public toString(): string {
    return this.name;
  }

  public runtimeEquals(other: Runtime): boolean {
    return other.name === this.name &&
      other.family === this.family &&
      other.supportsInlineCode === this.supportsInlineCode;
  }
}
