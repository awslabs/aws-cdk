import { AuthorizationType, GraphqlApi } from './graphqlapi';
import { shapeAddition } from './private';
import { Resolver } from './resolver';
import { Directive, IField, IIntermediateType, AddFieldOptions } from './schema-base';
import { BaseTypeOptions, GraphqlType, ResolvableFieldOptions } from './schema-field';

/**
 * Properties for configuring an Intermediate Type
 *
 * @param definition - the variables and types that define this type
 * i.e. { string: GraphqlType, string: GraphqlType }
 * @param directives - the directives for this object type
 *
 * @experimental
 */
export interface IntermediateTypeProps {
  /**
   * the attributes of this type
   */
  readonly definition: { [key: string]: IField };
  /**
   * the directives for this object type
   *
   * @default - no directives
   */
  readonly directives?: Directive[];
}

/**
 * Interface Types are abstract types that includes a certain set of fields
 * that other types must include if they implement the interface.
 *
 * @experimental
 */
export class InterfaceType implements IIntermediateType {
  /**
   * the name of this type
   */
  public readonly name: string;
  /**
   * the attributes of this type
   */
  public readonly definition: { [key: string]: IField };
  /**
   * the directives for this object type
   *
   * @default - no directives
   */
  public readonly directives?: Directive[];
  /**
   * the authorization modes for this intermediate type
   */
  protected modes?: AuthorizationType[];

  public constructor(name: string, props: IntermediateTypeProps) {
    this.name = name;
    this.definition = props.definition;
    this.directives = props.directives;
  }

  /**
   * Method called when the stringifying Intermediate Types for schema generation
   *
   * @internal
   */
  public _bindToGraphqlApi(api: GraphqlApi): IIntermediateType {
    this.modes = api.modes;
    return this;
  }

  /**
   * Create an GraphQL Type representing this Intermediate Type
   *
   * @param options the options to configure this attribute
   * - isList
   * - isRequired
   * - isRequiredList
   */
  public attribute(options?: BaseTypeOptions): GraphqlType {
    return GraphqlType.intermediate({
      isList: options?.isList,
      isRequired: options?.isRequired,
      isRequiredList: options?.isRequiredList,
      intermediateType: this,
    });
  }

  /**
   * Generate the string of this object type
   */
  public toString(): string {
    return shapeAddition({
      prefix: 'interface',
      name: this.name,
      directives: this.directives,
      fields: Object.keys(this.definition).map((key) => {
        const field = this.definition[key];
        return `${key}${field.argsToString()}: ${field.toString()}${field.directivesToString(this.modes)}`;
      }),
      modes: this.modes,
    });
  }

  /**
   * Add a field to this Interface Type.
   *
   * Interface Types must have both fieldName and field options.
   *
   * @param options the options to add a field
   */
  public addField(options: AddFieldOptions): void {
    if (!options.fieldName || !options.field) {
      throw new Error('Interface Types must have both fieldName and field options.');
    }
    this.definition[options.fieldName] = options.field;
  }
}

/**
 * Properties for configuring an Object Type
 *
 * @param definition - the variables and types that define this type
 * i.e. { string: GraphqlType, string: GraphqlType }
 * @param interfaceTypes - the interfaces that this object type implements
 * @param directives - the directives for this object type
 *
 * @experimental
 */
export interface ObjectTypeProps extends IntermediateTypeProps {
  /**
   * The Interface Types this Object Type implements
   *
   * @default - no interface types
   */
  readonly interfaceTypes?: InterfaceType[];
}

/**
 * Object Types are types declared by you.
 *
 * @experimental
 */
export class ObjectType extends InterfaceType implements IIntermediateType {
  /**
   * The Interface Types this Object Type implements
   *
   * @default - no interface types
   */
  public readonly interfaceTypes?: InterfaceType[];
  /**
   * The resolvers linked to this data source
   */
  public resolvers?: Resolver[];

  public constructor(name: string, props: ObjectTypeProps) {
    const options = {
      definition: props.interfaceTypes?.reduce((def, interfaceType) => {
        return Object.assign({}, def, interfaceType.definition);
      }, props.definition) ?? props.definition,
      directives: props.directives,
    };
    super(name, options);
    this.interfaceTypes = props.interfaceTypes;
    this.resolvers = [];

    Object.keys(this.definition).forEach((fieldName) => {
      const field = this.definition[fieldName];
      this.generateResolver(fieldName, field.fieldOptions);
    });
  }

  /**
   * Add a field to this Object Type.
   *
   * Object Types must have both fieldName and field options.
   *
   * @param options the options to add a field
   */
  public addField(options: AddFieldOptions): void {
    if (!options.fieldName || !options.field) {
      throw new Error('Object Types must have both fieldName and field options.');
    }
    this.generateResolver(options.fieldName, options.field.fieldOptions);
    this.definition[options.fieldName] = options.field;
  }

  /**
   * Generate the string of this object type
   */
  public toString(): string {
    return shapeAddition({
      prefix: 'type',
      name: this.name,
      interfaceTypes: this.interfaceTypes,
      directives: this.directives,
      fields: Object.keys(this.definition).map((key) => {
        const field = this.definition[key];
        return `${key}${field.argsToString()}: ${field.toString()}${field.directivesToString(this.modes)}`;
      }),
      modes: this.modes,
    });
  }

  /**
   * Generate the resolvers linked to this Object Type
   */
  protected generateResolver(fieldName: string, options?: ResolvableFieldOptions): void {
    if (!options?.dataSource) return;
    if (!this.resolvers) { this.resolvers = []; }
    this.resolvers.push(options.dataSource.createResolver({
      typeName: this.name,
      fieldName: fieldName,
      pipelineConfig: options.pipelineConfig,
      requestMappingTemplate: options.requestMappingTemplate,
      responseMappingTemplate: options.responseMappingTemplate,
    }));
  }
}

/**
 * Input Types are abstract types that define complex objects.
 * They are used in arguments to represent
 *
 * @experimental
 */
export class InputType implements IIntermediateType {
  /**
   * the name of this type
   */
  public readonly name: string;
  /**
   * the attributes of this type
   */
  public readonly definition: { [key: string]: IField };
  /**
   * the authorization modes for this intermediate type
   */
  protected modes?: AuthorizationType[];

  public constructor(name: string, props: IntermediateTypeProps) {
    this.name = name;
    this.definition = props.definition;
  }

  /**
   * Create an GraphQL Type representing this Input Type
   *
   * @param options the options to configure this attribute
   * - isList
   * - isRequired
   * - isRequiredList
   */
  public attribute(options?: BaseTypeOptions): GraphqlType {
    return GraphqlType.intermediate({
      isList: options?.isList,
      isRequired: options?.isRequired,
      isRequiredList: options?.isRequiredList,
      intermediateType: this,
    });
  }

  /**
   * Method called when the stringifying Intermediate Types for schema generation
   *
   * @internal
   */
  public _bindToGraphqlApi(api: GraphqlApi): IIntermediateType {
    this.modes = api.modes;
    return this;
  }

  /**
   * Generate the string of this input type
   */
  public toString(): string {
    return shapeAddition({
      prefix: 'input',
      name: this.name,
      fields: Object.keys(this.definition).map((key) =>
        `${key}${this.definition[key].argsToString()}: ${this.definition[key].toString()}`),
      modes: this.modes,
    });
  }

  /**
   * Add a field to this Input Type.
   *
   * Input Types must have both fieldName and field options.
   *
   * @param options the options to add a field
   */
  public addField(options: AddFieldOptions): void {
    if (!options.fieldName || !options.field) {
      throw new Error('Input Types must have both fieldName and field options.');
    }
    this.definition[options.fieldName] = options.field;
  }
}

/**
 * Properties for configuring an Union Type
 *
 * @props definition - the object types for this union type
 *
 * @experimental
 */
export interface UnionTypeProps {
  /**
   * the object types for this union type
   */
  readonly definition: IIntermediateType[];
}

/**
 * Union Types are abstract types that are similar to Interface Types,
 * but they don't get to specify any common fields between types.
 *
 * Note that fields of a union type need to be object types. In other words,
 * you can't create a union type out of interfaces, other unions, or inputs.
 *
 * @experimental
 */
export class UnionType implements IIntermediateType {
  /**
   * the name of this type
   */
  public readonly name: string;
  /**
   * the attributes of this type
   */
  public readonly definition: { [key: string]: IField };
  /**
   * the authorization modes for this intermediate type
   */
  protected modes?: AuthorizationType[];

  public constructor(name: string, props: UnionTypeProps) {
    this.name = name;
    this.definition = {};
    props.definition.map((def) => this.addField(def.name, def.attribute()));
  }

  /**
   * Create an GraphQL Type representing this Union Type
   *
   * @param options the options to configure this attribute
   * - isList
   * - isRequired
   * - isRequiredList
   */
  public attribute(options?: BaseTypeOptions): GraphqlType {
    return GraphqlType.intermediate({
      isList: options?.isList,
      isRequired: options?.isRequired,
      isRequiredList: options?.isRequiredList,
      intermediateType: this,
    });
  }

  /**
   * Method called when the stringifying Intermediate Types for schema generation
   *
   * @internal
   */
  public _bindToGraphqlApi(api: GraphqlApi): IIntermediateType {
    this.modes = api.modes;
    return this;
  }

  /**
   * Generate the string of this Union type
   */
  public toString(): string {
    return Object.values(this.definition).reduce((acc, field) =>
      `${acc} ${field.toString()} |`, `union ${this.name} =`).slice(0, -2);
  }

  /**
   * Add a field to this Union Type
   *
   * Input Types must have field options and the IField must be an Object Type.
   *
   * @param options the options to add a field
   */
  public addField(options: AddFieldOptions): void {
    if (!options.fieldName) {
      throw new Error('Union Types cannot be configured with the fieldName option. Use the field option instead.');
    }
    if (!options.field) {
      throw new Error('Union Types must be configured with the field option.');
    }
    if (options.field && !(options.field.intermediateType instanceof ObjectType)) {
      throw new Error('Fields for Union Types must be Object Types.');
    }
    this.definition[options.field?.toString() + 'id'] = options.field;
  }
}
