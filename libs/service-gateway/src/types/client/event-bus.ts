export interface EventBusClient {
  readonly publish: () => Promise<void>;
}
