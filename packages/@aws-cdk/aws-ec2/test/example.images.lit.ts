import ec2 = require("../lib");

/// !show
// Pick a Windows edition to use
const windows = new ec2.WindowsImage(ec2.WindowsVersion.WindowsServer2016EnglishNanoBase);

// Pick the right Amazon Linux edition. All arguments shown are optional
// and will default to these values when omitted.
const amznLinux = new ec2.AmazonLinuxImage({
  generation: ec2.AmazonLinuxGeneration.AmazonLinux,
  edition: ec2.AmazonLinuxEdition.Standard,
  virtualization: ec2.AmazonLinuxVirt.HVM,
  storage: ec2.AmazonLinuxStorage.GeneralPurpose,
});

// For other custom (Linux) images, instantiate a `GenericLinuxImage` with
// a map giving the AMI to in for each region:

const linux = new ec2.GenericLinuxImage({
    'us-east-1': 'ami-97785bed',
    'eu-west-1': 'ami-12345678',
    // ...
});
/// !hide

Array.isArray(windows);
Array.isArray(amznLinux);
Array.isArray(linux);
