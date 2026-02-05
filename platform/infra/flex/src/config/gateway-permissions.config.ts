// Conceptual example, not exact code

// 1) Declare the list of known domains so typos fail at compile time
export type DomainId = "udp" | "hello" | "auth" | "dvla"; // etc.

// 2) Domain dependency matrix, using your existing shape
export const DOMAIN_DEPENDENCY_MATRIX: DomainDependencyMatrix = {
  udp: {
    domains: [], // udp can call auth domain
  },
  hello: {
    domains: ["udp"], // hello can call udp domain
  },
};

export interface ExtendedDomainDependency {
  gateways: string[];
  domains: string[];
  methods?: string[]; // e.g. ["GET", "POST"]
}
