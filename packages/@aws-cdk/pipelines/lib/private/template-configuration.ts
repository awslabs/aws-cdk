import * as fs from 'fs';

/**
 * Write template configuration to the given file
 */
export function writeTemplateConfiguration(filename: string, config: TemplateConfiguration) {
  fs.writeFileSync(filename, JSON.stringify(config, undefined, 2), { encoding: 'utf-8' });
}

/**
 * Template configuration in a CodePipeline
 *
 * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/continuous-delivery-codepipeline-cfn-artifacts.html#w2ab1c13c17c15
 */
export interface TemplateConfiguration {
  readonly Parameters?: Record<string, string>;
  readonly Tags?: Record<string, string>;
  readonly StackPolicy?: {
    readonly Statements: Array<Record<string, string>>;
  };
}