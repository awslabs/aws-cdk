import * as dynamodb from '@aws-cdk/aws-dynamodb';
import * as ecs from '@aws-cdk/aws-ecs';
import * as cdk from '@aws-cdk/core';
import { Service } from '../service';
import { ContainerMutatingHook, ServiceAddon } from './addon-interfaces';
import { Container } from './container';

/**
 * Settings for the mutating hook which adds a DynamoDB table to the
 * application container as an environment variable
 */
export interface TableProps {
  /**
   * The environment variable to set on the container
   */
  readonly environmentVariableName: string;

  /**
   * The table to reference in the container's environment variable
   */
  readonly table: dynamodb.Table;
}

/**
 * This hook modifies the application container by adding an environment
 * variable which contains the autogenerated table name. This allows you to
 * avoid hardcoding a table name in your application and instead use the
 * environment variable to find the table.
 */
export class DynamoDBTableHook extends ContainerMutatingHook {
  private props: TableProps;

  constructor(props: TableProps) {
    super();
    this.props = props;
  }

  public mutateContainerDefinition(props: ecs.ContainerDefinitionOptions) {
    const environment = props.environment || {};

    environment[this.props.environmentVariableName] = this.props.table.tableName;

    return {
      ...props,
      environment,
    } as ecs.ContainerDefinitionOptions;
  }
}

/**
 * Settings for the table to create
 */
export interface TableAddonProps extends dynamodb.TableProps {
  /**
   * The name of an environment variable name on the application container to
   * populate with the autogenerated system name of the table.
   * @default - The human name capitalized and appended with "_TABLE". For example
   *            setting the human name of the table to "users" would result in an environment
   *            variable named "USERS_TABLE"
   */
  readonly environmentVariableName?: string,

  /**
   * The table to add to the service. You can pass in a precreated table if
   * one has already been created elsewhere
   * @default - Create a new table automatically, using dynamdb.TableProps that were
   *            passed to the addon.
   */
  readonly table?: dynamodb.Table
}

/**
 * This addon adds a DynamoDB table to a service
 */
export class Table extends ServiceAddon {
  private environmentVariableName: string;
  private table?: dynamodb.Table;
  private props: TableAddonProps;

  constructor(name: string, props: TableAddonProps) {
    super(`table-${name}`);

    this.props = props;

    if (props.environmentVariableName) {
      this.environmentVariableName = props.environmentVariableName;
    } else {
      this.environmentVariableName = this.name.toUpperCase() + '_TABLE';
    }
  }

  // Before the service is created go ahead and create the load balancer itself.
  public prehook(service: Service, scope: cdk.Construct) {
    this.parentService = service;

    if (this.props.table) {
      this.table = this.props.table;
    } else {
      // Create a new DynamoDB table using the props that were passed in.
      this.table = new dynamodb.Table(scope, `${this.name}-table`, this.props);
    }
  }

  // Register a hook on the application container to add the
  // table to the env variables on the app container
  public addHooks() {
    const container = this.parentService.getAddon('service-container') as Container;

    if (!container) {
      throw new Error('DynamoDB table addon requires an application addon');
    }

    if (!this.table) {
      throw new Error('The DynamoDB table has not been created yet');
    }

    container.addContainerMutatingHook(new DynamoDBTableHook({
      environmentVariableName: this.environmentVariableName,
      table: this.table,
    }));
  }

  // Once the task definition (and its IAM role) have been created
  // grant the task's IAM role access to read and write data from the table
  public useTaskDefinition(taskDefinition: ecs.TaskDefinition) {
    this.table?.grantReadWriteData(taskDefinition.taskRole);
  }
}
