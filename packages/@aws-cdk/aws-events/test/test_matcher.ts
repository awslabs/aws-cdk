import {Test} from 'nodeunit';
import {Matcher} from '../lib';

// tslint:disable:object-literal-key-quotes

export = {
    'match single value'(test: Test) {
        const matcher = Matcher.match("aws.ec2");

        test.equal(matcher, ["aws.ec2"]);
        test.done();
    },

    'match multiple values'(test: Test) {
        const matcher = Matcher.match("aws.ec2", "aws.ecs");

        test.equal(matcher, ["aws.ec2", "aws.ecs"]);
        test.done();
    },

    'match prefix'(test: Test) {
        const matcher = Matcher.matchPrefix("aws.");

        test.equal(matcher, [{prefix: "aws."}]);
        test.done();
    },

    'match anything-but value'(test: Test) {
        const matcher = Matcher.matchAnythingBut("aws.ec2");

        test.equal(matcher, [{"anything-but": "aws.ec2"}]);
        test.done();
    },

    'match anything-but values'(test: Test) {
        const matcher = Matcher.matchAnythingBut("aws.ec2", "aws.ecs");

        test.equal(matcher, [{"anything-but": ["aws.ec2", "aws.ecs"]}]);
        test.done();
    },

    'match anything-but prefix'(test: Test) {
        const matcher = Matcher.matchAnythingButPrefix("aws.");

        test.equal(matcher, [{"anything-but": {prefix: "aws."}}]);
        test.done();
    },

    'match CIDR'(test: Test) {
        const matcher = Matcher.matchCidr("192.0.0.1/24");

        test.equal(matcher, [{"cidr": "192.0.0.1/24"}]);
        test.done();
    },

    'match exists'(test: Test) {
        const matcher = Matcher.matchExists(true);

        test.equal(matcher, [{"exists": true}]);
        test.done();
    },

    'match not exists'(test: Test) {
        const matcher = Matcher.matchExists(false);

        test.equal(matcher, [{"exists": false}]);
        test.done();
    },
};