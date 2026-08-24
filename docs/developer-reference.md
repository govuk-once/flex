# Developer Reference

Common patterns, best practices and workflows when developing on FLEX.

---

## Handler Patterns

FLEX has two kinds of Lambda handler:

- Domain Handlers: Built with [@flex/sdk](/libs/sdk/README.md)
- Service Gateway Handlers: Built with [@flex/service-gateway](/libs/service-gateway/README.md)

Both implementations provide a declarative configuration API and handler factory that includes context properties based on the route definition. Each solution exists for different purposes and are not interchangeable.

| Handler Type    | Package                                                  | Purpose                                                 |
| --------------- | -------------------------------------------------------- | ------------------------------------------------------- |
| Domain          | [@flex/sdk](/libs/sdk/README.md)                         | Business logic for a FLEX domain's public/private API   |
| Service Gateway | [@flex/service-gateway](/libs/service-gateway/README.md) | Proxies a remote third-party API behind a FLEX contract |

Domain handlers authenticate the caller and can call other domains or gateways via integrations. Service gateway handlers have no `auth` on their context and instead build outbound `clients` to communnicate with third-party APIs, see [Service Gateway Development](/docs/platform-development.md#service-gateway-development).

See the [Domain Development Guide: Handler Patterns](/docs/domain-development.md#handler-patterns) for all domain handler examples including authentication, request body/query validation, path parameters, resources, integrations, headers and route context.

See [@flex/sdk](/libs/sdk/README.md) for full API reference on domain configuration, resources, integrations, headers and other configuration options.

See [@flex/service-gateway](/libs/service-gateway/README.md) for the full API reference on gateway configuration, resources, clients and headers.

## Testing

See [Domain Development Guide: Testing](/docs/domain-development.md#testing) for domain handler test setup, patterns and examples.

See [Platform Development Guide: Testing Service Gateways](/docs/platform-development.md#testing-service-gateways) for service gateway test setup, patterns and examples. Gateway tests use a different fixture set (`platform.gatewayEvent`, `platform.gatewayResult`) to domain handler tests, and are not interchangeable with the domain testing approach.

## Lambda Constructs

Lambda constructs are managed by the SDK or the service gateway library based on the `access` field specified in your domain or gateway configuration. The table below is a reference for platform engineers maintaining the construct implementations.

### Choosing a Construct

| Construct                     | Internet Access | VPC Resources | Use Case                              |
| ----------------------------- | --------------- | ------------- | ------------------------------------- |
| `FlexPublicFunction`          | Yes             | No            | Simple handlers, public APIs          |
| `FlexPrivateEgressFunction`   | Yes (NAT)       | Yes           | Calling external APIs + VPC resources |
| `FlexPrivateIsolatedFunction` | No              | Yes           | Internal processing                   |

```text
Does your handler need to call external APIs?
├── Yes → FlexPrivateEgressFunction
└── No
    └── Does your handler need VPC resources?
        ├── Yes → FlexPrivateIsolatedFunction
        └── No → FlexPublicFunction
```

Domain developers set the `access` field on a route or in the domain configuration "common" options. The platform maps these values to the appropriate Lambda construct:

| Value        | Lambda                        |
| ------------ | ----------------------------- |
| `"public"`   | `FlexPublicFunction`          |
| `"private"`  | `FlexPrivateEgressFunction`   |
| `"isolated"` | `FlexPrivateIsolatedFunction` |

The default is `"isolated"` when no `access` value is specified.

### Service Gateway Access

Service gateways declare `access` once for the whole gateway in `gateway.config.ts`, and only support `"private"` and `"isolated"` functions.

| Value        | Lambda                        | Use Case                                                             |
| ------------ | ----------------------------- | -------------------------------------------------------------------- |
| `"private"`  | `FlexPrivateEgressFunction`   | Calls a remote API over the public internet                          |
| `"isolated"` | `FlexPrivateIsolatedFunction` | Target is reachable within the VPC, via a SigV4-signed internal call |

There is no default for gateway `access` and must be set explicitly in `gateway.config.ts`. See [Configuration](/libs/service-gateway/README.md#configuration) for the full reference.

### Entry Point Helpers

Use `getDomainEntry` for domain handlers and `getPlatformEntry` for platform handlers:

```typescript
import { getDomainEntry, getPlatformEntry } from "./utils/getEntry";

// Domain handler: domains/domain/src/handlers/handler/method.ts
getDomainEntry("domain", "handlers/handler/method.ts");

// Platform handler: platform/domains/domain/src/handler.ts
getPlatformEntry("domain", "handler.ts");
```

Service gateways do not use either helper. Every `gateway.config.ts` under `platform/domains/*` is discovered and provisioned automatically, so there is no manual entry point to wire up, see [Service Gateway Infrastructure](/docs/platform-development.md#service-gateway-infrastructure).

---

## Related

**FLEX:**

- [@flex/sdk](/libs/sdk/README.md)
- [@flex/service-gateway](/libs/service-gateway/README.md)
- [@flex/logging](/libs/logging/README.md)
- [@flex/testing](/libs/testing/README.md)
- [@flex/utils](/libs/utils/README.md)
- [@platform/flex](/platform/infra/flex/README.md)

**Guides:**

- [Environment Setup](/docs/environment-setup.md)
- [Platform Development Guide](/docs/platform-development.md)
- [Domain Development Guide](/docs/domain-development.md)
- [Deployment Guide](/docs/deployment.md)
- [Documentation Guide](/docs/documentation-guide.md)
