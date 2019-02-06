import iam = require('@aws-cdk/aws-iam');
import kms = require('@aws-cdk/aws-kms');
import cdk = require('@aws-cdk/cdk');
import { SecretString } from './secret-string';
import secretsmanager = require('./secretsmanager.generated');

/**
 * A secret in AWS Secrets Manager.
 */
export interface ISecret extends cdk.IConstruct {
  /**
   * The customer-managed encryption key that is used to encrypt this secret, if any. When not specified, the default
   * KMS key for the account and region is being used.
   */
  readonly encryptionKey?: kms.IEncryptionKey;

  /**
   * The ARN of the secret in AWS Secrets Manager.
   */
  readonly secretArn: string;

  /**
   * Returns a SecretString corresponding to this secret, so that the secret value can be referred to from other parts
   * of the application (such as an RDS instance's master user password property).
   */
  toSecretString(): SecretString;

  /**
   * Exports this secret.
   *
   * @return import props that can be passed back to ``Secret.import``.
   */
  export(): SecretImportProps;

  /**
   * Grants reading the secret value to some role.
   *
   * @param grantee       the principal being granted permission.
   * @param versionStages the version stages the grant is limited to. If not specified, no restriction on the version
   *                      stages is applied.
   */
  grantRead(grantee: iam.IPrincipal, versionStages?: string[]): void;
}

/**
 * The properties required to create a new secret in AWS Secrets Manager.
 */
export interface SecretProps {
  /**
   * An optional, human-friendly description of the secret.
   */
  description?: string;

  /**
   * The customer-managed encryption key to use for encrypting the secret value.
   *
   * @default a default KMS key for the account and region is used.
   */
  encryptionKey?: kms.IEncryptionKey;

  /**
   * Configuration for how to generate a secret value.
   *
   * @default 32 characters with upper-case letters, lower-case letters, punctuation and numbers (at least one from each
   *          category), per the default values of ``SecretStringGenerator``.
   */
  generateSecretString?: SecretStringGenerator;

  /**
   * A name for the secret. Note that deleting secrets from SecretsManager does not happen immediately, but after a 7 to
   * 30 days blackout period. During that period, it is not possible to create another secret that shares the same name.
   *
   * @default a name is generated by CloudFormation.
   */
  name?: string;
}

/**
 * Attributes required to import an existing secret into the Stack.
 */
export interface SecretImportProps {
  /**
   * The encryption key that is used to encrypt the secret, unless the default SecretsManager key is used.
   */
  encryptionKey?: kms.IEncryptionKey;

  /**
   * The ARN of the secret in SecretsManager.
   */
  secretArn: string;
}

/**
 * The common behavior of Secrets. Users should not use this class directly, and instead use ``Secret``.
 */
export abstract class SecretBase extends cdk.Construct implements ISecret {
  public abstract readonly encryptionKey?: kms.IEncryptionKey;
  public abstract readonly secretArn: string;

  private secretString?: SecretString;

  public abstract export(): SecretImportProps;

  public grantRead(grantee: iam.IPrincipal, versionStages?: string[]): void {
    // @see https://docs.aws.amazon.com/fr_fr/secretsmanager/latest/userguide/auth-and-access_identity-based-policies.html
    const statement = new iam.PolicyStatement()
    .allow()
    .addAction('secretsmanager:GetSecretValue')
    .addResource(this.secretArn);
    if (versionStages != null) {
      statement.addCondition('ForAnyValue:StringEquals', {
        'secretsmanager:VersionStage': versionStages
      });
    }
    grantee.addToPolicy(statement);

    if (this.encryptionKey) {
      // @see https://docs.aws.amazon.com/fr_fr/kms/latest/developerguide/services-secrets-manager.html
      this.encryptionKey.addToResourcePolicy(new iam.PolicyStatement()
      .allow()
      .addPrincipal(grantee.principal)
      .addAction('kms:Decrypt')
      .addAllResources()
      .addCondition('StringEquals', {
        'kms:ViaService': `secretsmanager.${cdk.Stack.find(this).region}.amazonaws.com`
      }));
    }
  }

  public toSecretString() {
    this.secretString = this.secretString || new SecretString(this, 'SecretString', { secretId: this.secretArn });
    return this.secretString;
  }
}

/**
 * Creates a new secret in AWS SecretsManager.
 */
export class Secret extends SecretBase {
  /**
   * Import an existing secret into the Stack.
   *
   * @param scope the scope of the import.
   * @param id    the ID of the imported Secret in the construct tree.
   * @param props the attributes of the imported secret.
   */
  public static import(scope: cdk.Construct, id: string, props: SecretImportProps): ISecret {
    return new ImportedSecret(scope, id, props);
  }

  public readonly encryptionKey?: kms.IEncryptionKey;
  public readonly secretArn: string;

  constructor(scope: cdk.Construct, id: string, props: SecretProps = {}) {
    super(scope, id);

    const resource = new secretsmanager.CfnSecret(this, 'Resource', {
      description: props.description,
      kmsKeyId: props.encryptionKey && props.encryptionKey.keyArn,
      generateSecretString: props.generateSecretString || {},
      name: props.name,
    });

    this.encryptionKey = props.encryptionKey;
    this.secretArn = resource.secretArn;
  }

  public export(): SecretImportProps {
    return {
      encryptionKey: this.encryptionKey,
      secretArn: this.secretArn,
    };
  }
}

/**
 * Configuration to generate secrets such as passwords automatically.
 */
export interface SecretStringGenerator {
  /**
   * Specifies that the generated password shouldn't include uppercase letters.
   *
   * @default false
   */
  excludeUppercase?: boolean;

  /**
   * Specifies whether the generated password must include at least one of every allowed character type.
   *
   * @default true
   */
  requireEachIncludedType?: boolean;

  /**
   * Specifies that the generated password can include the space character.
   *
   * @default false
   */
  includeSpace?: boolean;

  /**
   * A string that includes characters that shouldn't be included in the generated password. The string can be a minimum
   * of ``0`` and a maximum of ``4096`` characters long.
   *
   * @default no exclusions
   */
  excludeCharacters?: string;

  /**
   * The desired length of the generated password.
   *
   * @default 32
   */
  passwordLength?: number;

  /**
   * Specifies that the generated password shouldn't include punctuation characters.
   *
   * @default false
   */
  excludePunctuation?: boolean;

  /**
   * Specifies that the generated password shouldn't include lowercase letters.
   *
   * @default false
   */
  excludeLowercase?: boolean;

  /**
   * Specifies that the generated password shouldn't include digits.
   *
   * @default false
   */
  excludeNumbers?: boolean;
}

/**
 * Configuration to generate secrets such as passwords automatically, and include them in a JSON object template.
 */
export interface TemplatedSecretStringGenerator extends SecretStringGenerator {
  /**
   * The JSON key name that's used to add the generated password to the JSON structure specified by the
   * ``secretStringTemplate`` parameter.
   */
  generateStringKey: string;

  /**
   * A properly structured JSON string that the generated password can be added to. The ``generateStringKey`` is
   * combined with the generated random string and inserted into the JSON structure that's specified by this parameter.
   * The merged JSON string is returned as the completed SecretString of the secret.
   */
  secretStringTemplate: string;
}

class ImportedSecret extends SecretBase {
  public readonly encryptionKey?: kms.IEncryptionKey;
  public readonly secretArn: string;

  constructor(scope: cdk.Construct, id: string, private readonly props: SecretImportProps) {
    super(scope, id);

    this.encryptionKey = props.encryptionKey;
    this.secretArn = props.secretArn;
  }

  public export() {
    return this.props;
  }
}
