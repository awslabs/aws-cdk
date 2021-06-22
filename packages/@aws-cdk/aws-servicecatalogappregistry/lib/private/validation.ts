import * as cdk from '@aws-cdk/core';

/**
 * Class to validate that inputs match requirements.
 */
export class InputValidator {
  /**
   * Validates length is between allowed min and max lengths.
   */
  public static validateLength(resourceName: string, inputName: string, minLength: number, maxLength: number, inputString?: string): void {
    if (!cdk.Token.isUnresolved(inputString) && inputString !== undefined && (inputString.length < minLength || inputString.length > maxLength)) {
      throw new Error(`Invalid ${inputName} for resource ${resourceName}, must have length between ${minLength} and ${maxLength}, got: '${this.truncateString(inputString, 100)}'`);
    }
  }

  /**
   * Validates a regex.
   */
  public static validateRegex(resourceName: string, inputName: string, regex: RegExp, inputString?: string): void {
    if (!cdk.Token.isUnresolved(inputString) && inputString !== undefined && !regex.test(inputString)) {
      throw new Error(`Invalid ${inputName} for resource ${resourceName}, must match regex pattern ${regex}, got: '${this.truncateString(inputString, 100)}'`);
    }
  }

  private static truncateString(string: string, maxLength: number): string {
    if (string.length > maxLength) {
      return string.substring(0, maxLength) + '[truncated]';
    }
    return string;
  }
}