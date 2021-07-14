import { AuthorizationType, GraphqlApi } from './graphqlapi';
import { IGraphqlApi } from './graphqlapi-base';
import { shapeAddition } from './private/schema-shape-addition';
import { Resolver } from './resolver';
import { Directive, IField, IIntermediateType, AddFieldOptions } from './schema-base';
import { BaseTypeOptions, GraphqlType, ResolvableFieldOptions, ResolvableField } from './schema-field';

/**
 * Properties for configuring an Intermediate Type
 *
 * @param definition - the variables and types that define this type
 * i.e. { string: GraphqlType, string: GraphqlType }
 * @param directives - the directives for this object type
 *
 */
export interface IntermediateTypeOptions {
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

  public constructor(name: string, props: IntermediateTypeOptions) {
    this.name = name;
    this.definition = props.definition;
    this.directives = props.directives;
  }

  /**
   * Create a GraphQL Type representing this Intermediate Type
   *
   * @param options the options to configure this attribute
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

  /**
   * Method called when the stringifying Intermediate Types for schema generation
   *
   * @internal
   */
  public _bindToGraphqlApi(api: GraphqlApi): IIntermediateType {
    this.modes = api.modes;
    return this;
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
 */
export interface ObjectTypeOptions extends IntermediateTypeOptions {
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

  public constructor(name: string, props: ObjectTypeOptions) {
    const options = {
      definition: props.interfaceTypes?.reduce((def, interfaceType) => {
        return Object.assign({}, def, interfaceType.definition);
      }, props.definition) ?? props.definition,
      directives: props.directives,
    };
    super(name, options);
    this.interfaceTypes = props.interfaceTypes;
    this.resolvers = [];
  }

  /**
   * Method called when the stringifying Intermediate Types for schema generation
   *
   * @internal
   */
  public _bindToGraphqlApi(api: GraphqlApi): IIntermediateType {
    this.modes = api.modes;
    // If the resolvers have been generated, skip the bind
    if (this.resolvers && this.resolvers.length > 0) {
      return this;
    }
    Object.keys(this.definition).forEach((fieldName) => {
      const field = this.definition[fieldName];
      if (field instanceof ResolvableField) {
        if (!this.resolvers) this.resolvers = [];
        this.resolvers.push(this.generateResolver(api, fieldName, field.fieldOptions));
      }
    });
    return this;
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
  protected generateResolver(api: IGraphqlApi, fieldName: string, options?: ResolvableFieldOptions): Resolver {
    return api.createResolver({
      typeName: this.name,
      fieldName: fieldName,
      dataSource: options?.dataSource,
      pipelineConfig: options?.pipelineConfig,
      requestMappingTemplate: options?.requestMappingTemplate,
      responseMappingTemplate: options?.responseMappingTemplate,
    });
  }
}

/**
 * Input Types are abstract types that define complex objects.
 * They are used in arguments to represent
 *
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

  public constructor(name: string, props: IntermediateTypeOptions) {
    this.name = name;
    this.definition = props.definition;
  }

  /**
   * Create a GraphQL Type representing this Input Type
   *
   * @param options the options to configure this attribute
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

  /**
   * Method called when the stringifying Intermediate Types for schema generation
   *
   * @internal
   */
  public _bindToGraphqlApi(api: GraphqlApi): IIntermediateType {
    this.modes = api.modes;
    return this;
  }
}

/**
 * Properties for configuring an Union Type
 *
 */
export interface UnionTypeOptions {
  /**
   * the object types for this union type
   */
  readonly definition: IIntermediateType[];
}

/**
 * Union Types are abstract types that are similar to Interface Types,
 * but they cannot to specify any common fields between types.
 *
 * Note that fields of a union type need to be object types. In other words,
 * you can't create a union type out of interfaces, other unions, or inputs.
 *
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
   * the authorization modes supported by this intermediate type
   */
  protected modes?: AuthorizationType[];

  public constructor(name: string, options: UnionTypeOptions) {
    this.name = name;
    this.definition = {};
    options.definition.map((def) => this.addField({ field: def.attribute() }));
  }

  /**
   * Create a GraphQL Type representing this Union Type
   *
   * @param options the options to configure this attribute
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
   * Generate the string of this Union type
   */
  public toString(): string {
    // Return a string that appends all Object Types for this Union Type
    // i.e. 'union Example = example1 | example2'
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
    if (options.fieldName) {
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

  /**
   * Method called when the stringifying Intermediate Types for schema generation
   *
   * @internal
   */
  public _bindToGraphqlApi(api: GraphqlApi): IIntermediateType {
    this.modes = api.modes;
    return this;
  }
}

/**
 * Properties for configuring an Enum Type
 *
 */
export interface EnumTypeOptions {
  /**
   * the attributes of this type
   */
  readonly definition: string[];
}

/**
 * Enum Types are abstract types that includes a set of fields
 * that represent the strings this type can create.
 *
 */
export class EnumType implements IIntermediateType {
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

  public constructor(name: string, options: EnumTypeOptions) {
    this.name = name;
    this.definition = {};
    options.definition.map((fieldName: string) => this.addField({ fieldName }));
  }

  /**
   * Create an GraphQL Type representing this Enum Type
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
   * Generate the string of this enum type
   */
  public toString(): string {
    return shapeAddition({
      prefix: 'enum',
      name: this.name,
      fields: Object.keys(this.definition),
      modes: this.modes,
    });
  }

  /**
   * Add a field to this Enum Type
   *
   * To add a field to this Enum Type, you must only configure
   * addField with the fieldName options.
   *
   * @param options the options to add a field
   */
  public addField(options: AddFieldOptions): void {
    if (options.field) {
      throw new Error('Enum Type fields consist of strings. Use the fieldName option instead of the field option.');
    }
    if (!options.fieldName) {
      throw new Error('When adding a field to an Enum Type, you must configure the fieldName option.');
    }
    if (options.fieldName.indexOf(' ') > -1) {
      throw new Error(`Enum Type values cannot have whitespace. Received: ${options.fieldName}`);
    }
    this.definition[options.fieldName] = GraphqlType.string();
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
}
