/// <reference path="./.sst/platform/config.d.ts" />

function isProd(stage: string) {
  return stage === 'production';
}

export default $config({
  app({ stage }) {
    return {
      name: 'sst-demo',
      removal: isProd(stage) ? 'retain' : 'remove',
      protect: isProd(stage),
      home: 'aws',
      providers: {
        aws: {
          region: 'eu-west-2',
        },
      },
    };
  },
  async run() {
    const api = new sst.aws.ApiGatewayV2('FlexApiGateway');
    api.addAuthorizer({
      name: 'basicJWTAuthorizer',
      lambda: {
        function: 'modules/udp/adapters/auth-validation/example.handler',
      },
    });

    api.route(
      'GET /user/{userId}/topics',
      'domains/udp/handlers/getTopics/handler.handler',
    );
    api.route(
      'POST /user/{userId}/topics',
      'domains/udp/handlers/createTopics/handler.handler',
    );
    api.route(
      'DELETE /user/{userId}/topics',
      'domains/udp/handlers/deleteTopics/handler.handler',
    );
  },
});
