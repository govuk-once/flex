import * as cdk from "aws-cdk-lib";
import * as kms from "aws-cdk-lib/aws-kms";
import { Construct } from "constructs";

export class PartnerEncryption extends Construct {
  public readonly kmsKey: kms.IKey;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.kmsKey = new kms.Key(this, "ThirdPartyEncryptionKey", {
      keySpec: kms.KeySpec.RSA_4096,
      keyUsage: kms.KeyUsage.ENCRYPT_DECRYPT,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
  }
}
