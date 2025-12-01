# Domains

| Domains | Overview               | README                  |
| ------- | ---------------------- | ----------------------- |
| udp     | udp - application code | [Link](./udp/README.md) |

## File structure

It is recommended for domains to follow the hexagonal architecture (ports and
adapters) principles:

```
src/
  adapters/
    http/            # HTTP client adapter (shared resource)
    auth/            # OAuth2 client credentials provider
  application/
    use-cases/       # Business logic orchestration
  domain/
    models/          # Domain entities and value objects
    ports/           # Interfaces defining contracts
  handlers/          # Lambda handlers for each operation
```

> See `udp` domain for guidance
