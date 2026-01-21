import { Function, FunctionCode } from "aws-cdk-lib/aws-cloudfront";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import { Construct } from "constructs";
import * as esbuild from "esbuild";

interface FlexCloudfrontFunctionProps {
  functionSourcePath: string;
}

export class FlexCloudfrontFunction extends Construct {
  public readonly function: Function;

  constructor(
    scope: Construct,
    id: string,
    props: FlexCloudfrontFunctionProps,
  ) {
    super(scope, id);

    const functionSourcePath = props.functionSourcePath;

    const buildResult = esbuild.buildSync({
      entryPoints: [functionSourcePath],
      bundle: true,
      minify: false,
      write: false,
      format: "esm",
      globalName: "internal_bundle",
      target: "es2020",
      platform: "neutral",
    });

    if (buildResult.errors.length > 0 || !buildResult.outputFiles[0]) {
      throw new Error(`Build failed: ${buildResult.errors[0]?.text}`);
    }

    const finalCode = buildResult.outputFiles[0].text;

    this.function = new Function(this, "StructuralCheckFunction", {
      code: FunctionCode.fromInline(finalCode),
      comment: "Flex Platform CloudFront Function for Structural Checks",
      runtime: cloudfront.FunctionRuntime.JS_2_0,
    });
  }
}
