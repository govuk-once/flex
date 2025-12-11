import { type LldConfigTs } from 'lambda-live-debugger';

export default {
  framework: 'cdk',
  region: 'eu-west-2',
  context: [],
  observable: false,
  verbose: false,
  // Filter to specific functions if needed
  getLambdas: async (foundLambdas) => {
    return foundLambdas?.filter((l) => l.functionName.includes('FlexApiStack'));
  },
} satisfies LldConfigTs;

