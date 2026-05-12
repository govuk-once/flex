import {
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { ZodType } from "zod";
import { createDocument } from "zod-openapi";
import type {
  ZodOpenApiObject,
  ZodOpenApiOperationObject,
  ZodOpenApiParameterObject,
  ZodOpenApiParameters,
  ZodOpenApiPathsObject,
} from "zod-openapi";

const DEFAULT_DOMAINS_ROOT = "domains";
const DEFAULT_OUTPUT_ROOT = "docs/specs";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

const HTTP_METHODS: readonly HttpMethod[] = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
];

interface HeaderConfig {
  readonly name: string;
  readonly required?: boolean;
}

interface MethodConfig {
  readonly name: string;
  readonly body?: ZodType;
  readonly query?: ZodType;
  readonly response?: ZodType;
  readonly headers?: Readonly<Record<string, HeaderConfig>>;
}

interface GatewayConfig {
  readonly public?: MethodConfig;
  readonly private?: MethodConfig;
}

interface DomainConfigShape {
  readonly routes?: Readonly<
    Record<
      string,
      Readonly<Record<string, Partial<Record<HttpMethod, GatewayConfig>>>>
    >
  >;
}

interface RouteOperation {
  readonly version: string;
  readonly method: HttpMethod;
  readonly path: string;
  readonly routeName: string;
  readonly bodySchema?: ZodType;
  readonly querySchema?: ZodType;
  readonly responseSchema?: ZodType;
  readonly headers?: Readonly<Record<string, HeaderConfig>>;
}

interface DiscoveredDomain {
  readonly name: string;
  readonly configPath: string;
}

const PATH_PARAM_PATTERNS: readonly RegExp[] = [
  /:([A-Za-z_][A-Za-z0-9_]*)/g,
  /\[([A-Za-z_][A-Za-z0-9_]*)\]/g,
];

function discoverDomains(domainsRoot: string): DiscoveredDomain[] {
  const root = resolve(domainsRoot);
  if (!existsSync(root)) return [];

  return readdirSync(root)
    .filter((name) => !name.startsWith("."))
    .map((name) => ({ name, dir: resolve(root, name) }))
    .filter(({ dir }) => isDirectory(dir))
    .map(({ name, dir }) => ({
      name,
      configPath: resolve(dir, "domain.config.ts"),
    }))
    .filter(({ configPath }) => existsSync(configPath))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

async function loadDomainConfig(
  configPath: string,
): Promise<DomainConfigShape> {
  const moduleUrl = pathToFileURL(configPath).href;
  const imported = (await import(moduleUrl)) as { config?: unknown };
  if (!imported.config || typeof imported.config !== "object") {
    throw new Error(`${configPath} does not export a \`config\` object`);
  }
  return imported.config as DomainConfigShape;
}

function buildDomainDocument(
  domainName: string,
  config: DomainConfigShape,
): unknown {
  const operations = extractOperations(config);
  const document: ZodOpenApiObject = {
    openapi: "3.1.0",
    info: {
      title: `${domainName} domain`,
      version: "1.0.0",
      description: `Auto-generated from \`domains/${domainName}/domain.config.ts\`. Do not edit by hand. Regenerate with \`pnpm openapi:generate\`.`,
    },
    paths: assemblePaths(operations),
  };
  return createDocument(document);
}

function extractOperations(config: DomainConfigShape): RouteOperation[] {
  return Object.entries(config.routes ?? {}).flatMap(([version, paths]) =>
    Object.entries(paths).flatMap(([path, methods]) =>
      HTTP_METHODS.map((method) =>
        toOperation(version, path, method, methods[method]),
      ).filter((op): op is RouteOperation => op !== null),
    ),
  );
}

function toOperation(
  version: string,
  path: string,
  method: HttpMethod,
  gateways: GatewayConfig | undefined,
): RouteOperation | null {
  if (!gateways) return null;
  // Private wins on collision (only udp's GET /identity/:service today):
  // the private declaration carries the richer contract — required
  // headers, response schemas — that the public one omits.
  const chosen = gateways.private ?? gateways.public;
  if (!chosen) return null;

  return {
    version,
    method,
    path,
    routeName: chosen.name,
    bodySchema: chosen.body,
    querySchema: chosen.query,
    responseSchema: chosen.response,
    headers: chosen.headers,
  };
}

function assemblePaths(
  operations: readonly RouteOperation[],
): ZodOpenApiPathsObject {
  const paths: ZodOpenApiPathsObject = {};
  operations.forEach((op) => {
    const openApiPath = `/${op.version}${toOpenApiPath(op.path)}`;
    const lowerMethod = op.method.toLowerCase() as Lowercase<HttpMethod>;
    paths[openApiPath] ??= {};
    paths[openApiPath][lowerMethod] = buildOperation(op);
  });
  return paths;
}

function buildOperation(op: RouteOperation): ZodOpenApiOperationObject {
  const operation: ZodOpenApiOperationObject = {
    operationId: op.routeName,
    summary: `${op.method} ${op.path}`,
    responses: {
      "200": op.responseSchema
        ? {
            description: "Successful response.",
            content: { "application/json": { schema: op.responseSchema } },
          }
        : { description: "Successful response." },
    },
  };

  const parameters = [
    ...buildPathParameters(op.path),
    ...buildHeaderParameters(op.headers),
  ];
  if (parameters.length > 0) operation.parameters = parameters;

  if (op.bodySchema) {
    operation.requestBody = {
      required: true,
      content: { "application/json": { schema: op.bodySchema } },
    };
  }

  if (op.querySchema) {
    operation.requestParams = {
      query: op.querySchema as ZodOpenApiParameters["query"],
    };
  }

  return operation;
}

function buildPathParameters(path: string): ZodOpenApiParameterObject[] {
  return extractPathParamNames(path).map((name) => ({
    in: "path",
    name,
    required: true,
    schema: { type: "string" },
  }));
}

function buildHeaderParameters(
  headers: RouteOperation["headers"],
): ZodOpenApiParameterObject[] {
  if (!headers) return [];
  return Object.values(headers).map((header) => ({
    in: "header",
    name: header.name,
    required: header.required ?? false,
    schema: { type: "string" },
  }));
}

function extractPathParamNames(path: string): readonly string[] {
  return PATH_PARAM_PATTERNS.flatMap((pattern) =>
    [...path.matchAll(pattern)]
      .map((m) => m[1])
      .filter((name): name is string => name !== undefined),
  );
}

function toOpenApiPath(sdkPath: string): string {
  return PATH_PARAM_PATTERNS.reduce(
    (acc, pattern) => acc.replace(pattern, "{$1}"),
    sdkPath,
  );
}

interface CliArgs {
  readonly domainsRoot: string;
  readonly outputRoot: string;
}

type MutableCliArgs = { -readonly [K in keyof CliArgs]: CliArgs[K] };

const FLAG_HANDLERS: Readonly<
  Record<string, (value: string, args: MutableCliArgs) => void>
> = {
  "--domains-root": (value, args) => {
    args.domainsRoot = value;
  },
  "--output-root": (value, args) => {
    args.outputRoot = value;
  },
};

type FlagHandler = (typeof FLAG_HANDLERS)[keyof typeof FLAG_HANDLERS];

function parseArgs(argv: readonly string[]): CliArgs {
  const args: MutableCliArgs = {
    domainsRoot: DEFAULT_DOMAINS_ROOT,
    outputRoot: DEFAULT_OUTPUT_ROOT,
  };

  argv
    .map((flag, i) => ({
      value: argv[i + 1],
      handler: FLAG_HANDLERS[flag],
    }))
    .filter(
      (entry): entry is { value: string; handler: FlagHandler } =>
        entry.value !== undefined && entry.handler !== undefined,
    )
    .forEach(({ value, handler }) => {
      handler(value, args);
    });

  return args;
}

async function main(argv: readonly string[]): Promise<number> {
  const { domainsRoot, outputRoot } = parseArgs(argv);
  const cwd = process.cwd();
  const absDomainsRoot = resolve(cwd, domainsRoot);
  const absOutputRoot = resolve(cwd, outputRoot);

  const domains = discoverDomains(absDomainsRoot);
  if (domains.length === 0) {
    process.stderr.write(`no domains found under ${absDomainsRoot}\n`);
    return 1;
  }

  process.stdout.write(
    `generating openapi for ${String(domains.length)} domain(s):\n`,
  );

  const writes = await Promise.all(
    domains.map(async (domain) => {
      const config = await loadDomainConfig(domain.configPath);
      const doc = buildDomainDocument(domain.name, config);
      const outputPath = resolve(absOutputRoot, `${domain.name}.json`);
      mkdirSync(dirname(outputPath), { recursive: true });
      writeFileSync(outputPath, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
      return { name: domain.name, outputPath };
    }),
  );

  const indexPath = resolve(absOutputRoot, "index.json");
  const index = {
    domains: writes
      .map(({ name }) => ({ name, spec: `specs/${name}.json` }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
  writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`, "utf8");

  writes.forEach(({ name, outputPath }) => {
    process.stdout.write(`  → ${name}: ${outputPath}\n`);
  });
  process.stdout.write(`  → index: ${indexPath}\n`);
  process.stdout.write(
    `done — ${String(writes.length)} document(s) written.\n`,
  );
  return 0;
}

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(2);
  });
