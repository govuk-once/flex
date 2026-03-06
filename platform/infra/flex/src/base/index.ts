import * as cdk from "aws-cdk-lib";
import {
  InterfaceVpcEndpoint,
  IVpc,
  SecurityGroup,
  Vpc,
} from "aws-cdk-lib/aws-ec2";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";
import crypto from "crypto";
import { DirectedGraph } from "graphology";
import { willCreateCycle } from "graphology-dag";

import { getEnvConfig } from "./env";
import { BaseStackProps, TagOptions } from "./types";

const { env, stage } = getEnvConfig();

const createKey = ({ region, key }: { region: string; key: string }) =>
  JSON.stringify([region, key]);

const EXTERNAL = "@@EXTERNAL@@";

export class SsmApp extends cdk.App {
  #stacks = new Map<string, BaseStack>();
  #stackGraph = new DirectedGraph();
  #exports = new Map<string, string>(); // region + key = stackId

  addExternalExports(region: string, keys: string[]) {
    keys.forEach((key) => {
      this.addExport(EXTERNAL, region, key);
    });
  }

  addExport(stackId: string, region: string, key: string) {
    const compoundKey = createKey({ region, key });
    const storedStackId = this.#exports.get(compoundKey);

    if (storedStackId !== undefined) {
      throw new Error(
        `${key} in region ${region} already assigned to ${storedStackId} stack.`,
      );
    }

    this.#exports.set(compoundKey, stackId);
  }

  addImport(stackId: string, region: string, key: string) {
    const compoundKey = createKey({ region, key });

    // Check current exports for a stack containing the thing we need
    const storedStackId = this.#exports.get(compoundKey);

    if (storedStackId === undefined) {
      throw new Error(
        `${key} in region ${region} is not available in any defined stacks or externals`,
      );
    }

    if (willCreateCycle(this.#stackGraph, storedStackId, stackId)) {
      throw new Error(
        `Adding key ${key} in region ${region} will create a cyclical dependency between stack ${storedStackId} and ${stackId}`,
      );
    }
    // We add the edge between the two stacks (merge to ignore existing)
    this.#stackGraph.mergeEdge(storedStackId, stackId);
  }

  register(stack: BaseStack) {
    const stackId = stack.stackId;
    if (this.#stacks.has(stackId)) {
      throw new Error(`Stack with id ${stackId} already registered in app`);
    }
    this.#stacks.set(stackId, stack);
  }

  synth(options?: cdk.StageSynthesisOptions): cdk.cx_api.CloudAssembly {
    const { edges } = this.#stackGraph.export();

    edges.forEach(({ source, target }) => {
      const sourceStack = this.#stacks.get(source);
      const targetStack = this.#stacks.get(target);

      // This should only occur if referencing the "EXTERNAL" stack
      if (!sourceStack || !targetStack) return;

      sourceStack.addDependency(targetStack);
    });

    return super.synth(options);
  }
}

export abstract class BaseStack extends cdk.Stack {
  #app: SsmApp;
  #importCache = new Map<string, string>();
  #constructCache = new Map<string, unknown>();

  #hash(string: string) {
    return crypto.createHash("md5").update(string).digest("hex").slice(0, 16);
  }

  #crossRegionRead(key: string, region: string): string {
    const ssmRead: cdk.custom_resources.AwsSdkCall = {
      service: "SSM",
      action: "getParameter",
      parameters: { Name: key },
      region,
      physicalResourceId: cdk.custom_resources.PhysicalResourceId.of(
        `${region}:${key}`,
      ),
    };

    const cr = new cdk.custom_resources.AwsCustomResource(
      this,
      `CrossRegion-${this.#hash(key)}`,
      {
        onCreate: ssmRead,
        onUpdate: ssmRead,
        policy: cdk.custom_resources.AwsCustomResourcePolicy.fromSdkCalls({
          resources: cdk.custom_resources.AwsCustomResourcePolicy.ANY_RESOURCE,
        }),
      },
    );

    return cr.getResponseField("Parameter.Value");
  }

  #addStackTags = (tags: TagOptions) => {
    cdk.Tags.of(this).add("Environment", env, { priority: 100 });
    cdk.Tags.of(this).add("Stage", stage, { priority: 100 });

    Object.entries(tags).forEach(([k, v]) => {
      if (typeof v === "string") {
        cdk.Tags.of(this).add(k, v, { priority: 100 });
      }
    });
  };

  #cachedImport<T>(key: string, factory: (name: string) => T): T {
    const constructName = `Construct-${this.#hash(key)}`;
    const maybeConstruct = this.#constructCache.get(constructName);
    if (maybeConstruct) return maybeConstruct as T;

    const construct = factory(constructName);
    this.#constructCache.set(constructName, construct);
    return construct;
  }

  constructor(app: Construct, id: string, { tags, env }: BaseStackProps) {
    super(app, id, {
      env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: env.region,
      },
    });

    if (!(app instanceof SsmApp)) {
      throw new Error("BaseStack must be used within an SsmApp");
    }

    app.register(this);
    this.#app = app;
    this.#addStackTags(tags);
  }

  protected import(key: string, maybeRegion?: string) {
    const region = maybeRegion ?? this.region;

    const compoundKey = createKey({ region, key });
    const cacheValue = this.#importCache.get(compoundKey);
    if (cacheValue !== undefined) return cacheValue;

    this.#app.addImport(this.stackName, region, key);

    const isRemote = region !== this.region;
    const importValue = isRemote
      ? this.#crossRegionRead(key, region)
      : ssm.StringParameter.valueForStringParameter(this, key);

    this.#importCache.set(compoundKey, importValue);
    return importValue;
  }

  protected export(key: string, value: string) {
    this.#app.addExport(this.stackName, this.region, key);

    new ssm.StringParameter(this, `Param-${this.#hash(key)}`, {
      parameterName: key,
      stringValue: value,
    });
  }

  protected exports(exports: Record<string, string>) {
    Object.entries(exports).forEach(([key, value]) => {
      this.export(key, value);
    });
  }

  protected exportVpc(vpcKey: string, vpc: IVpc) {
    this.exports({
      [`${vpcKey}/vpc-id`]: vpc.vpcId,
      [`${vpcKey}/availability-zones`]: vpc.availabilityZones.join(","),
      [`${vpcKey}/public-subnet-ids`]: vpc.publicSubnets
        .map((s) => s.subnetId)
        .join(","),
      [`${vpcKey}/public-subnet-route-table-ids`]: vpc.publicSubnets
        .map((s) => s.routeTable.routeTableId)
        .join(","),
      [`${vpcKey}/private-subnet-ids`]: vpc.privateSubnets
        .map((s) => s.subnetId)
        .join(","),
      [`${vpcKey}/private-subnet-route-table-ids`]: vpc.privateSubnets
        .map((s) => s.routeTable.routeTableId)
        .join(","),
      [`${vpcKey}/isolated-subnet-ids`]: vpc.isolatedSubnets
        .map((s) => s.subnetId)
        .join(","),
      [`${vpcKey}/isolated-subnet-route-table-ids`]: vpc.isolatedSubnets
        .map((s) => s.routeTable.routeTableId)
        .join(","),
    });
  }

  protected importVpc(vpcKey: string, region?: string) {
    return this.#cachedImport(`Vpc-${this.#hash(vpcKey)}`, (constructName) => {
      const split = (key: string) => {
        const val = this.import(`${vpcKey}/${key}`, region);
        return val ? val.split(",") : [];
      };

      return Vpc.fromVpcAttributes(this, constructName, {
        vpcId: this.import(`${vpcKey}/vpc-id`, region),
        availabilityZones: split("availability-zones"),
        publicSubnetIds: split("public-subnet-ids"),
        publicSubnetRouteTableIds: split("public-subnet-route-table-ids"),
        privateSubnetIds: split("private-subnet-ids"),
        privateSubnetRouteTableIds: split("private-subnet-route-table-ids"),
        isolatedSubnetIds: split("isolated-subnet-ids"),
        isolatedSubnetRouteTableIds: split("isolated-subnet-route-table-ids"),
      });
    });
  }

  protected importSecurityGroup(key: string, region?: string) {
    return this.#cachedImport(`SG-${this.#hash(key)}`, (constructName) => {
      const securityGroupId = this.import(key, region);

      return SecurityGroup.fromSecurityGroupId(
        this,
        constructName,
        securityGroupId,
      );
    });
  }

  protected importInterfaceVpcEndpoint(key: string, region?: string) {
    return this.#cachedImport(`VpcE-${this.#hash(key)}`, (constructName) => {
      const vpcEndpointId = this.import(key, region);

      return InterfaceVpcEndpoint.fromInterfaceVpcEndpointAttributes(
        this,
        constructName,
        { port: 443, vpcEndpointId },
      );
    });
  }
}
