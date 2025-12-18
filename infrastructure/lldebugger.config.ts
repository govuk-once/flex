import { type LldConfigTs } from 'lambda-live-debugger';
import { LambdaClient, GetFunctionCommand } from '@aws-sdk/client-lambda';

export default {
  framework: 'cdk',
  region: 'eu-west-2',
  context: [],
  observable: false,
  verbose: false,
  // Filter to specific functions and verify they still exist
  // This prevents the debugger from crashing when Lambdas are deleted
  getLambdas: async (foundLambdas) => {
    if (!foundLambdas) return [];
    
    const filtered = foundLambdas.filter((l) => 
      l.functionName.includes('FlexApiStack')
    );
    
    // Verify Lambdas still exist (handles deleted Lambdas gracefully)
    // If AWS SDK is not available or there's an error, return filtered list anyway
    try {
      const lambdaClient = new LambdaClient({ region: 'eu-west-2' });
      const existingLambdas = [];
      
      for (const lambda of filtered) {
        try {
          await lambdaClient.send(
            new GetFunctionCommand({ FunctionName: lambda.functionName })
          );
          existingLambdas.push(lambda);
        } catch (error: any) {
          // Lambda doesn't exist (deleted) - skip it gracefully
          if (error.name === 'ResourceNotFoundException') {
            console.warn(
              `⚠️  Lambda ${lambda.functionName} not found (may have been deleted), skipping...`
            );
            continue;
          }
          // Other errors - log but include the Lambda anyway (might be a transient error)
          console.warn(
            `⚠️  Error checking Lambda ${lambda.functionName}: ${error.message}`
          );
          existingLambdas.push(lambda); // Include it anyway to avoid false positives
        }
      }
      
      return existingLambdas;
    } catch (error) {
      // If validation fails entirely, return filtered list anyway
      // The debugger will handle missing Lambdas at runtime
      console.warn('⚠️  Could not validate Lambda existence, using all found Lambdas');
      return filtered;
    }
  },
} satisfies LldConfigTs;

