import { Test } from 'nodeunit';
import * as schema from '../lib/schema';

export function validateSpecification(test: Test, specification: schema.Specification) {
  validateResourceTypes(test, specification);
  validatePropertyTypes(test, specification);
}

function validateResourceTypes(test: Test, specification: schema.Specification) {
  for (const typeName of Object.keys(specification.ResourceTypes)) {
    test.ok(typeName, 'Resource type name is not empty');
    const type = specification.ResourceTypes[typeName];
    test.notEqual(type.Documentation, null, `${typeName} is documented`);
    if (type.ScrutinyType) {
      test.ok(schema.isResourceScrutinyType(type.ScrutinyType), `${typeName}.ScrutinyType is not a valid ResourceScrutinyType`);
    }
    if (type.Properties) { validateProperties(typeName, test, type.Properties, specification); }
    if (type.Attributes) { validateAttributes(typeName, test, type.Attributes, specification); }
  }
}

function validatePropertyTypes(test: Test, specification: schema.Specification) {
  for (const typeName of Object.keys(specification.PropertyTypes)) {
    test.ok(typeName, 'Property type name is not empty');
    const type = specification.PropertyTypes[typeName];
    if (schema.isRecordType(type)) {
      validateProperties(typeName, test, type.Properties, specification);
    } else {
      validateProperties(typeName, test, { '<this>': type }, specification);
    }
  }
}

function validateProperties(
    typeName: string,
    test: Test,
    properties: { [name: string]: schema.Property },
    specification: schema.Specification) {
  const expectedKeys = ['Documentation', 'Required', 'UpdateType', 'ScrutinyType'];
  for (const name of Object.keys(properties)) {
    const property = properties[name];
    test.notEqual(property.Documentation, '', `${typeName}.Properties.${name} is documented`);
    test.ok(!property.UpdateType || schema.isUpdateType(property.UpdateType), `${typeName}.Properties.${name} has valid UpdateType`);
    if (property.ScrutinyType !== undefined) {
      test.ok(schema.isPropertyScrutinyType(property.ScrutinyType), `${typeName}.Properties.${name} has valid ScrutinyType`);
    }

    if (schema.isPrimitiveProperty(property)) {
      test.ok(schema.isPrimitiveType(property.PrimitiveType), `${typeName}.Properties.${name} has a valid PrimitiveType`);
      expectedKeys.push('PrimitiveType');
    } else if (schema.isPrimitiveListProperty(property)) {
      expectedKeys.push('Type', 'DuplicatesAllowed', 'PrimitiveItemType');
      test.ok(schema.isPrimitiveType(property.PrimitiveItemType), `${typeName}.Properties.${name} has a valid PrimitiveItemType`);
    } else if (schema.isPrimitiveMapProperty(property)) {
      expectedKeys.push('Type', 'DuplicatesAllowed', 'PrimitiveItemType', 'Type');
      test.ok(schema.isPrimitiveType(property.PrimitiveItemType), `${typeName}.Properties.${name} has a valid PrimitiveItemType`);
      test.ok(!property.DuplicatesAllowed, `${typeName}.Properties.${name} does not allow duplicates`);
    } else if (schema.isComplexListProperty(property)) {
      expectedKeys.push('Type', 'DuplicatesAllowed', 'ItemType', 'Type');
      test.ok(property.ItemType, `${typeName}.Properties.${name} has a valid ItemType`);
      if (property.ItemType !== 'Tag') {
        const fqn = `${typeName.split('.')[0]}.${property.ItemType}`;
        const resolvedType = specification.PropertyTypes && specification.PropertyTypes[fqn];
        test.ok(resolvedType, `${typeName}.Properties.${name} ItemType (${fqn}) resolves`);
      }
    } else if (schema.isMapOfStructsProperty(property)) {
      expectedKeys.push('Type', 'DuplicatesAllowed', 'ItemType', 'Type');
      test.ok(property.ItemType, `${typeName}.Properties.${name} has a valid ItemType`);
      const fqn = `${typeName.split('.')[0]}.${property.ItemType}`;
      const resolvedType = specification.PropertyTypes && specification.PropertyTypes[fqn];
      test.ok(resolvedType, `${typeName}.Properties.${name} ItemType (${fqn}) resolves`);
      test.ok(!property.DuplicatesAllowed, `${typeName}.Properties.${name} does not allow duplicates`);
    } else if (schema.isMapOfListsOfPrimitivesProperty(property)) {
      expectedKeys.push('Type', 'DuplicatesAllowed', 'ItemType', 'PrimitiveItemItemType', 'Type');
      test.ok(schema.isPrimitiveType(property.PrimitiveItemItemType), `${typeName}.Properties.${name} has a valid PrimitiveItemItemType`);
      test.ok(!property.DuplicatesAllowed, `${typeName}.Properties.${name} does not allow duplicates`);
    } else if (schema.isComplexProperty(property)) {
      expectedKeys.push('Type');
      test.ok(property.Type, `${typeName}.Properties.${name} has a valid type`);
      const fqn = `${typeName.split('.')[0]}.${property.Type}`;
      const resolvedType = specification.PropertyTypes && specification.PropertyTypes[fqn];
      test.ok(resolvedType, `${typeName}.Properties.${name} type (${fqn}) resolves`);
    } else if (schema.isUnionProperty(property)) {
      expectedKeys.push('PrimitiveTypes', 'PrimitiveItemTypes', 'ItemTypes', 'Types');
      if (property.PrimitiveTypes) {
        for (const type of property.PrimitiveTypes) {
          test.ok(schema.isPrimitiveType(type), `${typeName}.Properties.${name} has only valid PrimitiveTypes`);
        }
      }
      if (property.ItemTypes) {
        for (const type of property.ItemTypes) {
          const fqn = `${typeName.split('.')[0]}.${type}`;
          const resolvedType = specification.PropertyTypes && specification.PropertyTypes[fqn];
          test.ok(resolvedType, `${typeName}.Properties.${name} type (${fqn}) resolves`);
        }
      }
      if (property.Types) {
        for (const type of property.Types) {
          const fqn = `${typeName.split('.')[0]}.${type}`;
          const resolvedType = specification.PropertyTypes && specification.PropertyTypes[fqn];
          test.ok(resolvedType, `${typeName}.Properties.${name} type (${fqn}) resolves`);
        }
      }
    } else {
      test.ok(false, `${typeName}.Properties.${name} has known type`);
    }

    test.deepEqual(
      without(Object.keys(property), expectedKeys), [],
      `${typeName}.Properties.${name} has no extra properties`);
  }
}

function validateAttributes(
    typeName: string,
    test: Test,
    attributes: { [name: string]: schema.Attribute },
    specification: schema.Specification) {
  for (const name of Object.keys(attributes)) {
    const attribute = attributes[name];
    test.ok(('Type' in attribute) !== ('PrimitiveType' in attribute), 'One of, and only one of, Type or PrimitiveType must be present');
    if (schema.isPrimitiveAttribute(attribute)) {
      test.ok(!schema.isListAttribute(attribute), `${typeName}.Attributes.${name} is only a Primitive type`);
      test.ok(schema.isPrimitiveType(attribute.PrimitiveType), `${typeName}.Attributes.${name} has a valid PrimitiveType`);
      test.ok(!('PrimitiveItemType' in attribute), `${typeName}.Attributes.${name} has no PrimitiveItemType`);
      test.ok(!('ItemType' in attribute), `${typeName}.Attributes.${name} has no ItemType`);
    } else if (schema.isPrimitiveListAttribute(attribute)) {
      test.ok(!schema.isComplexListAttribute(attribute), `${typeName}.Attributes.${name} is only a List<Primitive> type`);
      test.ok(schema.isPrimitiveType(attribute.PrimitiveItemType), `${typeName}.Attributes.${name} has a valid PrimitiveItemType`);
      test.ok(!('ItemType' in attribute), `${typeName}.Attributes.${name} has no ItemType`);
    } else if (schema.isComplexListAttribute(attribute)) {
      test.ok(attribute.ItemType, `${typeName}.Attributes.${name} is a valid List<Complex> type`);
      const fqn = `${typeName.split('.')[0]}.${attribute.ItemType}`;
      const resolvedType = specification.PropertyTypes && specification.PropertyTypes[fqn];
      test.ok(resolvedType, `${typeName}.Attributes.${name} ItemType (${fqn}) resolves`);
      test.ok(!('PrimitiveItemType' in attribute), `${typeName}.Attributes.${name} has no PrimitiveItemType`);
    } else if (schema.isPrimitiveMapAttribute(attribute)) {
      test.ok(schema.isPrimitiveType(attribute.PrimitiveItemType), `${typeName}.Attributes.${name} has a valid PrimitiveItemType`);
      test.ok(!('ItemType' in attribute), `${typeName}.Attributes.${name} has no ItemType`);
    } else {
      test.ok(false, `${typeName}.Attributes.${name} has a valid type`);
    }
  }
}

/**
 * Remove elements from a set
 */
function without<T>(xs: T[], ...sets: T[][]) {
  const ret = new Set(xs);

  for (const set of sets) {
    for (const element of set) {
      if (ret.has(element)) {
        ret.delete(element);
      }
    }
  }

  return Array.from(ret);
}
