# Hello Module

> This module is designed to show the three different network modes available for Lambdas within the platform

This module contains `Hello, World!` examples of the three mechanisms in which lambdas can be deployed on the FLEX platform.

- **Public**: This classification of lambda has full access to the internet and will predominantly be used to communicate with public APIs.
- **Private Egress**: This classification of lambda has limited access to the internet and is controlled via firewall rules.
- **Private Isolated**: This classification of lambda has no access to the internet and can only access internal systems.

---

## Endpoints

| HTTP Method | Path              | Handler                 |
| ----------- | ----------------- | ----------------------- |
| GET         | `/hello-public`   | `hello-public/get.ts`   |
| GET         | `/hello-private`  | `hello-private/get.ts`. |
| GET         | `/hello-isolated` | `hello-isolated/get.ts` |
