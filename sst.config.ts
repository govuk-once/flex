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
    const api = new sst.aws.ApiGatewayV2('TestAPI');
    api.addAuthorizer({
      name: 'basicJWTAuthorizer',
      lambda: {
        function: 'src/handlers/auth/example.handler',
      },
      // jwt: {
      //   issuer: "https://example.com/",
      //   audiences: ["https://api.example.com/"],
      //   identitySource: "$request.header.AccessToken"
      // }
    });

    api.route('GET /user/topics', 'src/handlers/user/topics/get.handler');
    api.route('POST /user/topics', 'src/handlers/user/topics/post.handler');
  },
});
