import { Token, TokenComparison } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { CfnVirtualNode } from '../appmesh.generated';
import { GrpcGatewayRouteMatch } from '../gateway-route-spec';
import { HeaderMatch } from '../header-match';
import { ListenerTlsOptions } from '../listener-tls-options';
import { QueryParameterMatch } from '../query-parameter-match';
import { GrpcRouteMatch } from '../route-spec';
import { TlsClientPolicy } from '../tls-client-policy';

/**
 * Generated Connection pool config
 */
export interface ConnectionPoolConfig {
  /**
   * The maximum connections in the pool
   *
   * @default - none
   */
  readonly maxConnections?: number;

  /**
   * The maximum pending requests in the pool
   *
   * @default - none
   */
  readonly maxPendingRequests?: number;

  /**
   * The maximum requests in the pool
   *
   * @default - none
   */
  readonly maxRequests?: number;
}

/**
 * This is the helper method to render TLS property of client policy.
 */
export function renderTlsClientPolicy(scope: Construct, tlsClientPolicy: TlsClientPolicy | undefined)
  : CfnVirtualNode.ClientPolicyTlsProperty | undefined {
  const certificate = tlsClientPolicy?.mutualTlsCertificate?.bind(scope).tlsCertificate;
  const sans = tlsClientPolicy?.validation.subjectAlternativeNames;

  return tlsClientPolicy
    ? {
      certificate: certificate,
      ports: tlsClientPolicy.ports,
      enforce: tlsClientPolicy.enforce,
      validation: {
        subjectAlternativeNames: sans
          ? {
            match: sans.bind(scope).subjectAlternativeNamesMatch,
          }
          : undefined,
        trust: tlsClientPolicy.validation.trust.bind(scope).tlsValidationTrust,
      },
    }
    : undefined;
}

/**
 * This is the helper method to render the TLS config for a listener.
 */
export function renderListenerTlsOptions(scope: Construct, listenerTls: ListenerTlsOptions | undefined)
  : CfnVirtualNode.ListenerTlsProperty | undefined {
  const tlsValidation = listenerTls?.mutualTlsValidation;

  return listenerTls
    ? {
      certificate: listenerTls.certificate.bind(scope).tlsCertificate,
      mode: listenerTls.mode,
      validation: tlsValidation
        ? {
          subjectAlternativeNames: tlsValidation.subjectAlternativeNames
            ? {
              match: tlsValidation.subjectAlternativeNames.bind(scope).subjectAlternativeNamesMatch,
            }
            : undefined,
          trust: tlsValidation.trust.bind(scope).tlsValidationTrust,
        }
        : undefined,
    }
    : undefined;
}

/**
 * This is the helper method to populate mesh owner when it is a shared mesh scenario
 */
export function renderMeshOwner(resourceAccount: string, meshAccount: string) : string | undefined {
  const comparison = Token.compareStrings(resourceAccount, meshAccount);
  return comparison === TokenComparison.DIFFERENT || comparison === TokenComparison.ONE_UNRESOLVED
    ? meshAccount
    : undefined;
}

/**
 * This is the helper method to validate the length of HTTP match array when it is specified.
 */
export function validateHttpMatchArrayLength(headers?: HeaderMatch[], queryParameters?: QueryParameterMatch[]) {
  const MIN_LENGTH = 1;
  const MAX_LENGTH = 10;

  if (headers && (headers.length < MIN_LENGTH || headers.length > MAX_LENGTH)) {
    throw new Error(`Number of headers provided for matching must be between ${MIN_LENGTH} and ${MAX_LENGTH}, got: ${headers.length}`);
  }

  if (queryParameters && (queryParameters.length < MIN_LENGTH || queryParameters.length > MAX_LENGTH)) {
    throw new Error(`Number of query parameters provided for matching must be between ${MIN_LENGTH} and ${MAX_LENGTH}, got: ${queryParameters.length}`);
  }
}

/**
 * This is the helper method to validate the length of gRPC match array when it is specified.
 */
export function validateGrpcMatchArrayLength(metadata?: HeaderMatch[]): void {
  const MIN_LENGTH = 1;
  const MAX_LENGTH = 10;

  if (metadata && (metadata.length < MIN_LENGTH || metadata.length > MAX_LENGTH)) {
    throw new Error(`Number of metadata provided for matching must be between ${MIN_LENGTH} and ${MAX_LENGTH}, got: ${metadata.length}`);
  }
}

/**
 * This is the helper method to validate at least one of gRPC route match type is defined.
 */
export function validateGrpcRouteMatch(match: GrpcRouteMatch): void {
  if (match.serviceName === undefined && match.metadata === undefined && match.methodName === undefined) {
    throw new Error('At least one gRPC route match property must be provided');
  }
}

/**
 * This is the helper method to validate at least one of gRPC gateway route match type is defined.
 */
export function validateGrpcGatewayRouteMatch(match: GrpcGatewayRouteMatch): void {
  if (match.serviceName === undefined && match.metadata === undefined && match.hostname === undefined) {
    throw new Error('At least one gRPC gateway route match property beside rewriteRequestHostname must be provided');
  }
}
