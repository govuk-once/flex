import { Function, FunctionCode } from "aws-cdk-lib/aws-cloudfront";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import { Construct } from "constructs";
import * as esbuild from "esbuild";

interface FlexCloudfrontFunctionProps {
  functionSourcePath: string;
}

const supportedV1 = {
  // Note: The const and let statements are not supported.
  "const-and-let": false,
  // The ES 7 exponentiation operator (**) is supported.
  "exponent-operator": true,
  // ES 6 template literals are supported: multiline strings, expression interpolation, and nesting templates.
  "template-literal": true,
  // ES 6 arrow functions are supported, and ES 6 rest parameter syntax is supported.
  arrow: true,
  "rest-argument": true,
  // ES 9 named capture groups are supported.
  "regexp-named-capture-groups": true,
};

const supportedV2 = {
  ...supportedV1,
  // Const and let statements are supported in v2.
  "const-and-let": true,
  // ES 6 await expressions are supported in v2.
  "async-await": true,
};

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
      // If identifiers are minified `handler` will be renamed, and will break the function
      minifyIdentifiers: false,

      minify: false,
      minifyWhitespace: true,
      minifySyntax: true,

      // Makes build output is available in outputFiles
      write: false,

      format: "esm",
      target: "es5",
      // CloudFront Functions run on a platform that is neither 'node' or 'browser', so configuring your code to build for them is pointless
      // platform: "neutral",

      supported: supportedV2,
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
