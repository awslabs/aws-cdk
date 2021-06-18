import * as cxschema from '@aws-cdk/cloud-assembly-schema';
import * as cxapi from '@aws-cdk/cx-api';
import { SdkProvider } from '../api';
import { replaceEnvPlaceholders } from '../api/cloudformation-deployments';
import { debug } from '../logging';
import { Context, TRANSIENT_CONTEXT_KEY } from '../settings';
import { AmiContextProviderPlugin } from './ami';
import { AZContextProviderPlugin } from './availability-zones';
import { EndpointServiceAZContextProviderPlugin } from './endpoint-service-availability-zones';
import { HostedZoneContextProviderPlugin } from './hosted-zones';
import { LoadBalancerContextProviderPlugin, LoadBalancerListenerContextProviderPlugin } from './load-balancers';
import { ContextProviderPlugin } from './provider';
import { SecurityGroupContextProviderPlugin } from './security-groups';
import { SSMContextProviderPlugin } from './ssm-parameters';
import { VpcNetworkContextProviderPlugin } from './vpcs';

type ProviderConstructor = (new (sdk: SdkProvider, lookupRoleArn?: string) => ContextProviderPlugin);
export type ProviderMap = {[name: string]: ProviderConstructor};

/**
 * Iterate over the list of missing context values and invoke the appropriate providers from the map to retrieve them
 */
export async function provideContextValues(
    missingValues: cxschema.MissingContext[],
    context: Context,
    sdk: SdkProvider) {
  for (const missingContext of missingValues) {
    const key = missingContext.key;
    const constructor = availableContextProviders[missingContext.provider];
    if (!constructor) {
      // eslint-disable-next-line max-len
      throw new Error(`Unrecognized context provider name: ${missingContext.provider}. You might need to update the toolkit to match the version of the construct library.`);
    }

    const provider = new constructor(sdk);

    let value;
    try {
      const environment = cxapi.EnvironmentUtils.make(missingContext.props.account, missingContext.props.region);
      const resolvedEnvironment = await sdk.resolveEnvironment(environment);

      const arns = await replaceEnvPlaceholders({
        lookupRoleArn: missingContext.props.lookupRoleArn,
      }, resolvedEnvironment, sdk);

      value = await provider.getValue({ ...missingContext.props, lookupRoleArn: arns.lookupRoleArn });
    } catch (e) {
      // Set a specially formatted provider value which will be interpreted
      // as a lookup failure in the toolkit.
      value = { [cxapi.PROVIDER_ERROR_KEY]: e.message, [TRANSIENT_CONTEXT_KEY]: true };
    }
    context.set(key, value);
    debug(`Setting "${key}" context to ${JSON.stringify(value)}`);
  }
}

/**
 * Register a context provider
 *
 * (Only available for testing right now).
 */
export function registerContextProvider(name: string, provider: ProviderConstructor) {
  availableContextProviders[name] = provider;
}

const availableContextProviders: ProviderMap = {
  [cxschema.ContextProvider.AVAILABILITY_ZONE_PROVIDER]: AZContextProviderPlugin,
  [cxschema.ContextProvider.SSM_PARAMETER_PROVIDER]: SSMContextProviderPlugin,
  [cxschema.ContextProvider.HOSTED_ZONE_PROVIDER]: HostedZoneContextProviderPlugin,
  [cxschema.ContextProvider.VPC_PROVIDER]: VpcNetworkContextProviderPlugin,
  [cxschema.ContextProvider.AMI_PROVIDER]: AmiContextProviderPlugin,
  [cxschema.ContextProvider.ENDPOINT_SERVICE_AVAILABILITY_ZONE_PROVIDER]: EndpointServiceAZContextProviderPlugin,
  [cxschema.ContextProvider.SECURITY_GROUP_PROVIDER]: SecurityGroupContextProviderPlugin,
  [cxschema.ContextProvider.LOAD_BALANCER_PROVIDER]: LoadBalancerContextProviderPlugin,
  [cxschema.ContextProvider.LOAD_BALANCER_LISTENER_PROVIDER]: LoadBalancerListenerContextProviderPlugin,
};
