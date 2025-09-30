## Postcode Lookup Module and DDD Mapping

### Bounded Context
- The postcode lookup capability is isolated under `src/modules/postcode`, with its own domain model, application layer, and infrastructure adapters.

### Ubiquitous Language
- Terms mirror the domain: `Postcode`, `Address`, `PostcodeLookupService`, `PostcodeLookupRepository`.

### Domain Model
- Value Object: `src/modules/postcode/domain/Postcode.ts`
  - Normalises input and enforces format invariants; immutable, equality by value.
- Entity: `src/modules/postcode/domain/Address.ts`
  - Domain representation of an address (read-only in this module).

### Application Layer (Use Case)
- `src/modules/postcode/application/PostcodeLookupService.ts`
  - Orchestrates the use case: validates `Postcode`, queries the repository, and returns DTOs. Contains coordination, not domain rules.

### Ports and Adapters (Hexagonal)
- Port: `src/modules/postcode/application/ports/PostcodeLookupRepository.ts`
  - Abstraction describing how the application accesses address data.
- Adapter: `src/modules/postcode/infrastructure/InMemoryPostcodeLookupRepository.ts`
  - Infrastructure implementation of the port (can be swapped for API/DB without changing domain/app code).

### DTOs (Boundary Contracts)
- `src/modules/postcode/application/dto/PostcodeLookupDTO.ts`
  - `PostcodeLookupRequestDTO`: input contract with `postcode`.
  - `AddressDTO`, `PostcodeLookupResponseDTO`: output contracts reshaping domain `Address` for consumers.
  - Decouple external contracts from domain types; facilitate renaming/reshaping fields.

### Validation and Invariants
- Pushed into the domain via `Postcode.create(...)` to prevent invalid postcodes from entering flows.

### Testing Style (TDD/BDD)
- Unit tests (TDD):
  - `tests/postcode/Postcode.spec.ts`
  - `tests/postcode/PostcodeLookupService.spec.ts`
- BDD-style spec (Given/When/Then) with Vitest:
  - `tests/bdd/postcode.bdd.spec.ts`

### Extensibility Notes
- Add a real adapter (HTTP/DB) by implementing `PostcodeLookupRepository`.
- Introduce aggregates or domain services if future rules span multiple entities or require domain-level operations.
