import { MessageLanguage } from './common';

/**
 * Properties for governance mechanisms and constraints.
 */
export interface CommonConstraintOptions {
  /**
   * The language code.
   * Configures the language for error messages from service catalog.
   *
   * @default - English
   */
  readonly messageLanguage?: MessageLanguage;

  /**
   * The description of the constraint.
   *
   * @default - No description provided
   */
  readonly description?: string;
}

/**
 * Properties for ResourceUpdateConstraint.
 */
export interface TagUpdateConstraintOptions extends CommonConstraintOptions {
  /**
   * Toggle for if users should be allowed to change/update tags on provisioned products.
   * @default true
   */
  readonly allow?: boolean;
}