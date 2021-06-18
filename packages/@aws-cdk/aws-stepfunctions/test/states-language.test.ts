import '@aws-cdk/assert-internal/jest';
import * as cdk from '@aws-cdk/core';
import * as constructs from 'constructs';
import * as stepfunctions from '../lib';

describe('States Language', () => {
  test('A single task is a State Machine', () => {
    // GIVEN
    const stack = new cdk.Stack();

    // WHEN
    const chain = new stepfunctions.Pass(stack, 'Some State');

    // THEN
    expect(render(chain)).toStrictEqual({
      StartAt: 'Some State',
      States: {
        'Some State': { Type: 'Pass', End: true },
      },
    });
  }),

  test('A sequence of two tasks is a State Machine', () => {
    // GIVEN
    const stack = new cdk.Stack();

    // WHEN
    const task1 = new stepfunctions.Pass(stack, 'State One');
    const task2 = new stepfunctions.Pass(stack, 'State Two');

    const chain = stepfunctions.Chain
      .start(task1)
      .next(task2);

    // THEN
    expect(render(chain)).toStrictEqual({
      StartAt: 'State One',
      States: {
        'State One': { Type: 'Pass', Next: 'State Two' },
        'State Two': { Type: 'Pass', End: true },
      },
    });
  }),

  test('You dont need to hold on to the state to render the entire state machine correctly', () => {
    const stack = new cdk.Stack();

    // WHEN
    const task1 = new stepfunctions.Pass(stack, 'State One');
    const task2 = new stepfunctions.Pass(stack, 'State Two');

    task1.next(task2);

    // THEN
    expect(render(task1)).toStrictEqual({
      StartAt: 'State One',
      States: {
        'State One': { Type: 'Pass', Next: 'State Two' },
        'State Two': { Type: 'Pass', End: true },
      },
    });
  }),

  test('A chain can be appended to', () => {
    // GIVEN
    const stack = new cdk.Stack();

    const task1 = new stepfunctions.Pass(stack, 'State One');
    const task2 = new stepfunctions.Pass(stack, 'State Two');
    const task3 = new stepfunctions.Pass(stack, 'State Three');

    // WHEN
    const chain = stepfunctions.Chain
      .start(task1)
      .next(task2)
      .next(task3);

    // THEN
    expect(render(chain)).toStrictEqual({
      StartAt: 'State One',
      States: {
        'State One': { Type: 'Pass', Next: 'State Two' },
        'State Two': { Type: 'Pass', Next: 'State Three' },
        'State Three': { Type: 'Pass', End: true },
      },
    });
  }),

  test('A state machine can be appended to another state machine', () => {
    // GIVEN
    const stack = new cdk.Stack();

    const task1 = new stepfunctions.Pass(stack, 'State One');
    const task2 = new stepfunctions.Pass(stack, 'State Two');
    const task3 = new stepfunctions.Wait(stack, 'State Three', {
      time: stepfunctions.WaitTime.duration(cdk.Duration.seconds(10)),
    });

    // WHEN
    const chain = stepfunctions.Chain
      .start(task1)
      .next(stepfunctions.Chain.start(task2).next(task3));

    // THEN
    expect(render(chain)).toStrictEqual({
      StartAt: 'State One',
      States: {
        'State One': { Type: 'Pass', Next: 'State Two' },
        'State Two': { Type: 'Pass', Next: 'State Three' },
        'State Three': { Type: 'Wait', End: true, Seconds: 10 },
      },
    });
  }),

  test('A state machine definition can be instantiated and chained', () => {
    const stack = new cdk.Stack();
    const before = new stepfunctions.Pass(stack, 'Before');
    const after = new stepfunctions.Pass(stack, 'After');

    // WHEN
    const chain = before.next(new ReusableStateMachine(stack, 'Reusable')).next(after);

    // THEN
    expect(render(chain)).toStrictEqual({
      StartAt: 'Before',
      States: {
        'Before': { Type: 'Pass', Next: 'Choice' },
        'Choice': {
          Type: 'Choice',
          Choices: [
            { Variable: '$.branch', StringEquals: 'left', Next: 'Left Branch' },
            { Variable: '$.branch', StringEquals: 'right', Next: 'Right Branch' },
          ],
        },
        'Left Branch': { Type: 'Pass', Next: 'After' },
        'Right Branch': { Type: 'Pass', Next: 'After' },
        'After': { Type: 'Pass', End: true },
      },
    });
  }),

  test('A success state cannot be chained onto', () => {
    // GIVEN
    const stack = new cdk.Stack();

    const succeed = new stepfunctions.Succeed(stack, 'Succeed');
    const pass = new stepfunctions.Pass(stack, 'Pass');

    // WHEN
    expect(() => pass.next(succeed).next(pass)).toThrow();
  }),

  test('A failure state cannot be chained onto', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const fail = new stepfunctions.Fail(stack, 'Fail', { error: 'X', cause: 'Y' });
    const pass = new stepfunctions.Pass(stack, 'Pass');

    // WHEN
    expect(() => pass.next(fail).next(pass)).toThrow();
  }),

  test('Parallels can contain direct states', () => {
    // GIVEN
    const stack = new cdk.Stack();

    const one = new stepfunctions.Pass(stack, 'One');
    const two = new stepfunctions.Pass(stack, 'Two');
    const three = new stepfunctions.Pass(stack, 'Three');

    // WHEN
    const para = new stepfunctions.Parallel(stack, 'Parallel');
    para.branch(one.next(two));
    para.branch(three);

    // THEN
    expect(render(para)).toStrictEqual({
      StartAt: 'Parallel',
      States: {
        Parallel: {
          Type: 'Parallel',
          End: true,
          Branches: [
            {
              StartAt: 'One',
              States: {
                One: { Type: 'Pass', Next: 'Two' },
                Two: { Type: 'Pass', End: true },
              },
            },
            {
              StartAt: 'Three',
              States: {
                Three: { Type: 'Pass', End: true },
              },
            },
          ],
        },
      },
    });
  }),

  test('Parallels can contain instantiated reusable definitions', () => {
    // GIVEN
    const stack = new cdk.Stack();

    // WHEN
    const para = new stepfunctions.Parallel(stack, 'Parallel');
    para.branch(new ReusableStateMachine(stack, 'Reusable1').prefixStates('Reusable1/'));
    para.branch(new ReusableStateMachine(stack, 'Reusable2').prefixStates('Reusable2/'));

    // THEN
    expect(render(para)).toStrictEqual({
      StartAt: 'Parallel',
      States: {
        Parallel: {
          Type: 'Parallel',
          End: true,
          Branches: [
            {
              StartAt: 'Reusable1/Choice',
              States: {
                'Reusable1/Choice': {
                  Type: 'Choice',
                  Choices: [
                    { Variable: '$.branch', StringEquals: 'left', Next: 'Reusable1/Left Branch' },
                    { Variable: '$.branch', StringEquals: 'right', Next: 'Reusable1/Right Branch' },
                  ],
                },
                'Reusable1/Left Branch': { Type: 'Pass', End: true },
                'Reusable1/Right Branch': { Type: 'Pass', End: true },
              },
            },
            {
              StartAt: 'Reusable2/Choice',
              States: {
                'Reusable2/Choice': {
                  Type: 'Choice',
                  Choices: [
                    { Variable: '$.branch', StringEquals: 'left', Next: 'Reusable2/Left Branch' },
                    { Variable: '$.branch', StringEquals: 'right', Next: 'Reusable2/Right Branch' },
                  ],
                },
                'Reusable2/Left Branch': { Type: 'Pass', End: true },
                'Reusable2/Right Branch': { Type: 'Pass', End: true },
              },
            },
          ],
        },
      },
    });
  }),

  test('State Machine Fragments can be wrapped in a single state', () => {
    // GIVEN
    const stack = new cdk.Stack();

    const reusable = new SimpleChain(stack, 'Hello');
    const state = reusable.toSingleState();

    expect(render(state)).toStrictEqual({
      StartAt: 'Hello',
      States: {
        Hello: {
          Type: 'Parallel',
          End: true,
          Branches: [
            {
              StartAt: 'Hello: Task1',
              States: {
                'Hello: Task1': { Type: 'Task', Next: 'Hello: Task2', Resource: 'resource' },
                'Hello: Task2': { Type: 'Task', End: true, Resource: 'resource' },
              },
            },
          ],
        },
      },
    });
  }),

  test('Chaining onto branched failure state ignores failure state', () => {
    // GIVEN
    const stack = new cdk.Stack();

    const yes = new stepfunctions.Pass(stack, 'Yes');
    const no = new stepfunctions.Fail(stack, 'No', { error: 'Failure', cause: 'Wrong branch' });
    const enfin = new stepfunctions.Pass(stack, 'Finally');
    const choice = new stepfunctions.Choice(stack, 'Choice')
      .when(stepfunctions.Condition.stringEquals('$.foo', 'bar'), yes)
      .otherwise(no);

    // WHEN
    choice.afterwards().next(enfin);

    // THEN
    expect(render(choice)).toStrictEqual({
      StartAt: 'Choice',
      States: {
        Choice: {
          Type: 'Choice',
          Choices: [
            { Variable: '$.foo', StringEquals: 'bar', Next: 'Yes' },
          ],
          Default: 'No',
        },
        Yes: { Type: 'Pass', Next: 'Finally' },
        No: { Type: 'Fail', Error: 'Failure', Cause: 'Wrong branch' },
        Finally: { Type: 'Pass', End: true },
      },
    });
  }),

  test('Can include OTHERWISE transition for Choice in afterwards()', () => {
    // GIVEN
    const stack = new cdk.Stack();

    // WHEN
    const chain = new stepfunctions.Choice(stack, 'Choice')
      .when(stepfunctions.Condition.stringEquals('$.foo', 'bar'),
        new stepfunctions.Pass(stack, 'Yes'))
      .afterwards({ includeOtherwise: true })
      .next(new stepfunctions.Pass(stack, 'Finally'));

    // THEN
    expect(render(chain)).toStrictEqual({
      StartAt: 'Choice',
      States: {
        Choice: {
          Type: 'Choice',
          Choices: [
            { Variable: '$.foo', StringEquals: 'bar', Next: 'Yes' },
          ],
          Default: 'Finally',
        },
        Yes: { Type: 'Pass', Next: 'Finally' },
        Finally: { Type: 'Pass', End: true },
      },
    });
  }),

  test('State machines can have unconstrainted gotos', () => {
    // GIVEN
    const stack = new cdk.Stack();

    const one = new stepfunctions.Pass(stack, 'One');
    const two = new stepfunctions.Pass(stack, 'Two');

    // WHEN
    const chain = one.next(two).next(one);

    // THEN
    expect(render(chain)).toStrictEqual({
      StartAt: 'One',
      States: {
        One: { Type: 'Pass', Next: 'Two' },
        Two: { Type: 'Pass', Next: 'One' },
      },
    });
  }),

  test('States can have error branches', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const task1 = new stepfunctions.Task(stack, 'Task1', { task: new FakeTask() });
    const failure = new stepfunctions.Fail(stack, 'Failed', { error: 'DidNotWork', cause: 'We got stuck' });

    // WHEN
    const chain = task1.addCatch(failure);

    // THEN
    expect(render(chain)).toStrictEqual({
      StartAt: 'Task1',
      States: {
        Task1: {
          Type: 'Task',
          Resource: 'resource',
          End: true,
          Catch: [
            { ErrorEquals: ['States.ALL'], Next: 'Failed' },
          ],
        },
        Failed: {
          Type: 'Fail',
          Error: 'DidNotWork',
          Cause: 'We got stuck',
        },
      },
    });
  }),

  test('Retries and errors with a result path', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const task1 = new stepfunctions.Task(stack, 'Task1', { task: new FakeTask() });
    const failure = new stepfunctions.Fail(stack, 'Failed', { error: 'DidNotWork', cause: 'We got stuck' });

    // WHEN
    const chain = task1.addRetry({ errors: ['HTTPError'], maxAttempts: 2 }).addCatch(failure, { resultPath: '$.some_error' }).next(failure);

    // THEN
    expect(render(chain)).toStrictEqual({
      StartAt: 'Task1',
      States: {
        Task1: {
          Type: 'Task',
          Resource: 'resource',
          Catch: [{ ErrorEquals: ['States.ALL'], Next: 'Failed', ResultPath: '$.some_error' }],
          Retry: [{ ErrorEquals: ['HTTPError'], MaxAttempts: 2 }],
          Next: 'Failed',
        },
        Failed: {
          Type: 'Fail',
          Error: 'DidNotWork',
          Cause: 'We got stuck',
        },
      },
    });
  }),

  test('Can wrap chain and attach error handler', () => {
    // GIVEN
    const stack = new cdk.Stack();

    const task1 = new stepfunctions.Task(stack, 'Task1', { task: new FakeTask() });
    const task2 = new stepfunctions.Task(stack, 'Task2', { task: new FakeTask() });
    const errorHandler = new stepfunctions.Pass(stack, 'ErrorHandler');

    // WHEN
    const chain = task1.next(task2).toSingleState('Wrapped').addCatch(errorHandler);

    // THEN
    expect(render(chain)).toStrictEqual({
      StartAt: 'Wrapped',
      States: {
        Wrapped: {
          Type: 'Parallel',
          Branches: [
            {
              StartAt: 'Task1',
              States: {
                Task1: {
                  Type: 'Task',
                  Resource: 'resource',
                  Next: 'Task2',
                },
                Task2: {
                  Type: 'Task',
                  Resource: 'resource',
                  End: true,
                },
              },
            },
          ],
          Catch: [
            { ErrorEquals: ['States.ALL'], Next: 'ErrorHandler' },
          ],
          End: true,
        },
        ErrorHandler: { Type: 'Pass', End: true },
      },
    });
  }),

  test('Chaining does not chain onto error handler state', () => {
    // GIVEN
    const stack = new cdk.Stack();

    const task1 = new stepfunctions.Task(stack, 'Task1', { task: new FakeTask() });
    const task2 = new stepfunctions.Task(stack, 'Task2', { task: new FakeTask() });
    const errorHandler = new stepfunctions.Pass(stack, 'ErrorHandler');

    // WHEN
    const chain = task1.addCatch(errorHandler).next(task2);

    // THEN
    expect(render(chain)).toStrictEqual({
      StartAt: 'Task1',
      States: {
        Task1: {
          Type: 'Task',
          Resource: 'resource',
          Next: 'Task2',
          Catch: [
            { ErrorEquals: ['States.ALL'], Next: 'ErrorHandler' },
          ],
        },
        Task2: { Type: 'Task', Resource: 'resource', End: true },
        ErrorHandler: { Type: 'Pass', End: true },
      },
    });
  }),

  test('Chaining does not chain onto error handler, extended', () => {
    // GIVEN
    const stack = new cdk.Stack();

    const task1 = new stepfunctions.Task(stack, 'Task1', { task: new FakeTask() });
    const task2 = new stepfunctions.Task(stack, 'Task2', { task: new FakeTask() });
    const task3 = new stepfunctions.Task(stack, 'Task3', { task: new FakeTask() });
    const errorHandler = new stepfunctions.Pass(stack, 'ErrorHandler');

    // WHEN
    const chain = task1.addCatch(errorHandler)
      .next(task2.addCatch(errorHandler))
      .next(task3.addCatch(errorHandler));

    // THEN
    const sharedTaskProps = { Type: 'Task', Resource: 'resource', Catch: [{ ErrorEquals: ['States.ALL'], Next: 'ErrorHandler' }] };
    expect(render(chain)).toStrictEqual({
      StartAt: 'Task1',
      States: {
        Task1: { Next: 'Task2', ...sharedTaskProps },
        Task2: { Next: 'Task3', ...sharedTaskProps },
        Task3: { End: true, ...sharedTaskProps },
        ErrorHandler: { Type: 'Pass', End: true },
      },
    });
  }),

  test('Error handler with a fragment', () => {
    // GIVEN
    const stack = new cdk.Stack();

    const task1 = new stepfunctions.Task(stack, 'Task1', { task: new FakeTask() });
    const task2 = new stepfunctions.Task(stack, 'Task2', { task: new FakeTask() });
    const errorHandler = new stepfunctions.Pass(stack, 'ErrorHandler');

    // WHEN
    task1.addCatch(errorHandler)
      .next(new SimpleChain(stack, 'Chain').catch(errorHandler))
      .next(task2.addCatch(errorHandler));
  }),

  test('Can merge state machines with shared states', () => {
    // GIVEN
    const stack = new cdk.Stack();

    const task1 = new stepfunctions.Task(stack, 'Task1', { task: new FakeTask() });
    const task2 = new stepfunctions.Task(stack, 'Task2', { task: new FakeTask() });
    const failure = new stepfunctions.Fail(stack, 'Failed', { error: 'DidNotWork', cause: 'We got stuck' });

    // WHEN
    task1.addCatch(failure);
    task2.addCatch(failure);

    task1.next(task2);

    // THEN
    expect(render(task1)).toStrictEqual({
      StartAt: 'Task1',
      States: {
        Task1: {
          Type: 'Task',
          Resource: 'resource',
          Next: 'Task2',
          Catch: [
            { ErrorEquals: ['States.ALL'], Next: 'Failed' },
          ],
        },
        Task2: {
          Type: 'Task',
          Resource: 'resource',
          End: true,
          Catch: [
            { ErrorEquals: ['States.ALL'], Next: 'Failed' },
          ],
        },
        Failed: {
          Type: 'Fail',
          Error: 'DidNotWork',
          Cause: 'We got stuck',
        },
      },
    });
  }),

  test('No duplicate state IDs', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const intermediateParent = new cdk.Construct(stack, 'Parent');

    const state1 = new stepfunctions.Pass(stack, 'State');
    const state2 = new stepfunctions.Pass(intermediateParent, 'State');

    state1.next(state2);

    // WHEN
    expect(() => render(state1)).toThrow();
  }),

  test('No duplicate state IDs even across Parallel branches', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const intermediateParent = new cdk.Construct(stack, 'Parent');

    const state1 = new stepfunctions.Pass(stack, 'State');
    const state2 = new stepfunctions.Pass(intermediateParent, 'State');

    const parallel = new stepfunctions.Parallel(stack, 'Parallel')
      .branch(state1)
      .branch(state2);

    // WHEN
    expect(() => render(parallel)).toThrow();
  }),

  test('No cross-parallel jumps', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const state1 = new stepfunctions.Pass(stack, 'State1');
    const state2 = new stepfunctions.Pass(stack, 'State2');

    expect(() => new stepfunctions.Parallel(stack, 'Parallel')
      .branch(state1.next(state2))
      .branch(state2)).toThrow();
  }),

  describe('findReachableStates', () => {
    test('Can retrieve possible states from initial state', () => {
      // GIVEN
      const stack = new cdk.Stack();
      const state1 = new stepfunctions.Pass(stack, 'State1');
      const state2 = new stepfunctions.Pass(stack, 'State2');
      const state3 = new stepfunctions.Pass(stack, 'State3');

      const definition = state1
        .next(state2)
        .next(state3);

      // WHEN
      const states = stepfunctions.State.findReachableStates(definition.startState);

      // THEN
      expect(state1.id).toStrictEqual(states[0].id);
      expect(state2.id).toStrictEqual(states[1].id);
      expect(state3.id).toStrictEqual(states[2].id);
    });

    test('Does not retrieve unreachable states', () => {
      // GIVEN
      const stack = new cdk.Stack();
      const state1 = new stepfunctions.Pass(stack, 'State1');
      const state2 = new stepfunctions.Pass(stack, 'State2');
      const state3 = new stepfunctions.Pass(stack, 'State3');

      state1.next(state2).next(state3);

      // WHEN
      const states = stepfunctions.State.findReachableStates(state2);

      // THEN
      expect(state2.id).toStrictEqual(states[0].id);
      expect(state3.id).toStrictEqual(states[1].id);
      expect(states.length).toStrictEqual(2);
    });

    test('Works with Choice and Parallel states', () => {
      // GIVEN
      const stack = new cdk.Stack();
      const state1 = new stepfunctions.Choice(stack, 'MainChoice');
      const stateCA = new stepfunctions.Pass(stack, 'StateA');
      const stateCB = new stepfunctions.Pass(stack, 'StateB');
      const statePA = new stepfunctions.Pass(stack, 'ParallelA');
      const statePB = new stepfunctions.Pass(stack, 'ParallelB');
      const state2 = new stepfunctions.Parallel(stack, 'RunParallel');
      const state3 = new stepfunctions.Pass(stack, 'FinalState');
      state2.branch(statePA);
      state2.branch(statePB);
      state1.when(stepfunctions.Condition.stringEquals('$.myInput', 'A' ), stateCA);
      state1.when(stepfunctions.Condition.stringEquals('$.myInput', 'B'), stateCB);
      stateCA.next(state2);
      state2.next(state3);

      const definition = state1.otherwise(stateCA);

      // WHEN
      const statesFromStateCB = stepfunctions.State.findReachableStates(stateCB);
      const statesFromState1 = stepfunctions.State.findReachableStates(definition);

      // THEN
      const expectedFromState1 = [state1, stateCA, stateCB, state2, state3];
      for (let i = 0; i < expectedFromState1.length; i++) {
        expect(statesFromState1[i].id).toStrictEqual(expectedFromState1[i].id);
      }
      expect(statesFromStateCB[0].id).toStrictEqual(stateCB.id);
    });
  });
});

class ReusableStateMachine extends stepfunctions.StateMachineFragment {
  public readonly startState: stepfunctions.State;
  public readonly endStates: stepfunctions.INextable[];
  constructor(scope: constructs.Construct, id: string) {
    super(scope, id);

    const choice = new stepfunctions.Choice(this, 'Choice')
      .when(stepfunctions.Condition.stringEquals('$.branch', 'left'), new stepfunctions.Pass(this, 'Left Branch'))
      .when(stepfunctions.Condition.stringEquals('$.branch', 'right'), new stepfunctions.Pass(this, 'Right Branch'));

    this.startState = choice;
    this.endStates = choice.afterwards().endStates;
  }
}

class SimpleChain extends stepfunctions.StateMachineFragment {
  public readonly startState: stepfunctions.State;
  public readonly endStates: stepfunctions.INextable[];

  private readonly task2: stepfunctions.Task;
  constructor(scope: constructs.Construct, id: string) {
    super(scope, id);

    const task1 = new stepfunctions.Task(this, 'Task1', { task: new FakeTask() });
    this.task2 = new stepfunctions.Task(this, 'Task2', { task: new FakeTask() });

    task1.next(this.task2);

    this.startState = task1;
    this.endStates = [this.task2];
  }

  public catch(state: stepfunctions.IChainable, props?: stepfunctions.CatchProps): SimpleChain {
    this.task2.addCatch(state, props);
    return this;
  }
}

function render(sm: stepfunctions.IChainable) {
  return new cdk.Stack().resolve(new stepfunctions.StateGraph(sm.startState, 'Test Graph').toGraphJson());
}

class FakeTask implements stepfunctions.IStepFunctionsTask {
  public bind(_task: stepfunctions.Task): stepfunctions.StepFunctionsTaskConfig {
    return {
      resourceArn: 'resource',
    };
  }
}
