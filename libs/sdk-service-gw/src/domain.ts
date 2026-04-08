export function domain<
  const Config extends DomainConfig<InferResourceKeys<Config>>,
>(config: Config): DomainResult<Config> {
  return {
    config,
    route: createRouteHandler(config),
    routeContext: createRouteContext(config),
  };
}

export interface DomainConfig<ResourceKeys extends string = string> {
  readonly name: string;
  readonly common?: DomainConfigCommon;
  readonly owner?: string;
  readonly resources?: Readonly<Record<ResourceKeys, DomainResource>>;
}
