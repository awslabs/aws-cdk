import { expect, haveResource } from '@aws-cdk/assert';
import { Stack } from '@aws-cdk/cdk';
import { Test } from 'nodeunit';
import route53 = require('../lib');

export = {
  'with default ttl'(test: Test) {
    // GIVEN
    const stack = new Stack();

    // WHEN
    const zone = new route53.HostedZone(stack, 'HostedZone', {
      zoneName: 'myzone'
    });

    new route53.BasicRecord(stack, 'Basic', {
      zone,
      recordName: 'www',
      recordType: route53.RecordType.CNAME,
      recordValues: ['zzz']
    });

    // THEN
    expect(stack).to(haveResource('AWS::Route53::RecordSet', {
      Name: "www.myzone.",
      Type: "CNAME",
      HostedZoneId: {
        Ref: "HostedZoneDB99F866"
      },
      ResourceRecords: [
        "zzz"
      ],
      TTL: "1800"
    }));
    test.done();
  },

  'with custom ttl'(test: Test) {
    // GIVEN
    const stack = new Stack();

    // WHEN
    const zone = new route53.HostedZone(stack, 'HostedZone', {
      zoneName: 'myzone'
    });

    new route53.BasicRecord(stack, 'Basic', {
      zone,
      recordName: 'aa',
      recordType: route53.RecordType.CNAME,
      recordValues: ['bbb'],
      ttl: 6077
    });

    // THEN
    expect(stack).to(haveResource('AWS::Route53::RecordSet', {
      Name: "aa.myzone.",
      Type: "CNAME",
      HostedZoneId: {
        Ref: "HostedZoneDB99F866"
      },
      ResourceRecords: [
        "bbb"
      ],
      TTL: "6077"
    }));
    test.done();
  },

  'defaults to zone root'(test: Test) {
    // GIVEN
    const stack = new Stack();

    // WHEN
    const zone = new route53.HostedZone(stack, 'HostedZone', {
      zoneName: 'myzone'
    });

    new route53.BasicRecord(stack, 'Basic', {
      zone,
      recordType: route53.RecordType.A,
      recordValues: ['1.2.3.4'],
    });

    // THEN
    expect(stack).to(haveResource('AWS::Route53::RecordSet', {
      Name: "myzone.",
      Type: "A",
      HostedZoneId: {
        Ref: "HostedZoneDB99F866"
      },
      ResourceRecords: [
        "1.2.3.4"
      ],
    }));
    test.done();
  },

  'A record'(test: Test) {
    // GIVEN
    const stack = new Stack();

    // WHEN
    const zone = new route53.HostedZone(stack, 'HostedZone', {
      zoneName: 'myzone'
    });

    new route53.ARecord(stack, 'A', {
      zone,
      recordName: 'www',
      ipAddresses: [
        '1.2.3.4',
        '5.6.7.8'
      ],
    });

    // THEN
    expect(stack).to(haveResource('AWS::Route53::RecordSet', {
      Name: "www.myzone.",
      Type: "A",
      HostedZoneId: {
        Ref: "HostedZoneDB99F866"
      },
      ResourceRecords: [
        "1.2.3.4",
        "5.6.7.8"
      ],
      TTL: "1800"
    }));
    test.done();
  },

  'AAAA record'(test: Test) {
    // GIVEN
    const stack = new Stack();

    // WHEN
    const zone = new route53.HostedZone(stack, 'HostedZone', {
      zoneName: 'myzone'
    });

    new route53.AaaaRecord(stack, 'AAAA', {
      zone,
      recordName: 'www',
      ipAddresses: [
        '2001:0db8:85a3:0000:0000:8a2e:0370:7334'
      ],
    });

    // THEN
    expect(stack).to(haveResource('AWS::Route53::RecordSet', {
      Name: "www.myzone.",
      Type: "AAAA",
      HostedZoneId: {
        Ref: "HostedZoneDB99F866"
      },
      ResourceRecords: [
        "2001:0db8:85a3:0000:0000:8a2e:0370:7334"
      ],
      TTL: "1800"
    }));
    test.done();
  },

  'CNAME record'(test: Test) {
    // GIVEN
    const stack = new Stack();

    // WHEN
    const zone = new route53.HostedZone(stack, 'HostedZone', {
      zoneName: 'myzone'
    });

    new route53.CnameRecord(stack, 'CNAME', {
      zone,
      recordName: 'www',
      domainName: 'hello',
    });

    // THEN
    expect(stack).to(haveResource('AWS::Route53::RecordSet', {
      Name: "www.myzone.",
      Type: "CNAME",
      HostedZoneId: {
        Ref: "HostedZoneDB99F866"
      },
      ResourceRecords: [
        "hello"
      ],
      TTL: "1800"
    }));
    test.done();
  },

  'TXT record'(test: Test) {
    // GIVEN
    const stack = new Stack();

    // WHEN
    const zone = new route53.HostedZone(stack, 'HostedZone', {
      zoneName: 'myzone'
    });

    new route53.TxtRecord(stack, 'TXT', {
      zone,
      recordName: 'www',
      values: ['should be enclosed with double quotes']
    });

    // THEN
    expect(stack).to(haveResource('AWS::Route53::RecordSet', {
      Name: "www.myzone.",
      Type: "TXT",
      HostedZoneId: {
        Ref: "HostedZoneDB99F866"
      },
      ResourceRecords: [
        '"should be enclosed with double quotes"'
      ],
      TTL: "1800"
    }));
    test.done();
  },

  'SRV record'(test: Test) {
    // GIVEN
    const stack = new Stack();

    // WHEN
    const zone = new route53.HostedZone(stack, 'HostedZone', {
      zoneName: 'myzone'
    });

    new route53.SrvRecord(stack, 'SRV', {
      zone,
      recordName: 'www',
      values: [{
        hostName: 'aws.com',
        port: 8080,
        priority: 10,
        weight: 5
      }]
    });

    // THEN
    expect(stack).to(haveResource('AWS::Route53::RecordSet', {
      Name: "www.myzone.",
      Type: "SRV",
      HostedZoneId: {
        Ref: "HostedZoneDB99F866"
      },
      ResourceRecords: [
        '10 5 8080 aws.com'
      ],
      TTL: "1800"
    }));
    test.done();
  },

  'CAA record'(test: Test) {
    // GIVEN
    const stack = new Stack();

    // WHEN
    const zone = new route53.HostedZone(stack, 'HostedZone', {
      zoneName: 'myzone'
    });

    new route53.CaaRecord(stack, 'CAA', {
      zone,
      recordName: 'www',
      values: [{
        flag: 0,
        tag: route53.CaaTag.ISSUE,
        value: 'ssl.com'
      }]
    });

    // THEN
    expect(stack).to(haveResource('AWS::Route53::RecordSet', {
      Name: "www.myzone.",
      Type: "CAA",
      HostedZoneId: {
        Ref: "HostedZoneDB99F866"
      },
      ResourceRecords: [
        '0 issue "ssl.com"'
      ],
      TTL: "1800"
    }));
    test.done();
  },

  'CAA Amazon record'(test: Test) {
    // GIVEN
    const stack = new Stack();

    // WHEN
    const zone = new route53.HostedZone(stack, 'HostedZone', {
      zoneName: 'myzone'
    });

    new route53.CaaAmazonRecord(stack, 'CAAAmazon', {
      zone,
      recordName: 'www', // should have no effect
    });

    // THEN
    expect(stack).to(haveResource('AWS::Route53::RecordSet', {
      Name: "myzone.",
      Type: "CAA",
      HostedZoneId: {
        Ref: "HostedZoneDB99F866"
      },
      ResourceRecords: [
        '0 issue "amazon.com"'
      ],
      TTL: "1800"
    }));
    test.done();
  },

  'MX record'(test: Test) {
    // GIVEN
    const stack = new Stack();

    // WHEN
    const zone = new route53.HostedZone(stack, 'HostedZone', {
      zoneName: 'myzone'
    });

    new route53.MxRecord(stack, 'MX', {
      zone,
      recordName: 'mail',
      values: [{
        hostName: 'workmail.aws',
        priority: 10
      }]
    });

    // THEN
    expect(stack).to(haveResource('AWS::Route53::RecordSet', {
      Name: "mail.myzone.",
      Type: "MX",
      HostedZoneId: {
        Ref: "HostedZoneDB99F866"
      },
      ResourceRecords: [
        '10 workmail.aws'
      ],
      TTL: "1800"
    }));
    test.done();
  }
};
