import '@aws-cdk/assert/jest';
import * as lambda from '../lib';

describe('runtime', () => {
  test('runtimes are equal for different instances', () => {
    // GIVEN
    const runtime1 = new lambda.Runtime('python3.7', lambda.RuntimeFamily.PYTHON, { supportsInlineCode: true });
    const runtime2 = new lambda.Runtime('python3.7', lambda.RuntimeFamily.PYTHON, { supportsInlineCode: true });

    // WHEN
    expect(runtime1.runtimeEquals(runtime2)).toBe(true);
  });

  test('runtimes are equal for same instance', () => {
    const runtime = new lambda.Runtime('python3.7', lambda.RuntimeFamily.PYTHON, { supportsInlineCode: true });

    expect(runtime.runtimeEquals(runtime)).toBe(true);
  });

  test('unequal when name changes', () => {
    const runtime1 = new lambda.Runtime('python3.7', lambda.RuntimeFamily.PYTHON, { supportsInlineCode: true });
    const runtime2 = new lambda.Runtime('python3.6', lambda.RuntimeFamily.PYTHON, { supportsInlineCode: true });

    expect(runtime1.runtimeEquals(runtime2)).toBe(false);
  });

  test('unequal when family changes', () => {
    const runtime1 = new lambda.Runtime('python3.7', lambda.RuntimeFamily.PYTHON, { supportsInlineCode: true });
    const runtime2 = new lambda.Runtime('python3.7', lambda.RuntimeFamily.JAVA, { supportsInlineCode: true });

    expect(runtime1.runtimeEquals(runtime2)).toBe(false);
  });

  test('unequal when supportsInlineCode changes', () => {
    const runtime1 = new lambda.Runtime('python3.7', lambda.RuntimeFamily.PYTHON, { supportsInlineCode: true });
    const runtime2 = new lambda.Runtime('python3.7', lambda.RuntimeFamily.PYTHON, { supportsInlineCode: false });

    expect(runtime1.runtimeEquals(runtime2)).toBe(false);
  });

  test('bundlingDockerImage points to AWS SAM build image', () => {
    // GIVEN
    const runtime = new lambda.Runtime('my-runtime-name');

    // THEN
    expect(runtime.bundlingDockerImage.image).toEqual('public.ecr.aws/sam/build-my-runtime-name');
  });

  test('overridde to bundlingDockerImage points to the correct image', () => {
    // GIVEN
    const runtime = new lambda.Runtime('my-runtime-name', undefined, {
      bundlingDockerImage: 'my-docker-image',
    });

    // THEN
    expect(runtime.bundlingDockerImage.image).toEqual('my-docker-image');
  });

  test('dotnetcore and go have overridden images', () => {
    expect(lambda.Runtime.DOTNET_CORE_3_1.bundlingDockerImage.image).toEqual('lambci/lambda:build-dotnetcore3.1');
    expect(lambda.Runtime.DOTNET_CORE_2_1.bundlingDockerImage.image).toEqual('lambci/lambda:build-dotnetcore2.1');
    expect(lambda.Runtime.GO_1_X.bundlingDockerImage.image).toEqual('lambci/lambda:build-go1.x');
  });
});
