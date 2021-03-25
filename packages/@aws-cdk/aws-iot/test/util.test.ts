import { nodeunitShim, Test } from 'nodeunit-shim';
import { parseRuleName } from '../lib/util';

nodeunitShim({
  ruleNameFromArn: {
    'produce rule name from topic rule arn'(test: Test) {
      const topicRuleArn = 'arn:aws:iot:::rule/hello';
      test.deepEqual(parseRuleName(topicRuleArn), 'hello');
      test.done();
    },
  },
});
