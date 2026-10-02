
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

async function main() {
    const domainsRoot = path.resolve("domains");
    const openApiRoot = path.resolve("dist/openapi/current");
    const outputPath = path.resolve("dist/openapi/merged-openapi.json");

    const index = JSON.parse(
        fs.readFileSync(path.join(openApiRoot, "index.json"), "utf8"),
    );

    const merged: {
        openapi: string;
        info: {
            title: string;
            version: string;
        };
        paths: Record<string, Record<string, unknown>>;
        components: {
            schemas: Record<string, unknown>;
        };
    } = {
        openapi: "3.1.0",
        info: {
            title: "Flex API - ZAP",
            version: "1.0.0",
        },
        paths: {},
        components: {
            schemas: {},
        },
    };

    const expectedOperations = new Set<string>();

    for (const domain of index.domains) {
        const configPath = path.join(
            domainsRoot,
            domain.name,
            "domain.config.ts",
        );

        const { config } = await import(
            pathToFileURL(configPath).href,
        );

        const spec = JSON.parse(
            fs.readFileSync(
                path.join(openApiRoot, domain.spec),
                "utf8",
            ),
        );

        if (spec.components?.schemas) {
            Object.assign(
                merged.components.schemas,
                spec.components.schemas,
            );
        }

        for (const [version, routes] of Object.entries(
            config.routes ?? {},
        )) {
            for (const [sdkPath, methods] of Object.entries(
                routes as Record<string, any>,
            )) {
                for (const [method, route] of Object.entries(
                    methods as Record<string, any>,
                )) {
                    // Only scan explicitly public API routes.
                    if (!route?.public) {
                        continue;
                    }

                    const openApiPath =
                        `/app/${domain.name}/${version}${sdkPath}`
                            .replace(/:([A-Za-z_]\w*)/g, "{$1}")
                            .replace(/\[([A-Za-z_]\w*)\]/g, "{$1}");

                    const operation =
                        spec.paths?.[openApiPath]?.[method.toLowerCase()];

                    if (!operation) {
                        throw new Error(
                            `Missing generated operation: ${method} ${openApiPath}`,
                        );
                    }

                    const operationKey =
                        `${method.toLowerCase()} ${openApiPath}`;

                    if (expectedOperations.has(operationKey)) {
                        throw new Error(
                            `Duplicate public API operation: ${operationKey}`,
                        );
                    }

                    expectedOperations.add(operationKey);

                    merged.paths[openApiPath] ??= {};

                    const zapOperation = structuredClone(operation);

                    zapOperation.operationId =
                        `${domain.name}-${version}-${method.toLowerCase()}-${sdkPath}`
                            .replace(/[^A-Za-z0-9_-]/g, "-")
                            .replace(/-+/g, "-")
                            .replace(/^-|-$/g, "");

                    merged.paths[openApiPath][method.toLowerCase()] =
                        zapOperation;

                    console.log(`Included: ${method} ${openApiPath}`);
                }
            }
        }
    }

    // Validate all configured public API operations.
    if (expectedOperations.size === 0) {
        throw new Error(
            "No public API operations were found for the ZAP scan.",
        );
    }

    const mergedOperations = new Set(
        Object.entries(merged.paths).flatMap(
            ([routePath, methods]) =>
                Object.keys(methods).map(
                    (method) => `${method} ${routePath}`,
                ),
        ),
    );

    const missingOperations = [...expectedOperations].filter(
        (operation) => !mergedOperations.has(operation),
    );

    const unexpectedOperations = [...mergedOperations].filter(
        (operation) => !expectedOperations.has(operation),
    );

    if (missingOperations.length || unexpectedOperations.length) {
        throw new Error(
            `OpenAPI merge mismatch. Missing: ${missingOperations.join(", ") || "none"
            }; unexpected: ${unexpectedOperations.join(", ") || "none"
            }`,
        );
    }

    console.log(
        `Validated ${expectedOperations.size} public API operations.`,
    );

    fs.mkdirSync(path.dirname(outputPath), {
        recursive: true,
    });

    fs.writeFileSync(
        outputPath,
        `${JSON.stringify(merged, null, 2)}\n`,
    );

    console.log(
        `Merged ${Object.keys(merged.paths).length} public paths for ZAP.`,
    );

    console.log(
        `Merged ${Object.keys(merged.components.schemas).length
        } component schemas.`,
    );
}

main().catch((error: unknown) => {
    console.error(
        error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
});
