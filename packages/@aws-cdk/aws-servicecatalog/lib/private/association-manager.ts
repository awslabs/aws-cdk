import { Resource } from '@aws-cdk/core';
import { AcceptLanguage, TagOption } from '../common';
import { LaunchRoleProps, ProvisioningRulesProps, EventNotificationsProps, TagUpdatesProps, StackSetConstraintProps, ConstraintProps } from '../constraints';
import { IPortfolio, Portfolio } from '../portfolio';
import { IProduct } from '../product';
import { CfnPortfolioProductAssociation, CfnLaunchRoleConstraint, CfnLaunchTemplateConstraint, CfnLaunchNotificationConstraint, CfnResourceUpdateConstraint, CfnStackSetConstraint, CfnTagOption, CfnTagOptionAssociation } from '../servicecatalog.generated';
import { getIdentifier } from './util';
import { InputValidator } from './validation';

export class AssociationManager {

  public static associateProductWithPortfolio(scope: Resource, portfolio: IPortfolio, product: IProduct) {
    const associationKey = getIdentifier(portfolio.node.addr, product.node.addr, scope.stack.node.addr);
    if (!this.associationMap.has(associationKey)) {
      const association = new CfnPortfolioProductAssociation(scope, `PortfolioProductAssociation${associationKey}`, {
        portfolioId: portfolio.portfolioId,
        productId: product.productId,
      });
      this.associationMap.set(associationKey, new Map());
      this.associationMap.get(associationKey).set(Constraints.ASSOCIATION, association);
    }
  }

  public static addLaunchRoleConstraint(scope: Resource, props: LaunchRoleProps) {
    const [pair, associationKey] = this.associationPrecheck(scope, props);
    InputValidator.validateLength(this.generateAssocationString(scope, pair), 'description', 0, 2000, props.description);
    if (!(this.associationMap.get(associationKey).get(Constraints.LAUNCH_ROLE)) &&
     !(this.associationMap.get(associationKey).get(Constraints.STACKSET))) {
      const constraint = new CfnLaunchRoleConstraint(scope, `LaunchRoleConstraint${associationKey}`, {
        acceptLanguage: props.acceptLanguage ?? AcceptLanguage.EN,
        description: props.description ?? '',
        portfolioId: pair.portfolio.portfolioId,
        productId: pair.product.productId,
        roleArn: props.role.roleArn,
      });

      constraint.addDependsOn(this.associationMap.get(associationKey).get(Constraints.ASSOCIATION));
      this.associationMap.get(associationKey).set(Constraints.LAUNCH_ROLE, constraint);
    } else {
      throw new Error(`Cannot have multiple launch or stackset constraints on association ${this.generateAssocationString(scope, pair)}`);
    }
  }

  public static addTemplateConstraint(scope: Resource, props: ProvisioningRulesProps) {
    const [pair, associationKey] = this.associationPrecheck(scope, props);
    InputValidator.validateLength(this.generateAssocationString(scope, pair), 'description', 0, 2000, props.description);
    const rules = JSON.stringify(
      {
        Rules: props.rules,
      },
    );
    if (rules == '{}') {
      throw new Error(`No rules provided for provisioning for association ${this.generateAssocationString(scope, pair)}`);
    }
    const constraint = new CfnLaunchTemplateConstraint(scope, `LaunchTemplateConstraint${getIdentifier(associationKey, rules)}`, {
      acceptLanguage: props.acceptLanguage ?? AcceptLanguage.EN,
      description: props.description ?? '',
      portfolioId: pair.portfolio.portfolioId,
      productId: pair.product.productId,
      rules: rules,
    });

    constraint.addDependsOn(this.associationMap.get(associationKey).get(Constraints.ASSOCIATION));
  }

  public static addLaunchNotificationConstraint(scope: Resource, props: EventNotificationsProps) {
    const [pair, associationKey] = this.associationPrecheck(scope, props);
    InputValidator.validateLength(this.generateAssocationString(scope, pair), 'description', 0, 2000, props.description);
    if (!props.topics.length) {
      throw new Error(`No topics provided for launch notifications for association ${pair.portfolio.portfolioName}-${pair.product.productName}`);
    }
    const constraint = new CfnLaunchNotificationConstraint(scope, `LaunchNotificationConstraint${getIdentifier(associationKey, ...props.topics.map(tpc => tpc.node.addr))}`, {
      acceptLanguage: props.acceptLanguage || AcceptLanguage.EN,
      description: props.description,
      portfolioId: pair.portfolio.portfolioId,
      productId: pair.product.productId,
      notificationArns: props.topics.map(tpc => tpc.topicArn),
    });

    constraint.addDependsOn(this.associationMap.get(associationKey).get(Constraints.ASSOCIATION));
  }

  public static addResourceUpdateConstraint(scope: Resource, props: TagUpdatesProps) {
    const [pair, associationKey] = this.associationPrecheck(scope, props);
    InputValidator.validateLength(this.generateAssocationString(scope, pair), 'description', 0, 2000, props.description);
    if (!this.associationMap.get(associationKey).get(Constraints.RESOURCE_UPDATE)) {
      const constraint = new CfnResourceUpdateConstraint(scope, `ResourceUpdateConstraint${associationKey}`, {
        acceptLanguage: props.acceptLanguage ?? AcceptLanguage.EN,
        description: props.description ?? '',
        portfolioId: pair.portfolio.portfolioId,
        productId: pair.product.productId,
        tagUpdateOnProvisionedProduct: props.tagUpdateOnProvisionedProductAllowed || props.tagUpdateOnProvisionedProductAllowed === undefined
          ? Allowed.ALLOWED : Allowed.NOT_ALLOWED,
      });

      constraint.addDependsOn(this.associationMap.get(associationKey).get(Constraints.ASSOCIATION));
      this.associationMap.get(associationKey).set(Constraints.RESOURCE_UPDATE, constraint);
    } else {
      throw new Error(`Cannot have multiple resource update constraints for association ${this.generateAssocationString(scope, pair)}`);
    }
  }

  public static addStackSetConstraint(scope: Resource, props: StackSetConstraintProps) {
    const [pair, associationKey] = this.associationPrecheck(scope, props);
    InputValidator.validateLength(this.generateAssocationString(scope, pair), 'description', 0, 2000, props.description);
    if (!(this.associationMap.get(associationKey).get(Constraints.LAUNCH_ROLE)) &&
     !(this.associationMap.get(associationKey).get(Constraints.STACKSET))) {
      const constraint = new CfnStackSetConstraint(scope, `StackSetConstraint${associationKey}`, {
        acceptLanguage: props.acceptLanguage,
        description: props.description ?? '',
        portfolioId: pair.portfolio.portfolioId,
        productId: pair.product.productId,
        accountList: props.accounts,
        regionList: props.regions,
        adminRole: props.adminRole.roleArn,
        executionRole: props.adminRole.roleName,
        stackInstanceControl: props.stackInstanceControlAllowed ? Allowed.ALLOWED : Allowed.NOT_ALLOWED,
      });

      constraint.addDependsOn(this.associationMap.get(associationKey).get(Constraints.ASSOCIATION));
      this.associationMap.get(associationKey).set(Constraints.STACKSET, constraint);
    } else {
      throw new Error(`Cannot have multiple launch or stackset constraints on association ${this.generateAssocationString(scope, pair)}`);
    }
  }

  public static associateTagOption(scope: Resource, resourceId: string, tagOption: TagOption) {

    Object.keys(tagOption).forEach(key => {
      InputValidator.validateLength(resourceId, 'TagOption key', 1, 128, key);
      tagOption[key].forEach(value => {
        InputValidator.validateLength(resourceId, 'TagOption value', 1, 256, value.value);
        const tagOptionKey = getIdentifier(key, value.value);
        if (!this.tagOptionMap.has(tagOptionKey)) {
          const tO = new CfnTagOption(scope, `TagOption${tagOptionKey}`, {
            key: key,
            value: value.value,
            active: value.active ?? true,
          });
          this.tagOptionMap.set(tagOptionKey, tO);
        }

        new CfnTagOptionAssociation(scope, `TagOptionAssociation${getIdentifier(scope.node.addr, tagOptionKey)}`, {
          resourceId: resourceId,
          tagOptionId: this.tagOptionMap.get(tagOptionKey).ref,
        });
      });
    });
  }

  private static associationMap = new Map();
  private static tagOptionMap = new Map();

  private static associationPrecheck(scope: Resource, props: ConstraintProps): [AssociationPair, string] {
    const pair = this.resolveProductAndPortfolio(scope, props);
    const associationKey = getIdentifier(pair.portfolio.node.addr, pair.product.node.addr, scope.stack.node.addr);
    if (!this.associationMap.has(associationKey)) {
      this.associateProductWithPortfolio(scope, pair.portfolio, pair.product);
    }
    return [pair, associationKey];
  }

  private static resolveProductAndPortfolio(resource: Resource, props: ConstraintProps): AssociationPair {

    const isScopePortfolio: boolean = 'portfolioArn' in resource;
    const portfolio = isScopePortfolio ? resource as Portfolio : props.product;
    const product = isScopePortfolio ? props.product : resource;

    return {
      portfolio: portfolio as IPortfolio,
      product: product as IProduct,
    };
  }

  private static generateAssocationString(scope: Resource, pair: AssociationPair) {
    return `- Portfolio: ${scope.stack.resolve(pair.portfolio.portfolioName)} | Product: ${scope.stack.resolve(pair.product.productName)}`;
  }
}

interface AssociationPair {
  portfolio: IPortfolio,
  product: IProduct
}

/**
 * Custom allow code
 */
enum Allowed {

  /**
   * Allow operation
   */
  ALLOWED = 'ALLOWED',

  /**
   * Not allowed operation
   */
  NOT_ALLOWED = 'NOT_ALLOWED'
}

/**
 * Constraint keys for map
 */
enum Constraints {

  /**
   * Association key
   */
  ASSOCIATION = 'association',

  /**
   * Launch role constraint key
   */
  LAUNCH_ROLE = 'launchRole',

  /**
   * Stackset constraint key
   */
  STACKSET = 'stackSet',

  /**
   * Resource update constraint key
   */
  RESOURCE_UPDATE = 'resourceUpdate',

  /**
   * Launch notification constraint key
   */
  NOTIFICATION = 'notification',

  /**
   * Provisioning rules constraint key
   */
  PROVISIONING_RULES = 'provisioningRules'
}
