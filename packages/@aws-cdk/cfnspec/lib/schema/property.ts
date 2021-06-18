import { Documented, PrimitiveType } from './base-types';

export type Property = ScalarProperty | CollectionProperty;
export type ScalarProperty = PrimitiveProperty | ComplexProperty | UnionProperty;
export type CollectionProperty = ListProperty | MapProperty | UnionProperty;
export type ListProperty = PrimitiveListProperty | ComplexListProperty;
export type MapProperty = PrimitiveMapProperty | ComplexMapProperty;
export type ComplexMapProperty = MapOfStructs | MapOfListsOfPrimitives;
export type TagProperty = TagPropertyStandard | TagPropertyAutoScalingGroup | TagPropertyJson | TagPropertyStringMap;

export interface PropertyBase extends Documented {
  /**
   * Indicates whether the property is required.
   *
   * @default false
   */
  Required?: boolean;
  /**
   * During a stack update, the update behavior when you add, remove, or modify the property. AWS CloudFormation
   * replaces the resource when you change `Ìmmutable``properties. AWS CloudFormation doesn't replace the resource
   * when you change ``Mutable`` properties. ``Conditional`` updates can be mutable or immutable, depending on, for
   * example, which other properties you updated.
   *
   * @default UpdateType.Mutable
   */
  UpdateType?: UpdateType;

  /**
   * During a stack update, what kind of additional scrutiny changes to this property should be subjected to
   *
   * @default None
   */
  ScrutinyType?: PropertyScrutinyType;
}

export interface PrimitiveProperty extends PropertyBase {
  /** The valid primitive type for the property. */
  PrimitiveType: PrimitiveType;
}

export interface ComplexProperty extends PropertyBase {
  /** The type of valid values for this property */
  Type: string;
}

export interface ListPropertyBase extends PropertyBase {
  /**
   * A list is a comma-separated list of values.
   */
  Type: 'List';
  /**
   * Indicates whether AWS CloudFormation allows duplicate values. If the value is ``true``, AWS CloudFormation
   * ignores duplicate values. if the value is  ``false``, AWS CloudFormation returns an arror if you submit duplicate
   * values.
   */
  DuplicatesAllowed?: boolean;
}

export interface PrimitiveListProperty extends ListPropertyBase {
  /** The valid primitive type for the property. */
  PrimitiveItemType: PrimitiveType;
}

export interface ComplexListProperty extends ListPropertyBase {
  /** Valid values for the property */
  ItemType: string;
}

export interface MapPropertyBase extends PropertyBase {
  /** A map is a set of key-value pairs, where the keys are always strings. */
  Type: 'Map';
  /**
   * Indicates whether AWS CloudFormation allows duplicate values. If the value is ``true``, AWS CloudFormation
   * ignores duplicate values. if the value is  ``false``, AWS CloudFormation returns an arror if you submit duplicate
   * values.
   */
  DuplicatesAllowed?: false;
}

export interface PrimitiveMapProperty extends MapPropertyBase {
  /** The valid primitive type for the property. */
  PrimitiveItemType: PrimitiveType;
}

export interface MapOfStructs extends MapPropertyBase {
  /** Valid values for the property */
  ItemType: string;
}

export interface MapOfListsOfPrimitives extends MapPropertyBase {
  /** The type of the map values, which in this case is always 'List'. */
  ItemType: string;

  /** The valid primitive type for the lists that are the values of this map. */
  PrimitiveItemItemType: PrimitiveType;
}

export interface TagPropertyStandard extends PropertyBase {
  ItemType: 'Tag' | 'TagsEntry' | 'TagRef' | 'ElasticFileSystemTag' | 'HostedZoneTag';
  Type: 'Tags';
}

export interface TagPropertyAutoScalingGroup extends PropertyBase {
  ItemType: 'TagProperty';
}

export interface TagPropertyJson extends PropertyBase {
  PrimitiveType: PrimitiveType.Json;
}

export interface TagPropertyStringMap extends PropertyBase {
  PrimitiveItemType: 'String';
}

/**
 * A property type that can be one of several types. Currently used only in SAM.
 */
export interface UnionProperty extends PropertyBase {
  /** Valid primitive types for the property */
  PrimitiveTypes?: PrimitiveType[];
  /** Valid complex types for the property */
  Types?: string[]
  /** Valid primitive item types for this property */
  PrimitiveItemTypes?: PrimitiveType[];
  /** Valid list item types for the property */
  ItemTypes?: string[];
}

export enum UpdateType {
  Conditional = 'Conditional',
  Immutable = 'Immutable',
  Mutable = 'Mutable'
}

export function isUpdateType(str: string): str is UpdateType {
  switch (str) {
    case UpdateType.Conditional:
    case UpdateType.Immutable:
    case UpdateType.Mutable:
      return true;
    default:
      return false;
  }
}

export function isScalarProperty(prop: Property): prop is ScalarProperty {
  return isPrimitiveProperty(prop)
    || isComplexProperty(prop)
    // A UnionProperty is only Scalar if it defines Types or PrimitiveTypes
    || (isUnionProperty(prop) && !!(prop.Types || prop.PrimitiveTypes));
}

export function isPrimitiveProperty(prop: Property): prop is PrimitiveProperty {
  return !!(prop as PrimitiveProperty).PrimitiveType;
}

export function isComplexProperty(prop: Property): prop is ComplexProperty {
  const propType = (prop as ComplexProperty).Type;
  return propType != null && propType !== 'Map' && propType !== 'List';
}

export function isCollectionProperty(prop: Property): prop is CollectionProperty {
  return isListProperty(prop)
    || isMapProperty(prop)
    // A UnionProperty is only Collection if it defines ItemTypes or PrimitiveItemTypes
    || (isUnionProperty(prop) && !!(prop.ItemTypes || prop.PrimitiveItemTypes));
}

export function isListProperty(prop: Property): prop is ListProperty {
  return (prop as ListProperty).Type === 'List';
}

export function isPrimitiveListProperty(prop: Property): prop is PrimitiveListProperty {
  return isListProperty(prop) && !!(prop as PrimitiveListProperty).PrimitiveItemType;
}

export function isComplexListProperty(prop: Property): prop is ComplexListProperty {
  return isListProperty(prop) && !!(prop as ComplexListProperty).ItemType;
}

export function isMapProperty(prop: Property): prop is MapProperty {
  return (prop as MapProperty).Type === 'Map';
}

export function isPrimitiveMapProperty(prop: Property): prop is PrimitiveMapProperty {
  return isMapProperty(prop) && !!(prop as PrimitiveMapProperty).PrimitiveItemType;
}

export function isMapOfStructsProperty(prop: Property): prop is MapOfStructs {
  return isMapProperty(prop) &&
    !isPrimitiveMapProperty(prop) &&
    !isMapOfListsOfPrimitivesProperty(prop);
}

// note: this (and the MapOfListsOfPrimitives type) are not actually valid in the CFN spec!
// they are only here to support our patch of the CFN spec
// to alleviate https://github.com/aws/aws-cdk/issues/3092
export function isMapOfListsOfPrimitivesProperty(prop: Property): prop is MapOfListsOfPrimitives {
  return isMapProperty(prop) && (prop as ComplexMapProperty).ItemType === 'List';
}

export function isUnionProperty(prop: Property): prop is UnionProperty {
  const castProp = prop as UnionProperty;
  return !!(castProp.ItemTypes || castProp.PrimitiveTypes || castProp.Types);
}

export enum PropertyScrutinyType {
  /**
   * No additional scrutiny
   */
  None = 'None',

  /**
   * This is an IAM policy directly on a resource
   */
  InlineResourcePolicy = 'InlineResourcePolicy',

  /**
   * Either an AssumeRolePolicyDocument or a dictionary of policy documents
   */
  InlineIdentityPolicies = 'InlineIdentityPolicies',

  /**
   * A list of managed policies (on an identity resource)
   */
  ManagedPolicies = 'ManagedPolicies',

  /**
   * A set of ingress rules (on a security group)
   */
  IngressRules = 'IngressRules',

  /**
   * A set of egress rules (on a security group)
   */
  EgressRules = 'EgressRules',
}

export function isPropertyScrutinyType(str: string): str is PropertyScrutinyType {
  return (PropertyScrutinyType as any)[str] !== undefined;
}

const tagPropertyNames = {
  FileSystemTags: '',
  HostedZoneTags: '',
  Tags: '',
  UserPoolTags: '',
};

export type TagPropertyName = keyof typeof tagPropertyNames;

export function isTagPropertyName(name?: string): name is TagPropertyName {
  if (undefined === name) {
    return false;
  }
  return tagPropertyNames.hasOwnProperty(name);
}
/**
 * This function validates that the property **can** be a Tag Property
 *
 * The property is only a Tag if the name of this property is Tags, which is
 * validated using `ResourceType.isTaggable(resource)`.
 */
export function isTagProperty(prop: Property): prop is TagProperty {
  return (
    isTagPropertyStandard(prop) ||
    isTagPropertyAutoScalingGroup(prop) ||
    isTagPropertyJson(prop) ||
    isTagPropertyStringMap(prop)
  );
}

export function isTagPropertyStandard(prop: Property): prop is TagPropertyStandard {
  return (
    (prop as TagPropertyStandard).ItemType === 'Tag' ||
    (prop as TagPropertyStandard).ItemType === 'TagsEntry' ||
    (prop as TagPropertyStandard).Type === 'Tags' ||
    (prop as TagPropertyStandard).ItemType === 'TagRef' ||
    (prop as TagPropertyStandard).ItemType === 'ElasticFileSystemTag' ||
    (prop as TagPropertyStandard).ItemType === 'HostedZoneTag'
  );
}

export function isTagPropertyAutoScalingGroup(prop: Property): prop is TagPropertyAutoScalingGroup {
  return (prop as TagPropertyAutoScalingGroup).ItemType === 'TagProperty';
}

export function isTagPropertyJson(prop: Property): prop is TagPropertyJson {
  return (prop as TagPropertyJson).PrimitiveType === PrimitiveType.Json;
}

export function isTagPropertyStringMap(prop: Property): prop is TagPropertyStringMap {
  return (prop as TagPropertyStringMap).PrimitiveItemType === 'String';
}
