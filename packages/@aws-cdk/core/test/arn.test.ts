import { nodeunitShim, Test } from 'nodeunit-shim';
import { Arn, ArnComponents, Aws, CfnOutput, ScopedAws, Stack, Token } from '../lib';
import { Intrinsic } from '../lib/private/intrinsic';
import { evaluateCFN } from './evaluate-cfn';
import { toCloudFormation } from './util';

nodeunitShim({
  'create from components with defaults'(test: Test) {
    const stack = new Stack();

    const arn = stack.formatArn({
      service: 'sqs',
      resource: 'myqueuename',
    });

    const pseudo = new ScopedAws(stack);

    test.deepEqual(stack.resolve(arn),
      stack.resolve(`arn:${pseudo.partition}:sqs:${pseudo.region}:${pseudo.accountId}:myqueuename`));
    test.done();
  },

  'create from components with specific values for the various components'(test: Test) {
    const stack = new Stack();

    const arn = stack.formatArn({
      service: 'dynamodb',
      resource: 'table',
      account: '123456789012',
      region: 'us-east-1',
      partition: 'aws-cn',
      resourceName: 'mytable/stream/label',
    });

    test.deepEqual(stack.resolve(arn),
      'arn:aws-cn:dynamodb:us-east-1:123456789012:table/mytable/stream/label');
    test.done();
  },

  'allow empty string in components'(test: Test) {
    const stack = new Stack();

    const arn = stack.formatArn({
      service: 's3',
      resource: 'my-bucket',
      account: '',
      region: '',
      partition: 'aws-cn',
    });

    test.deepEqual(stack.resolve(arn),
      'arn:aws-cn:s3:::my-bucket');

    test.done();
  },

  'resourcePathSep can be set to ":" instead of the default "/"'(test: Test) {
    const stack = new Stack();

    const arn = stack.formatArn({
      service: 'codedeploy',
      resource: 'application',
      sep: ':',
      resourceName: 'WordPress_App',
    });

    const pseudo = new ScopedAws(stack);

    test.deepEqual(stack.resolve(arn),
      stack.resolve(`arn:${pseudo.partition}:codedeploy:${pseudo.region}:${pseudo.accountId}:application:WordPress_App`));
    test.done();
  },

  'resourcePathSep can be set to "" instead of the default "/"'(test: Test) {
    const stack = new Stack();

    const arn = stack.formatArn({
      service: 'ssm',
      resource: 'parameter',
      sep: '',
      resourceName: '/parameter-name',
    });

    const pseudo = new ScopedAws(stack);

    test.deepEqual(stack.resolve(arn),
      stack.resolve(`arn:${pseudo.partition}:ssm:${pseudo.region}:${pseudo.accountId}:parameter/parameter-name`));
    test.done();
  },

  'fails if resourcePathSep is neither ":" nor "/"'(test: Test) {
    const stack = new Stack();

    test.throws(() => stack.formatArn({
      service: 'foo',
      resource: 'bar',
      sep: 'x',
    }));
    test.done();
  },

  'Arn.parse(s)': {

    fails: {
      'if doesn\'t start with "arn:"'(test: Test) {
        const stack = new Stack();
        test.throws(() => stack.parseArn('barn:foo:x:a:1:2'), /ARNs must start with "arn:".*barn:foo/);
        test.done();
      },

      'if the ARN doesnt have enough components'(test: Test) {
        const stack = new Stack();
        test.throws(() => stack.parseArn('arn:is:too:short'), /The `resource` component \(6th component\) of an ARN is required/);
        test.done();
      },

      'if "service" is not specified'(test: Test) {
        const stack = new Stack();
        test.throws(() => stack.parseArn('arn:aws::4:5:6'), /The `service` component \(3rd component\) of an ARN is required/);
        test.done();
      },

      'if "resource" is not specified'(test: Test) {
        const stack = new Stack();
        test.throws(() => stack.parseArn('arn:aws:service:::'), /The `resource` component \(6th component\) of an ARN is required/);
        test.done();
      },
    },

    'various successful parses'(test: Test) {
      const stack = new Stack();
      const tests: { [arn: string]: ArnComponents } = {
        'arn:aws:a4b:region:accountid:resourcetype/resource': {
          partition: 'aws',
          service: 'a4b',
          region: 'region',
          account: 'accountid',
          resource: 'resourcetype',
          resourceName: 'resource',
          sep: '/',
        },
        'arn:aws:apigateway:us-east-1::a123456789012bc3de45678901f23a45:/test/mydemoresource/*': {
          partition: 'aws',
          service: 'apigateway',
          region: 'us-east-1',
          account: '',
          resource: 'a123456789012bc3de45678901f23a45',
          sep: ':',
          resourceName: '/test/mydemoresource/*',
        },
        'arn:aws-cn:cloud9::123456789012:environment:81e900317347585a0601e04c8d52eaEX': {
          partition: 'aws-cn',
          service: 'cloud9',
          region: '',
          account: '123456789012',
          resource: 'environment',
          resourceName: '81e900317347585a0601e04c8d52eaEX',
          sep: ':',
        },
        'arn:aws:cognito-sync:::identitypool/us-east-1:1a1a1a1a-ffff-1111-9999-12345678:bla': {
          service: 'cognito-sync',
          region: '',
          account: '',
          partition: 'aws',
          resource: 'identitypool',
          resourceName: 'us-east-1:1a1a1a1a-ffff-1111-9999-12345678:bla',
          sep: '/',
        },
        'arn:aws:s3:::my_corporate_bucket': {
          partition: 'aws',
          service: 's3',
          region: '',
          account: '',
          resource: 'my_corporate_bucket',
        },
      };

      Object.keys(tests).forEach(arn => {
        const expected = tests[arn];
        test.deepEqual(stack.parseArn(arn), expected, arn);
      });

      test.done();
    },

    'a Token with : separator'(test: Test) {
      const stack = new Stack();
      const theToken = { Ref: 'SomeParameter' };
      const parsed = stack.parseArn(new Intrinsic(theToken).toString(), ':');

      test.deepEqual(stack.resolve(parsed.partition), { 'Fn::Select': [1, { 'Fn::Split': [':', theToken] }] });
      test.deepEqual(stack.resolve(parsed.service), { 'Fn::Select': [2, { 'Fn::Split': [':', theToken] }] });
      test.deepEqual(stack.resolve(parsed.region), { 'Fn::Select': [3, { 'Fn::Split': [':', theToken] }] });
      test.deepEqual(stack.resolve(parsed.account), { 'Fn::Select': [4, { 'Fn::Split': [':', theToken] }] });
      test.deepEqual(stack.resolve(parsed.resource), { 'Fn::Select': [5, { 'Fn::Split': [':', theToken] }] });
      test.deepEqual(stack.resolve(parsed.resourceName), { 'Fn::Select': [6, { 'Fn::Split': [':', theToken] }] });
      test.equal(parsed.sep, ':');

      test.done();
    },

    'a Token with / separator'(test: Test) {
      const stack = new Stack();
      const theToken = { Ref: 'SomeParameter' };
      const parsed = stack.parseArn(new Intrinsic(theToken).toString());

      test.equal(parsed.sep, '/');

      // eslint-disable-next-line max-len
      test.deepEqual(stack.resolve(parsed.resource), { 'Fn::Select': [0, { 'Fn::Split': ['/', { 'Fn::Select': [5, { 'Fn::Split': [':', theToken] }] }] }] });
      // eslint-disable-next-line max-len
      test.deepEqual(stack.resolve(parsed.resourceName), { 'Fn::Select': [1, { 'Fn::Split': ['/', { 'Fn::Select': [5, { 'Fn::Split': [':', theToken] }] }] }] });

      test.done();
    },

    'extracting resource name from a complex ARN'(test: Test) {
      // GIVEN
      const stack = new Stack();
      const theToken = Token.asString({ Ref: 'SomeParameter' });

      // WHEN
      const parsed = Arn.extractResourceName(theToken, 'role');

      // THEN
      test.deepEqual(evaluateCFN(stack.resolve(parsed), {
        SomeParameter: 'arn:aws:iam::111111111111:role/path/to/role/name',
      }), 'path/to/role/name');

      test.done();
    },

    'extractResourceName validates resource type if possible'(test: Test) {
      // WHEN
      test.throws(() => {
        Arn.extractResourceName('arn:aws:iam::111111111111:banana/rama', 'role');
      }, /Expected resource type/);

      test.done();
    },

    'returns empty string ARN components'(test: Test) {
      const stack = new Stack();
      const arn = 'arn:aws:iam::123456789012:role/abc123';
      const expected: ArnComponents = {
        partition: 'aws',
        service: 'iam',
        region: '',
        account: '123456789012',
        resource: 'role',
        resourceName: 'abc123',
        sep: '/',
      };

      test.deepEqual(stack.parseArn(arn), expected, arn);
      test.done();
    },
  },

  'can use a fully specified ARN from a different stack without incurring an import'(test: Test) {
    // GIVEN
    const stack1 = new Stack(undefined, 'Stack1', { env: { account: '12345678', region: 'us-turbo-5' } });
    const stack2 = new Stack(undefined, 'Stack2', { env: { account: '87654321', region: 'us-turbo-1' } });

    // WHEN
    const arn = stack1.formatArn({
      // No partition specified here
      service: 'bla',
      resource: 'thing',
      resourceName: 'thong',
    });
    new CfnOutput(stack2, 'SomeValue', { value: arn });

    // THEN
    test.deepEqual(toCloudFormation(stack2), {
      Outputs: {
        SomeValue: {
          Value: {
            // Look ma, no Fn::ImportValue!
            'Fn::Join': ['', ['arn:', { Ref: 'AWS::Partition' }, ':bla:us-turbo-5:12345678:thing/thong']],
          },
        },
      },
    });

    test.done();
  },

  'parse other fields if only some are tokens'(test: Test) {
    // GIVEN
    const stack = new Stack();

    // WHEN
    const parsed = stack.parseArn(`arn:${Aws.PARTITION}:iam::123456789012:role/S3Access`);

    // THEN
    test.deepEqual(stack.resolve(parsed.partition), { Ref: 'AWS::Partition' });
    test.deepEqual(stack.resolve(parsed.service), 'iam');
    test.equal(stack.resolve(parsed.region), '');
    test.deepEqual(stack.resolve(parsed.account), '123456789012');
    test.deepEqual(stack.resolve(parsed.resource), 'role');
    test.deepEqual(stack.resolve(parsed.resourceName), 'S3Access');
    test.equal(parsed.sep, '/');

    test.done();
  },
});
