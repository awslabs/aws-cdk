import { IResource, Resource } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { CfnParameterGroup } from './elasticache.generated';

/**
 * The cache parameter group family that this cache parameter group is compatible with.
 */
export enum CacheParameterGroupFamily {
  /**
   * Memcached Version 1.4
   */
  MEMCACHED_1_4 = 'memcached1.4',
  /**
   * Memcached Version 1.5
   */
  MEMCACHED_1_5 = 'memcached1.5',
  /**
   * Memcached Version 1.6
   */
  MEMCACHED_1_6 = 'memcached1.6',
  /**
   * Redis Version 2.6
   */
  REDIS_2_6 = 'redis2.6',
  /**
   * Redis Version 2.8
   */
  REDIS_2_8 = 'redis2.8',
  /**
   * Redis Version 3.2
   */
  REDIS_3_2 = 'redis3.2',
  /**
   * Redis Version 4.0
   */
  REDIS_4_0 = 'redis4.0',
  /**
   * Redis Version 5.0
   */
  REDIS_5_0 = 'redis5.0',
  /**
   * Redis Version 6.x
   */
  REDIS_6_X = 'redis6.x',
}
/**
 * A cache parameter group
 */
export interface IParameterGroup extends IResource {
  /**
   * The name of this cache parameter group
   *
   * @attribute
   */
  readonly parameterGroupName: string;
}

/**
 * Properties for a cache parameter group
 */
export interface ParameterGroupProps {
  /**
   * Description for this parameter group
   *
   * @default a CDK generated description
   */
  readonly description?: string;

  /**
   * The properties in this parameter group
   *
   * @default undefined - no properties will be defined
   */
  readonly properties?: { [name: string]: string };

  /**
   * The parameters in this parameter group
   */
  readonly cacheParameterGroupFamily: CacheParameterGroupFamily;
}

/**
 * A ElastiCache parameter group
 *
 * @resource AWS::ElastiCache::ParameterGroup
 */
export class ParameterGroup extends Resource implements IParameterGroup {
  /**
   * Imports a parameter group
   */
  public static fromParameterGroupName(scope: Construct, id: string, parameterGroupName: string): IParameterGroup {
    class Import extends Resource implements IParameterGroup {
      public readonly parameterGroupName = parameterGroupName;
    }
    return new Import(scope, id);
  }

  /**
   * The name of the cache parameter group
   */
  public readonly parameterGroupName: string;

  constructor(scope: Construct, id: string, props: ParameterGroupProps) {
    super(scope, id);

    const resource = new CfnParameterGroup(this, 'Resource', {
      description: props.description || 'ElastiCache parameter group.',
      cacheParameterGroupFamily: props.cacheParameterGroupFamily,
      properties: props.properties,
    });

    this.parameterGroupName = resource.ref;
  }
}
