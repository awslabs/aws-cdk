import { Fn } from './cfn-fn';
import { Stack } from './stack';
import { Token } from './token';
import { filterUndefined } from './util';

/**
 * An enum representing the various ARN formats that different services use.
 */
export enum ArnFormat {
  /**
   * This represents a format where there is no 'resourceName' part.
   * This format is used for S3 resources,
   * like 'arn:aws:s3:::bucket'.
   * Everything after the last colon is considered the 'resource',
   * even if it contains slashes,
   * like in 'arn:aws:s3:::bucket/object.zip'.
   */
  NO_RESOURCE_NAME = 'arn:aws:service:region:account:resource',

  /**
   * This represents a format where the 'resource' and 'resourceName'
   * parts are separated with a colon.
   * Like in: 'arn:aws:service:region:account:resource:resourceName'.
   * Everything after the last colon is considered the 'resourceName',
   * even if it contains slashes,
   * like in 'arn:aws:apigateway:region:account:resource:/test/mydemoresource/*'.
   */
  COLON_RESOURCE_NAME = 'arn:aws:service:region:account:resource:resourceName',

  /**
   * This represents a format where the 'resource' and 'resourceName'
   * parts are separated with a slash.
   * Like in: 'arn:aws:service:region:account:resource/resourceName'.
   * Everything after the separating slash is considered the 'resourceName',
   * even if it contains colons,
   * like in 'arn:aws:cognito-sync:region:account:identitypool/us-east-1:1a1a1a1a-ffff-1111-9999-12345678:bla'.
   */
  SLASH_RESOURCE_NAME = 'arn:aws:service:region:account:resource/resourceName',

  /**
   * This represents a format where the 'resource' and 'resourceName'
   * parts are seperated with a slash,
   * but there is also an additional slash after the colon separating 'account' from 'resource'.
   * Like in: 'arn:aws:service:region:account:/resource/resourceName'.
   * Note that the leading slash is _not_ included in the parsed 'resource' part.
   */
  SLASH_RESOURCE_SLASH_RESOURCE_NAME = 'arn:aws:service:region:account:/resource/resourceName',
}

export interface ArnComponents {
  /**
   * The partition that the resource is in. For standard AWS regions, the
   * partition is aws. If you have resources in other partitions, the
   * partition is aws-partitionname. For example, the partition for resources
   * in the China (Beijing) region is aws-cn.
   *
   * @default The AWS partition the stack is deployed to.
   */
  readonly partition?: string;

  /**
   * The service namespace that identifies the AWS product (for example,
   * 's3', 'iam', 'codepipline').
   */
  readonly service: string;

  /**
   * The region the resource resides in. Note that the ARNs for some resources
   * do not require a region, so this component might be omitted.
   *
   * @default The region the stack is deployed to.
   */
  readonly region?: string;

  /**
   * The ID of the AWS account that owns the resource, without the hyphens.
   * For example, 123456789012. Note that the ARNs for some resources don't
   * require an account number, so this component might be omitted.
   *
   * @default The account the stack is deployed to.
   */
  readonly account?: string;

  /**
   * Resource type (e.g. "table", "autoScalingGroup", "certificate").
   * For some resource types, e.g. S3 buckets, this field defines the bucket name.
   */
  readonly resource: string;

  /**
   * Separator between resource type and the resource.
   *
   * Can be either '/', ':' or an empty string. Will only be used if resourceName is defined.
   * @default '/'
   *
   * @deprecated use arnFormat instead
   */
  readonly sep?: string;

  /**
   * Resource name or path within the resource (i.e. S3 bucket object key) or
   * a wildcard such as ``"*"``. This is service-dependent.
   */
  readonly resourceName?: string;

  /**
   * The specific ARN format to use for this ARN value.
   *
   * @default - uses value of `sep` as the separator for formatting,
   *   `ArnFormat.SLASH_RESOURCE_NAME` if that property was also not provided
   */
  readonly arnFormat?: ArnFormat;
}

export class Arn {
  /**
   * Creates an ARN from components.
   *
   * If `partition`, `region` or `account` are not specified, the stack's
   * partition, region and account will be used.
   *
   * If any component is the empty string, an empty string will be inserted
   * into the generated ARN at the location that component corresponds to.
   *
   * The ARN will be formatted as follows:
   *
   *   arn:{partition}:{service}:{region}:{account}:{resource}{sep}{resource-name}
   *
   * The required ARN pieces that are omitted will be taken from the stack that
   * the 'scope' is attached to. If all ARN pieces are supplied, the supplied scope
   * can be 'undefined'.
   */
  public static format(components: ArnComponents, stack: Stack): string {
    const partition = components.partition ?? stack.partition;
    const region = components.region ?? stack.region;
    const account = components.account ?? stack.account;
    const sep = components.sep ?? (components.arnFormat === ArnFormat.COLON_RESOURCE_NAME ? ':' : '/');

    const values = [
      'arn', ':', partition, ':', components.service, ':', region, ':', account, ':',
      ...(components.arnFormat === ArnFormat.SLASH_RESOURCE_SLASH_RESOURCE_NAME ? ['/'] : []),
      components.resource,
    ];

    if (sep !== '/' && sep !== ':' && sep !== '') {
      throw new Error('resourcePathSep may only be ":", "/" or an empty string');
    }

    if (components.resourceName != null) {
      values.push(sep);
      values.push(components.resourceName);
    }

    return values.join('');
  }

  /**
   * Given an ARN, parses it and returns components.
   *
   * IF THE ARN IS A CONCRETE STRING...
   *
   * ...it will be parsed and validated. The separator (`sep`) will be set to '/'
   * if the 6th component includes a '/', in which case, `resource` will be set
   * to the value before the '/' and `resourceName` will be the rest. In case
   * there is no '/', `resource` will be set to the 6th components and
   * `resourceName` will be set to the rest of the string.
   *
   * IF THE ARN IS A TOKEN...
   *
   * ...it cannot be validated, since we don't have the actual value yet at the
   * time of this function call. You will have to supply `sepIfToken` and
   * whether or not ARNs of the expected format usually have resource names
   * in order to parse it properly. The resulting `ArnComponents` object will
   * contain tokens for the subexpressions of the ARN, not string literals.
   *
   * If the resource name could possibly contain the separator char, the actual
   * resource name cannot be properly parsed. This only occurs if the separator
   * char is '/', and happens for example for S3 object ARNs, IAM Role ARNs,
   * IAM OIDC Provider ARNs, etc. To properly extract the resource name from a
   * Tokenized ARN, you must know the resource type and call
   * `Arn.extractResourceName`.
   *
   * @param arn The ARN to parse
   * @param sepIfToken The separator used to separate resource from resourceName
   * @param hasName Whether there is a name component in the ARN at all. For
   * example, SNS Topics ARNs have the 'resource' component contain the topic
   * name, and no 'resourceName' component.
   *
   * @returns an ArnComponents object which allows access to the various
   * components of the ARN.
   *
   * @returns an ArnComponents object which allows access to the various
   *      components of the ARN.
   *
   * @deprecated use split instead
   */
  public static parse(arn: string, sepIfToken: string = '/', hasName: boolean = true): ArnComponents {
    let arnFormat: ArnFormat;
    if (!hasName) {
      arnFormat = ArnFormat.NO_RESOURCE_NAME;
    } else {
      arnFormat = sepIfToken === '/' ? ArnFormat.SLASH_RESOURCE_NAME : ArnFormat.COLON_RESOURCE_NAME;
    }
    return this.split(arn, arnFormat);
  }

  /**
   * Splits the provided ARN into its components.
   * Works both if 'arn' is a string like 'arn:aws:s3:::bucket',
   * and a Token representing a dynamic CloudFormation expression
   * (in which case the returned components will also be dynamic CloudFormation expressions,
   * encoded as Tokens).
   *
   * @param arn the ARN to split into its components
   * @param arnFormat the expected format of 'arn' - depends on what format the service 'arn' represents uses
   */
  public static split(arn: string, arnFormat: ArnFormat): ArnComponents {
    const components = parseArnShape(arn);
    if (components === 'token') {
      return parseTokenArn(arn, arnFormat);
    }

    const [, partition, service, region, account, resourceTypeOrName, ...rest] = components;

    let resource: string;
    let resourceName: string | undefined;
    let sep: string | undefined;
    let resourcePartStartIndex = 0;
    let detectedArnFormat: ArnFormat;

    let slashIndex = resourceTypeOrName.indexOf('/');
    if (slashIndex === 0) {
      // new-style ARNs are of the form 'arn:aws:s4:us-west-1:12345:/resource-type/resource-name'
      slashIndex = resourceTypeOrName.indexOf('/', 1);
      resourcePartStartIndex = 1;
      detectedArnFormat = ArnFormat.SLASH_RESOURCE_SLASH_RESOURCE_NAME;
    }
    if (slashIndex !== -1) {
      // the slash is only a separator if ArnFormat is not NO_RESOURCE_NAME
      if (arnFormat === ArnFormat.NO_RESOURCE_NAME) {
        sep = undefined;
        slashIndex = -1;
        detectedArnFormat = ArnFormat.NO_RESOURCE_NAME;
      } else {
        sep = '/';
        detectedArnFormat = resourcePartStartIndex === 0
          ? ArnFormat.SLASH_RESOURCE_NAME
          // need to repeat this here, as otherwise the compiler thinks 'detectedArnFormat' is not initialized in all paths
          : ArnFormat.SLASH_RESOURCE_SLASH_RESOURCE_NAME;
      }
    } else if (rest.length > 0) {
      sep = ':';
      slashIndex = -1;
      detectedArnFormat = ArnFormat.COLON_RESOURCE_NAME;
    } else {
      sep = undefined;
      detectedArnFormat = ArnFormat.NO_RESOURCE_NAME;
    }

    if (slashIndex !== -1) {
      resource = resourceTypeOrName.substring(resourcePartStartIndex, slashIndex);
      resourceName = resourceTypeOrName.substring(slashIndex + 1);
    } else {
      resource = resourceTypeOrName;
    }

    if (rest.length > 0) {
      if (!resourceName) {
        resourceName = '';
      } else {
        resourceName += ':';
      }

      resourceName += rest.join(':');
    }

    // "|| undefined" will cause empty strings to be treated as "undefined".
    // Optional ARN attributes (e.g. region, account) should return as empty string
    // if they are provided as such.
    return filterUndefined({
      service: service || undefined,
      resource: resource || undefined,
      partition: partition || undefined,
      region,
      account,
      resourceName,
      sep,
      arnFormat: detectedArnFormat,
    });
  }

  /**
   * Extract the full resource name from an ARN
   *
   * Necessary for resource names (paths) that may contain the separator, like
   * `arn:aws:iam::111111111111:role/path/to/role/name`.
   *
   * Only works if we statically know the expected `resourceType` beforehand, since we're going
   * to use that to split the string on ':<resourceType>/' (and take the right-hand side).
   *
   * We can't extract the 'resourceType' from the ARN at hand, because CloudFormation Expressions
   * only allow literals in the 'separator' argument to `{ Fn::Split }`, and so it can't be
   * `{ Fn::Select: [5, { Fn::Split: [':', ARN] }}`.
   *
   * Only necessary for ARN formats for which the type-name separator is `/`.
   */
  public static extractResourceName(arn: string, resourceType: string): string {
    const components = parseArnShape(arn);
    if (components === 'token') {
      return Fn.select(1, Fn.split(`:${resourceType}/`, arn));
    }

    // Apparently we could just parse this right away. Validate that we got the right
    // resource type (to notify authors of incorrect assumptions right away).
    const parsed = Arn.parse(arn, '/', true);
    if (!Token.isUnresolved(parsed.resource) && parsed.resource !== resourceType) {
      throw new Error(`Expected resource type '${resourceType}' in ARN, got '${parsed.resource}' in '${arn}'`);
    }
    if (!parsed.resourceName) {
      throw new Error(`Expected resource name in ARN, didn't find one: '${arn}'`);
    }
    return parsed.resourceName;
  }

  private constructor() { }
}

/**
 * Given a Token evaluating to ARN, parses it and returns components.
 *
 * The ARN cannot be validated, since we don't have the actual value yet
 * at the time of this function call. You will have to know the separator
 * and the type of ARN.
 *
 * The resulting `ArnComponents` object will contain tokens for the
 * subexpressions of the ARN, not string literals.
 *
 * WARNING: this function cannot properly parse the complete final
 * 'resourceName' part if it contains colons,
 * like 'arn:aws:cognito-sync:region:account:identitypool/us-east-1:1a1a1a1a-ffff-1111-9999-12345678:bla'.
 *
 * @param arnToken The input token that contains an ARN
 * @param arnFormat the expected format of 'arn' - depends on what format the service the ARN represents uses
 */
function parseTokenArn(arnToken: string, arnFormat: ArnFormat): ArnComponents {
  // ARN looks like:
  // arn:partition:service:region:account:resource
  // arn:partition:service:region:account:resource:resourceName
  // arn:partition:service:region:account:resource/resourceName
  // arn:partition:service:region:account:/resource/resourceName

  const components = Fn.split(':', arnToken);

  const partition = Fn.select(1, components).toString();
  const service = Fn.select(2, components).toString();
  const region = Fn.select(3, components).toString();
  const account = Fn.select(4, components).toString();
  let resource: string;
  let resourceName: string | undefined;
  let sep: string | undefined;

  if (arnFormat === ArnFormat.NO_RESOURCE_NAME || arnFormat === ArnFormat.COLON_RESOURCE_NAME) {
    // we know that the 'resource' part will always be the 6th segment in this case
    resource = Fn.select(5, components);
    if (arnFormat === ArnFormat.COLON_RESOURCE_NAME) {
      resourceName = Fn.select(6, components);
      sep = ':';
    } else {
      resourceName = undefined;
      sep = undefined;
    }
  } else {
    // we know that the 'resource' and 'resourceName' parts are separated by slash here,
    // so we split the 6th segment from the colon-separated ones with a slash
    const lastComponents = Fn.split('/', Fn.select(5, components));

    if (arnFormat === ArnFormat.SLASH_RESOURCE_NAME) {
      resource = Fn.select(0, lastComponents);
      resourceName = Fn.select(1, lastComponents);
    } else {
      // arnFormat is ArnFormat.SLASH_RESOURCE_SLASH_RESOURCE_NAME,
      // which means there's an extra slash there at the beginning that we need to skip
      resource = Fn.select(1, lastComponents);
      resourceName = Fn.select(2, lastComponents);
    }
    sep = '/';
  }

  return { partition, service, region, account, resource, resourceName, sep, arnFormat };
}

/**
 * Validate that a string is either unparseable or looks mostly like an ARN
 */
function parseArnShape(arn: string): 'token' | string[] {
  // assume anything that starts with 'arn:' is an ARN,
  // so we can report better errors
  const looksLikeArn = arn.startsWith('arn:');

  if (!looksLikeArn) {
    if (Token.isUnresolved(arn)) {
      return 'token';
    } else {
      throw new Error(`ARNs must start with "arn:" and have at least 6 components: ${arn}`);
    }
  }

  // If the ARN merely contains Tokens, but otherwise *looks* mostly like an ARN,
  // it's a string of the form 'arn:${partition}:service:${region}:${account}:resource/xyz'.
  // Parse fields out to the best of our ability.
  // Tokens won't contain ":", so this won't break them.
  const components = arn.split(':');

  // const [/* arn */, partition, service, /* region */ , /* account */ , resource] = components;

  const partition = components.length > 1 ? components[1] : undefined;
  if (!partition) {
    throw new Error('The `partition` component (2nd component) of an ARN is required: ' + arn);
  }

  const service = components.length > 2 ? components[2] : undefined;
  if (!service) {
    throw new Error('The `service` component (3rd component) of an ARN is required: ' + arn);
  }

  const resource = components.length > 5 ? components[5] : undefined;
  if (!resource) {
    throw new Error('The `resource` component (6th component) of an ARN is required: ' + arn);
  }

  // Region can be missing in global ARNs (such as used by IAM)

  // Account can be missing in some ARN types (such as used for S3 buckets)

  return components;
}
