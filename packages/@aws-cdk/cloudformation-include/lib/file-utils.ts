import * as fs from 'fs';
import * as yaml from 'yaml';
import * as yaml_cst from 'yaml/parse-cst';
import * as yaml_types from 'yaml/types';

function makeTagForCfnIntrinsic(
  intrinsicName: string, addFnPrefix: boolean = true,
  resolveFun?: (_doc: yaml.Document, cstNode: yaml_cst.CST.Node) => any): yaml_types.Schema.Tag {

  return {
    identify(value: any) { return typeof value === 'string'; },
    tag: `!${intrinsicName}`,
    resolve: resolveFun || ((_doc: yaml.Document, cstNode: yaml_cst.CST.Node) => {
      const ret: any = {};
      ret[addFnPrefix ? `Fn::${intrinsicName}` : intrinsicName] =
        // the +1 is to account for the ! the short form begins with
        yaml.parse(cstNode.toString().substring(intrinsicName.length + 1));
      return ret;
    }),
  };
}

export const shortForms: yaml_types.Schema.Tag[] = [
  'Base64', 'Cidr', 'FindInMap', 'GetAZs', 'ImportValue', 'Join',
  'Select', 'Split', 'Transform', 'And', 'Equals', 'If', 'Not', 'Or',
].map(name => makeTagForCfnIntrinsic(name)).concat(
  // ToDo: special logic for ImportValue will be needed when support for Fn::Sub is added. See
  // https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/intrinsic-function-reference-importvalue.html
  makeTagForCfnIntrinsic('Ref', false),
  makeTagForCfnIntrinsic('GetAtt', true, (_doc: yaml.Document, cstNode: yaml_cst.CST.Node): any => {
    // The position of the leftmost period and opening bracket tell us what syntax is being used
    // If no brackets are found, then the dot notation is being used; the leftmost dot separates the
    // logical ID from the attribute.
    //
    // If a bracket is found, then the list notation is being used; if present, the leftmost dot separates the
    // logical ID from the attribute.
    const firstDot = cstNode.toString().indexOf('.');
    const firstBracket = cstNode.toString().indexOf('[');

    return {
      'Fn::GetAtt': firstDot !== -1 && firstBracket === -1
        ? [
          cstNode.toString().substring('!GetAtt '.length, firstDot),
          yaml.parse((cstNode.toString().substring(firstDot + 1))),
        ]
        : yaml.parse(cstNode.toString().substring('!GetAtt'.length)),
    };
  }),
);

export function readJsonSync(filePath: string): any {
  const fileContents = fs.readFileSync(filePath);
  return JSON.parse(fileContents.toString());
}

export function readYamlSync(filePath: string, customTags?: [yaml_types.Schema.CustomTag]): any {
  const fileContents = fs.readFileSync(filePath);
  if (customTags) {
    yaml.defaultOptions.customTags = customTags;
  }
  return yaml.parse(fileContents.toString());
}
