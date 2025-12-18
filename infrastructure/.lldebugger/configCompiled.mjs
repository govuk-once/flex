import { createRequire as topLevelCreateRequire } from 'module';const require = topLevelCreateRequire(import.meta.url);
var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
import { LambdaClient, GetFunctionCommand } from "@aws-sdk/client-lambda";
var lldebugger_config_default = {
  framework: "cdk",
  region: "eu-west-2",
  context: [],
  observable: false,
  verbose: false,
  // Filter to specific functions and verify they still exist
  // This prevents the debugger from crashing when Lambdas are deleted
  getLambdas: /* @__PURE__ */ __name(async (foundLambdas) => {
    if (!foundLambdas) return [];
    const filtered = foundLambdas.filter(
      (l) => l.functionName.includes("FlexApiStack")
    );
    try {
      const lambdaClient = new LambdaClient({ region: "eu-west-2" });
      const existingLambdas = [];
      for (const lambda of filtered) {
        try {
          await lambdaClient.send(
            new GetFunctionCommand({ FunctionName: lambda.functionName })
          );
          existingLambdas.push(lambda);
        } catch (error) {
          if (error.name === "ResourceNotFoundException") {
            console.warn(
              `\u26A0\uFE0F  Lambda ${lambda.functionName} not found (may have been deleted), skipping...`
            );
            continue;
          }
          console.warn(
            `\u26A0\uFE0F  Error checking Lambda ${lambda.functionName}: ${error.message}`
          );
          existingLambdas.push(lambda);
        }
      }
      return existingLambdas;
    } catch (error) {
      console.warn("\u26A0\uFE0F  Could not validate Lambda existence, using all found Lambdas");
      return filtered;
    }
  }, "getLambdas")
};
export {
  lldebugger_config_default as default
};
//# sourceMappingURL=configCompiled.mjs.map
