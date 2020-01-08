import '@aws-cdk/assert/jest';
import { App, Stack } from '@aws-cdk/core';
import { Hub } from '../lib';

describe('SecurityHub', () => {
    it('creates a Hub', () => {
        // GIVEN
        const app = new App();
        const stack = new Stack(app, 'test');

        // WHEN
        new Hub(stack, 'Hub');

        // THEN
        expect(stack).toHaveResource('AWS::SecurityHub::Hub');
    });
});