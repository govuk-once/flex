import type { Environment } from "@flex/utils";

export type Todo = unknown;

export interface GatewayConfig {
  readonly name: string;
  readonly environments: Environment[];
  readonly access: "public" | "private" | "isolated";
  readonly common: Record<string, unknown>;
  readonly resources: Record<string, unknown>;
  readonly integration: Record<string, unknown>;
  readonly routes: Record<string, unknown>;
}
