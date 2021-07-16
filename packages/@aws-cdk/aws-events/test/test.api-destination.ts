import { expect, haveResource } from '@aws-cdk/assert-internal';
import { Stack, Duration } from '@aws-cdk/core';
import { Test } from 'nodeunit';
import { ApiDestination, HttpMethod } from '../lib/api-destination';
import { AuthParameters, AuthorizationType, Connection } from '../lib/connection';


export = {
  'creates an api destination for an EventBus'(test: Test) {
    // GIVEN
    const stack = new Stack();
    const connection = new Connection(stack, 'Connection', {
      authParameters: AuthParameters.basicAuth('username', 'password'),
      connectionName: 'testConnection',
      description: 'ConnectionDescription',
    });

    // WHEN
    new ApiDestination(stack, 'ApiDestination', {
      apiDestinationName: 'ApiDestination',
      connection: connection,
      description: 'ApiDestination',
      httpMethod: HttpMethod.GET,
      invocationEndpoint: 'someendpoint',
      invocationRateLimit: Duration.seconds(60),
    });

    // THEN
    expect(stack).to(haveResource('AWS::Events::ApiDestination', {
      ConnectionArn: {
        'Fn::GetAtt': [
          'Connection07624BCD',
          'Arn',
        ],
      },
      Description: 'ApiDestination',
      HttpMethod: 'GET',
      InvocationEndpoint: 'someendpoint',
      InvocationRateLimitPerSecond: 60,
      Name: 'ApiDestination',
    }));

    test.done();
  },
}
