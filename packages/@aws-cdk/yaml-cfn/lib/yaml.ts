import * as yaml from 'yaml';
import * as yaml_cst from 'yaml/parse-cst';
import * as yaml_types from 'yaml/types';

/**
 * Serializes the given data structure into valid YAML.
 *
 * @param obj the data structure to serialize
 * @returns a string containing the YAML representation of {@param obj}
 */
export function serialize(obj: any): string {
  const oldFold = yaml_types.strOptions.fold.lineWidth;
  try {
    yaml_types.strOptions.fold.lineWidth = 0;
    return yaml.stringify(obj, { schema: 'yaml-1.1' });
  } finally {
    yaml_types.strOptions.fold.lineWidth = oldFold;
  }
}

/**
 * Deserialize the YAML into the appropriate data structure.
 *
 * @param str the string containing YAML
 * @returns the data structure the YAML represents
 *   (most often in case of CloudFormation, an object)
 */
export function deserialize(str: string): any {
  return parseYamlStrWithCfnTags(str);
}

function makeTagForCfnIntrinsic(intrinsicName: string, addFnPrefix: boolean): yaml_types.Schema.CustomTag {
  return {
    identify(value: any) { return typeof value === 'string'; },
    tag: `!${intrinsicName}`,
    resolve: (_doc: yaml.Document, cstNode: yaml_cst.CST.Node) => {
      const ret: any = {};
      ret[addFnPrefix ? `Fn::${intrinsicName}` : intrinsicName] =
        // the +1 is to account for the ! the short form begins with
        parseYamlStrWithCfnTags(cstNode.toString().substring(intrinsicName.length + 1));
      return ret;
    },
  };
}

const shortForms: yaml_types.Schema.CustomTag[] = [
  'Base64', 'Cidr', 'FindInMap', 'GetAZs', 'ImportValue', 'Join', 'Sub',
  'Select', 'Split', 'Transform', 'And', 'Equals', 'If', 'Not', 'Or', 'GetAtt',
].map(name => makeTagForCfnIntrinsic(name, true)).concat(
  makeTagForCfnIntrinsic('Ref', false),
  makeTagForCfnIntrinsic('Condition', false),
);

function parseYamlStrWithCfnTags(text: string): any {
  return yaml.parse(text, {
    customTags: shortForms,
    schema: 'core',
  });
}
