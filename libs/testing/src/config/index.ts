export const config = {
  userPoolId: {
    env: "USER_POOL_ID_PARAMETER_NAME",
    ssm: "/test/auth/user_pool_id",
    value: "eu-west-2_testUserPoolId",
  },
  redis: {
    endpoint: {
      env: "REDIS_ENDPOINT_PARAMETER_NAME",
      ssm: "/test/cache/redis/endpoint",
      value: "redis-endpoint.example.com:6379",
    },
    tls: {
      env: "REDIS_TLS_ENABLED",
      value: "false",
    },
  },
} as const;

export const ENV_DEFAULTS = {
  [config.userPoolId.env]: config.userPoolId.ssm,
  [config.redis.endpoint.env]: config.redis.endpoint.ssm,
  [config.redis.tls.env]: config.redis.tls.value,
};

export const SSM_DEFAULTS = {
  [config.userPoolId.ssm]: config.userPoolId.value,
  [config.redis.endpoint.ssm]: config.redis.endpoint.value,
};
