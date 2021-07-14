import { AuthorizationType } from '../graphqlapi';
import { Directive } from '../schema-base';
import { InterfaceType } from '../schema-intermediate';

/**
 * Generates an addition to the schema
 *
 * ```
 * prefix name interfaces directives {
 *   field
 *   field
 *   ...
 * }
 * ```
 */
export interface SchemaAdditionOptions {
  /**
   * the prefix for this additon (type, interface, enum, input, schema)
   */
  readonly prefix: string;
  /**
   * the name for this addition (some additions dont need this [i.e. schema])
   *
   * @default - no name
   */
  readonly name?: string;
  /**
   * the interface types if this is creating an object type
   *
   * @default - no interfaces
   */
  readonly interfaceTypes?: InterfaceType[];
  /**
   * the directives for this type
   *
   * @default - no directives
   */
  readonly directives?: Directive[];
  /**
   * the fields to reduce onto the addition
   */
  readonly fields: string[];
  /**
   * the authorization modes for this graphql type
   */
  readonly modes?: AuthorizationType[];
}

/**
 * Generates an addition to the schema
 *
 * @param options the options to produced a stringfied addition
 *
 * @returns the following shape:
 *
 * ```
 * prefix name interfaces directives {
 *   field
 *   field
 *   ...
 * }
 * ```
 */
export function shapeAddition(options: SchemaAdditionOptions): string {
  const typeName = (): string => { return options.name ? ` ${options.name}` : ''; };
  const interfaces = generateInterfaces(options.interfaceTypes);
  const directives = generateDirectives({
    directives: options.directives,
    modes: options.modes,
  });
  return options.fields.reduce((acc, field) =>
    `${acc}  ${field}\n`, `${options.prefix}${typeName()}${interfaces}${directives} {\n`) + '}';
}

/**
 * options to generate directives
 */
interface generateDirectivesOptions {
  /**
   * the directives of a given type
   */
  readonly directives?: Directive[];
  /**
   * thee separator betweeen directives
   *
   * @default - a space
   */
  readonly delimiter?: string;
  /**
   * the authorization modes
   */
  readonly modes?: AuthorizationType[];
}

/**
 * Utility function to generate interfaces for object types
 *
 * @param interfaceTypes the interfaces this object type implements
 */
function generateInterfaces(interfaceTypes?: InterfaceType[]): string {
  if (!interfaceTypes || interfaceTypes.length === 0) return '';
  return interfaceTypes.reduce((acc, interfaceType) =>
    `${acc} ${interfaceType.name} &`, ' implements').slice(0, -2);
}

/**
 * Utility function to generate directives
 */
function generateDirectives(options: generateDirectivesOptions): string {
  if (!options.directives || options.directives.length === 0) return '';
  // reduce over all directives and get string version of the directive
  // pass in the auth modes for checks to happen on compile time
  return options.directives.reduce((acc, directive) =>
    `${acc}${directive._bindToAuthModes(options.modes).toString()}${options.delimiter ?? ' '}`, ' ').slice(0, -1);
}