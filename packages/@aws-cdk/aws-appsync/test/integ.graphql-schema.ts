import * as db from '@aws-cdk/aws-dynamodb';
import * as cdk from '@aws-cdk/core';
import * as appsync from '../lib';
import * as ObjectType from './object-type-definitions';
import * as ScalarType from './scalar-type-defintions';

/*
 * Creates an Appsync GraphQL API and schema in a code-first approach.
 *
 * Stack verification steps:
 * Deploy stack, get api key and endpoinScalarType. Check if schema connects to data source.
 *
 * -- bash verify.integ.graphql-schema.sh --start                 -- start                    --
 * -- aws appsync list-graphql-apis                               -- obtain apiId & endpoint  --
 * -- aws appsync list-api-keys --api-id [apiId]                  -- obtain api key           --
 * -- bash verify.integ.graphql-schema.sh --check [apiKey] [url]  -- check if success         --
 * -- bash verify.integ.graphql-schema.sh --clean                 -- clean                    --
 */
const app = new cdk.App();
const stack = new cdk.Stack(app, 'code-first-schema');

const schema = appsync.Schema.fromCode();

const node = new appsync.InterfaceType('Node', {
  definition: {
    created: ScalarType.string,
    edited: ScalarType.string,
    id: ScalarType.required_id,
  },
});

schema.addType(node);

const api = new appsync.GraphqlApi(stack, 'code-first-api', {
  name: 'api',
  schema: schema,
});

const table = new db.Table(stack, 'table', {
  partitionKey: {
    name: 'id',
    type: db.AttributeType.STRING,
  },
});

const tableDS = api.addDynamoDbDataSource('planets', table);

const planet = ObjectType.planet;
schema.addType(planet);

const species = api.addType(new appsync.ObjectType('Species', {
  interfaceTypes: [node],
  definition: {
    name: ScalarType.string,
    classification: ScalarType.string,
    designation: ScalarType.string,
    averageHeight: ScalarType.float,
    averageLifespan: ScalarType.int,
    eyeColors: ScalarType.list_string,
    hairColors: ScalarType.list_string,
    skinColors: ScalarType.list_string,
    language: ScalarType.string,
    homeworld: planet.attribute(),
  },
}));

api.addQuery('getPlanets', new appsync.ResolvableField({
  returnType: planet.attribute({ isList: true }),
  dataSource: tableDS,
  requestMappingTemplate: appsync.MappingTemplate.dynamoDbScanTable(),
  responseMappingTemplate: appsync.MappingTemplate.dynamoDbResultList(),
}));

/* ATTRIBUTES */
const name = new appsync.Assign('name', '$context.arguments.name');
const diameter = new appsync.Assign('diameter', '$context.arguments.diameter');
const rotationPeriod = new appsync.Assign('rotationPeriod', '$context.arguments.rotationPeriod');
const orbitalPeriod = new appsync.Assign('orbitalPeriod', '$context.arguments.orbitalPeriod');
const gravity = new appsync.Assign('gravityPeriod', '$context.arguments.gravity');
const population = new appsync.Assign('population', '$context.arguments.population');
const climates = new appsync.Assign('climates', '$context.arguments.climates');
const terrains = new appsync.Assign('terrains', '$context.arguments.terrains');
const surfaceWater = new appsync.Assign('surfaceWater', '$context.arguments.surfaceWater');
api.addMutation('addPlanet', new appsync.ResolvableField({
  returnType: planet.attribute(),
  args: {
    name: ScalarType.string,
    diameter: ScalarType.int,
    rotationPeriod: ScalarType.int,
    orbitalPeriod: ScalarType.int,
    gravity: ScalarType.string,
    population: ScalarType.list_string,
    climates: ScalarType.list_string,
    terrains: ScalarType.list_string,
    surfaceWater: ScalarType.float,
  },
  dataSource: tableDS,
  requestMappingTemplate: appsync.MappingTemplate.dynamoDbPutItem(
    appsync.PrimaryKey.partition('id').auto(), new appsync.AttributeValues('$context.arguments',
      [name, diameter, rotationPeriod, orbitalPeriod, gravity, population, climates, terrains, surfaceWater],
    ),
  ),
  responseMappingTemplate: appsync.MappingTemplate.dynamoDbResultItem(),
}));

api.addSubscription('addedPlanets', new appsync.Field({
  returnType: planet.attribute(),
  args: { id: ScalarType.required_id },
  directives: [appsync.Directive.subscribe('addPlanet')],
}));
api.addType(new appsync.InputType('AwesomeInput', {
  definition: { awesomeInput: ScalarType.string },
}));

api.addType(new appsync.EnumType('Episodes', {
  definition: [
    'The_Phantom_Menace',
    'Attack_of_the_Clones',
    'Revenge_of_the_Sith',
    'A_New_Hope',
    'The_Empire_Strikes_Back',
    'Return_of_the_Jedi',
    'The_Force_Awakens',
    'The_Last_Jedi',
    'The_Rise_of_Skywalker',
  ],
}));

api.addType(new appsync.UnionType('Union', {
  definition: [species, planet],
}));

app.synth();