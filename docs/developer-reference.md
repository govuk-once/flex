# Developer Reference

Common patterns, best practices and workflows when developing on FLEX.

---

## Handler Patterns

Domain handlers are built using the [@flex/sdk](/libs/sdk/README.md) package. The SDK provides a declarative configuration API and a typed handler factory that conditionally includes context properties based on the route definition.

See the [Domain Development Guide: Handler Patterns](/docs/domain-development.md#handler-patterns) for all handler examples including authentication, request body/query validation, path parameters, resources, integrations, headers and route context.

See [@flex/sdk](/libs/sdk/README.md) for full API reference on domain configuration, resources, integrations, headers and other configuration options.

## Testing

See [Domain Development Guide: Testing](/docs/domain-development.md#testing) for handler test setup, patterns and examples.

## Lambda Constructs

Lambda constructs are managed by the SDK based on the `access` field specified in your domain configuration. The table below is a reference for platform engineers maintaining the construct implementations.

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

### Entry Point Helpers

Use `getDomainEntry` for domain handlers and `getPlatformEntry` for platform handlers:

```typescript
import { getDomainEntry, getPlatformEntry } from "./utils/getEntry";

// Domain handler: domains/domain/src/handlers/handler/method.ts
getDomainEntry("domain", "handlers/handler/method.ts");

// Platform handler: platform/domains/domain/src/handler.ts
getPlatformEntry("domain", "handler.ts");
```

---

## Related

**FLEX:**

- [@flex/sdk](/libs/sdk/README.md)
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
