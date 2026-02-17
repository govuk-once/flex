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
      format: "esm",
      target: "es5",

      // If identifiers are minified `handler` will be renamed, and will break the function
      minify: false,
      minifyIdentifiers: false,
      minifyWhitespace: true,
      minifySyntax: true,

      // Makes build output is available in outputFiles
      write: false,

      // https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/functions-javascript-runtime-features.html
      supported: {
        "const-and-let": true,
        "exponent-operator": true,
        "template-literal": true,
        arrow: true,
        "rest-argument": true,
        "regexp-named-capture-groups": true,
        "async-await": true,
      },
    });

    if (buildResult.errors.length > 0 || !buildResult.outputFiles[0]) {
      throw new Error(`Build failed: ${buildResult.errors[0]?.text ?? ""}`);
    }

    const bundledCode = buildResult.outputFiles[0].text;
    // Post-process to extract handler from ES module and expose as top-level function
    const finalCode = this.postProcessCloudFrontFunctionCode(bundledCode);

    this.function = new Function(this, "CloudFrontFunction", {
      code: FunctionCode.fromInline(finalCode),
      comment: "Flex Platform CloudFront Function",
      runtime: cloudfront.FunctionRuntime.JS_2_0,
    });
  }

  /**
   * Post-processes esbuild output to extract the handler function from ES module
   * and expose it as a top-level function for CloudFront Functions.
   *
   * CloudFront Functions require a top-level `handler` function, not an exported one.
   * This function removes export statements from the end of the module.
   */
  private postProcessCloudFrontFunctionCode(code: string): string {
    // Check for arrow function assignments - CloudFront Functions require function declarations
    const arrowFunctionPatterns = [
      /(?:^|,|const\s+|let\s+)(handler)\s*=\s*[^=]*=>/, // handler=event=> or const handler=event=>
      /export\s+(const|let)\s+handler\s*=\s*[^=]*=>/, // export const handler=event=>
    ];

    for (const pattern of arrowFunctionPatterns) {
      if (pattern.test(code)) {
        throw new Error(
          "CloudFront Functions require a function declaration, not an arrow function. " +
            "Please use `export function handler(event) { ... }` instead of `export const handler = (event) => { ... }`",
        );
      }
    }

    // Remove export statements at the end: export{handler}; or export { handler };
    let processedCode = code.replace(/export\s*\{\s*handler\s*\}\s*;?\s*$/, "");

    // Handle regular function exports: export function handler(...)
    processedCode = processedCode.replace(
      /export\s+(async\s+)?function\s+handler\s*\(/g,
      (match, asyncKeyword) => {
        return asyncKeyword ? `async function handler(` : `function handler(`;
      },
    );

    return processedCode.trim();
  }
}
