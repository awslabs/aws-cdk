import '@aws-cdk/assert-internal/jest';
import * as iam from '@aws-cdk/aws-iam';
import * as cdk from '@aws-cdk/core';
import * as servicecatalog from '../lib';

describe('Portfolio', () => {
  let stack: cdk.Stack;

  beforeEach(() => {
    stack = new cdk.Stack();
  });

  describe('portfolio creation and importing', () => {
    test('default portfolio creation', () => {
      new servicecatalog.Portfolio(stack, 'MyPortfolio', {
        displayName: 'testPortfolio',
        providerName: 'testProvider',
      });

      expect(stack).toMatchTemplate({
        Resources: {
          MyPortfolio59CCA9C9: {
            Type: 'AWS::ServiceCatalog::Portfolio',
            Properties: {
              DisplayName: 'testPortfolio',
              ProviderName: 'testProvider',
            },
          },
        },
      });
    }),

    test('portfolio with explicit acceptLanguage and description', () => {
      new servicecatalog.Portfolio(stack, 'MyPortfolio', {
        displayName: 'testPortfolio',
        providerName: 'testProvider',
        description: 'test portfolio description',
        acceptLanguage: servicecatalog.AcceptLanguage.ZH,
      });

      expect(stack).toHaveResourceLike('AWS::ServiceCatalog::Portfolio', {
        Description: 'test portfolio description',
        AcceptLanguage: servicecatalog.AcceptLanguage.ZH,
      });
    }),

    test('portfolio from arn', () => {
      const portfolio = servicecatalog.Portfolio.fromPortfolioArn(stack, 'MyPortfolio', 'arn:aws:catalog:region:account-id:portfolio/port-djh8932wr');

      expect(portfolio.portfolioId).toEqual('port-djh8932wr');
    }),

    test('fails portfolio from arn without resource name in arn', () => {
      expect(() => {
        servicecatalog.Portfolio.fromPortfolioArn(stack, 'MyPortfolio', 'arn:aws:catalog:region:account-id:portfolio');
      }).toThrowError(/Missing required Portfolio ID from Portfolio ARN/);
    }),

    test('fails portfolio creation with short name', () => {
      expect(() => {
        new servicecatalog.Portfolio(stack, 'MyPortfolio', {
          displayName: '',
          providerName: 'testProvider',
        });
      }).toThrowError(/Invalid portfolio display name for resource Default\/MyPortfolio/);
    }),

    test('fails portfolio creation with long name', () => {
      expect(() => {
        new servicecatalog.Portfolio(stack, 'MyPortfolio', {
          displayName: 'DisplayName'.repeat(1000),
          providerName: 'testProvider',
        });
      }).toThrowError(/Invalid portfolio display name for resource Default\/MyPortfolio/);
    }),

    test('fails portfolio creation with invalid provider name', () => {
      expect(() => {
        new servicecatalog.Portfolio(stack, 'MyPortfolio', {
          displayName: 'testPortfolio',
          providerName: '',
        });
      }).toThrowError(/Invalid portfolio provider name for resource Default\/MyPortfolio/);
    }),

    test('fails portfolio creation with invalid description length', () => {
      const description = 'Lorem ipsum dolor sit amet, consectetuer adipiscing elit'.repeat(50);

      expect(() => {
        new servicecatalog.Portfolio(stack, 'MyPortfolio', {
          displayName: 'testPortfolio',
          providerName: 'testProvider',
          description: description,
        });
      }).toThrowError(/Invalid portfolio description for resource Default\/MyPortfolio/);
    }),

    test('portfolio creation with token description does not throw validation error and creates', () => {
      const tokenDescription = new cdk.CfnParameter(stack, 'Description');

      new servicecatalog.Portfolio(stack, 'MyPortfolio', {
        displayName: 'testPortfolio',
        providerName: 'testProvider',
        description: tokenDescription.valueAsString,
      });

      expect(stack).toHaveResourceLike('AWS::ServiceCatalog::Portfolio', {
        Description: {
          Ref: 'Description',
        },
      });
    }),

    test('portfolio creation with token display name does not throw validation error and creates', () => {
      const tokenDisplayName = new cdk.CfnParameter(stack, 'DisplayName');

      new servicecatalog.Portfolio(stack, 'MyPortfolio', {
        displayName: tokenDisplayName.valueAsString,
        providerName: 'testProvider',
      });

      expect(stack).toHaveResourceLike('AWS::ServiceCatalog::Portfolio', {
        DisplayName: {
          Ref: 'DisplayName',
        },
      });
    }),

    test('portfolio creation with token provider name does not throw validation error and creates', () => {
      const tokenProviderName = new cdk.CfnParameter(stack, 'ProviderName');

      new servicecatalog.Portfolio(stack, 'MyPortfolio', {
        displayName: 'testPortfolio',
        providerName: tokenProviderName.valueAsString,
      });

      expect(stack).toHaveResourceLike('AWS::ServiceCatalog::Portfolio', {
        ProviderName: {
          Ref: 'ProviderName',
        },
      });
    });
  });

  describe('portfolio methods and associations', () => {
    let portfolio: servicecatalog.Portfolio;

    beforeEach(() => {
      portfolio = new servicecatalog.Portfolio(stack, 'MyPortfolio', {
        displayName: 'testPortfolio',
        providerName: 'testProvider',
      });
    });

    test('portfolio with tags', () => {
      cdk.Tags.of(portfolio).add('myTestKey1', 'myTestKeyValue1');
      cdk.Tags.of(portfolio).add('myTestKey2', 'myTestKeyValue2');

      expect(stack).toHaveResourceLike('AWS::ServiceCatalog::Portfolio', {
        Tags: [
          {
            Key: 'myTestKey1',
            Value: 'myTestKeyValue1',
          },
          {
            Key: 'myTestKey2',
            Value: 'myTestKeyValue2',
          },
        ],
      });
    }),

    test('portfolio share', () => {
      const shareAccountId = '012345678901';

      portfolio.shareWithAccount(shareAccountId);

      expect(stack).toHaveResourceLike('AWS::ServiceCatalog::PortfolioShare', {
        AccountId: shareAccountId,
      });
    }),

    test('portfolio share with share tagOptions', () => {
      const shareAccountId = '012345678901';

      portfolio.shareWithAccount(shareAccountId, {
        shareTagOptions: true,
        acceptLanguage: servicecatalog.AcceptLanguage.EN,
      });

      expect(stack).toHaveResourceLike('AWS::ServiceCatalog::PortfolioShare', {
        AccountId: shareAccountId,
        ShareTagOptions: true,
        AcceptLanguage: 'en',
      });
    }),

    test('portfolio share without share tagOptions', () => {
      const shareAccountId = '012345678901';

      portfolio.shareWithAccount(shareAccountId, { shareTagOptions: false });

      expect(stack).toHaveResourceLike('AWS::ServiceCatalog::PortfolioShare', {
        AccountId: shareAccountId,
        ShareTagOptions: false,
      });
    }),

    test('portfolio share without explicit share tagOptions', () => {
      const shareAccountId = '012345678901';

      portfolio.shareWithAccount(shareAccountId);

      expect(stack).toHaveResourceLike('AWS::ServiceCatalog::PortfolioShare', {
        AccountId: shareAccountId,
      });
    }),

    test('portfolio principal association with role type', () => {
      const role = new iam.Role(stack, 'TestRole', {
        assumedBy: new iam.AccountRootPrincipal(),
      });

      portfolio.giveAccessToRole(role);

      expect(stack).toHaveResourceLike('AWS::ServiceCatalog::PortfolioPrincipalAssociation', {
        PrincipalARN: { 'Fn::GetAtt': ['TestRole6C9272DF', 'Arn'] },
      });
    }),

    test('portfolio principal association with user type', () => {
      const user = new iam.User(stack, 'TestUser');

      portfolio.giveAccessToUser(user);

      expect(stack).toHaveResourceLike('AWS::ServiceCatalog::PortfolioPrincipalAssociation', {
        PrincipalARN: { 'Fn::GetAtt': ['TestUser6A619381', 'Arn'] },
      });
    }),

    test('portfolio principal association with group type', () => {
      const group = new iam.Group(stack, 'TestGroup');

      portfolio.giveAccessToGroup(group);

      expect(stack).toHaveResourceLike('AWS::ServiceCatalog::PortfolioPrincipalAssociation', {
        PrincipalARN: { 'Fn::GetAtt': ['TestGroupAF88660E', 'Arn'] },
      });
    }),

    test('portfolio duplicate principle associations are idempotent', () => {
      const role = new iam.Role(stack, 'TestRole', {
        assumedBy: new iam.AccountRootPrincipal(),
      });

      // If this were not idempotent, the second call would produce an error for duplicate construct ID.
      portfolio.giveAccessToRole(role);
      portfolio.giveAccessToRole(role);
    });
  });
});
