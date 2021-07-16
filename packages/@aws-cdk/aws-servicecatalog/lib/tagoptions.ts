import * as cdk from '@aws-cdk/core';
import { CfnTagOption } from '.';
import { hashValues } from './private/util';
import { InputValidator } from './private/validation';

/**
 * Defines a Tag Option, which are similar to tags
 * but have multiple values per key.
 */
export class TagOptions {
  /**
  * List of CfnTagOption
  */
  public readonly cfnTagOptions: CfnTagOption[];

  constructor(stack : cdk.Stack, tagOptionsMap: {[key: string]: string[]}) {
    this.cfnTagOptions = [];
    Object.keys(tagOptionsMap).forEach(key => {
      InputValidator.validateLength('TagOptions', 'TagOption key', 1, 128, key);
      tagOptionsMap[key].forEach((value: string) => {
        InputValidator.validateLength('TagOptions', 'TagOption value', 1, 256, value);
        const tagOptionKey = hashValues(key, value, stack.node.addr);
        const constructId = `TagOption${tagOptionKey}`;
        if (!stack.node.tryFindChild(constructId)) {
          const cfnTagOption = new CfnTagOption(stack, constructId, {
            key: key,
            value: value,
            active: true,
          });
          this.cfnTagOptions.push(cfnTagOption);
        }
      });
    });
  }
}
