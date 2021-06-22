# Amazon Managed Streaming for Apache Kafka Construct Library
<!--BEGIN STABILITY BANNER-->

---

![cfn-resources: Stable](https://img.shields.io/badge/cfn--resources-stable-success.svg?style=for-the-badge)

> All classes with the `Cfn` prefix in this module ([CFN Resources]) are always stable and safe to use.
>
> [CFN Resources]: https://docs.aws.amazon.com/cdk/latest/guide/constructs.html#constructs_lib

![cdk-constructs: Experimental](https://img.shields.io/badge/cdk--constructs-experimental-important.svg?style=for-the-badge)

> The APIs of higher level constructs in this module are experimental and under active development.
> They are subject to non-backward compatible changes or removal in any future version. These are
> not subject to the [Semantic Versioning](https://semver.org/) model and breaking changes will be
> announced in the release notes. This means that while you may use them, you may need to update
> your source code when upgrading to a newer version of this package.

---

<!--END STABILITY BANNER-->

[Amazon MSK](https://aws.amazon.com/msk/) is a fully managed service that makes it easy for you to build and run applications that use Apache Kafka to process streaming data.

The following example creates an MSK Cluster.

```ts
import * as msk from '@aws-cdk/aws-msk';

const cluster = new Cluster(this, 'Cluster', {
  kafkaVersion: msk.KafkaVersion.V2_6_1,
  vpc,
});
```

## Allowing Connections

To control who can access the Cluster, use the `.connections` attribute. For a list of ports used by MSK, refer to the [MSK documentation](https://docs.aws.amazon.com/msk/latest/developerguide/client-access.html#port-info).

```typescript
import * as msk from "@aws-cdk/aws-msk"
import * as ec2 from "@aws-cdk/aws-ec2"

const cluster = new msk.Cluster(this, "Cluster", {...})

cluster.connections.allowFrom(
  ec2.Peer.ipv4("1.2.3.4/8"),
  ec2.Port.tcp(2181)
)
cluster.connections.allowFrom(
  ec2.Peer.ipv4("1.2.3.4/8"),
  ec2.Port.tcp(9094)
)
```

## Cluster Endpoints

You can use the following attributes to get a list of the Kafka broker or ZooKeeper node endpoints

```typescript
new cdk.CfnOutput(this, 'BootstrapBrokers', { value: cluster.bootstrapBrokers });
new cdk.CfnOutput(this, 'BootstrapBrokersTls', { value: cluster.bootstrapBrokersTls });
new cdk.CfnOutput(this, 'BootstrapBrokersSaslScram', { value: cluster.bootstrapBrokersSaslScram });
new cdk.CfnOutput(this, 'ZookeeperConnection', { value: cluster.zookeeperConnectionString });
new cdk.CfnOutput(this, 'ZookeeperConnectionTls', { value: cluster.zookeeperConnectionStringTls });
```

## Importing an existing Cluster

To import an existing MSK cluster into your CDK app use the `.fromClusterArn()` method.

```typescript
const cluster = msk.Cluster.fromClusterArn(this, 'Cluster', 'arn:aws:kafka:us-west-2:1234567890:cluster/a-cluster/11111111-1111-1111-1111-111111111111-1')
```

## Client Authentication

### TLS

To enable client authentication with TLS set the `certificateAuthorityArns` property to reference your ACM Private CA. [More info on Private CAs.](https://docs.aws.amazon.com/msk/latest/developerguide/msk-authentication.html)

```typescript
import * as msk from "@aws-cdk/aws-msk"
import * as acmpca from "@aws-cdk/aws-acmpca"

const cluster = new msk.Cluster(this, 'Cluster', {
    ...
    encryptionInTransit: {
      clientBroker: msk.ClientBrokerEncryption.TLS,
    },
    clientAuthentication: msk.ClientAuthentication.tls({
      certificateAuthorities: [
        acmpca.CertificateAuthority.fromCertificateAuthorityArn(
          stack,
          "CertificateAuthority",
          "arn:aws:acm-pca:us-west-2:1234567890:certificate-authority/11111111-1111-1111-1111-111111111111"
        ),
      ],
    }),
  });
});
```

### SASL/SCRAM

Enable client authentication with SASL/SCRAM:

```typescript
import * as msk from "@aws-cdk/aws-msk"

const cluster = new msk.cluster(this, "cluster", {
  ...
  encryptionInTransit: {
    clientBroker: msk.ClientBrokerEncryption.TLS,
  },
  clientAuthentication: msk.ClientAuthentication.sasl({
    scram: true,
  }),
})
```
