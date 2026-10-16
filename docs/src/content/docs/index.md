---
title: Introduction
description: What Flex is, what it does for you and where to start.
sidebar:
  order: 1
---

Flex is a serverless API platform on AWS. It sits between the GOV.UK app and the services the app needs data from, such as UDP (the user data platform), DVLA and notifications.

Each piece of functionality lives in a **domain**: a folder under `domains/` with a typed `domain.config.ts` and some route handlers. The config declares the routes, resources, integrations and feature flags. Flex generates the infrastructure from it: one Lambda per route behind one shared API Gateway.

The platform does the shared work for you:

- **Authentication.** Requests are checked at the edge and again by a Lambda authorizer. Handlers receive a pseudonymous `auth.userId`.
- **Edge protection.** CloudFront, Shield and WAF sit in front of everything.
- **Service-to-service calls.** Domains call other domains and the service gateways through typed integrations. Calls are signed and scoped by IAM to exactly the routes declared.
- **Logging and telemetry.** Structured logs with automatic redaction of secrets and personal data.
- **OpenAPI.** A spec is generated for every domain, and CI fails a pull request that makes a breaking change.

A domain is usually thin: validate the request, call an upstream service, return the response. External services are reached only through Flex-owned service gateways.

## Where to start

| If you want to...                             | Read                                                        |
| --------------------------------------------- | ----------------------------------------------------------- |
| Understand how a request travels through Flex | [How Flex works](/flex/start-here/how-flex-works/)          |
| Check whether Flex can do what you need       | [Current limits](/flex/start-here/current-limits/)          |
| Set up your machine and build a first domain  | [Getting started](/flex/getting-started/environment-setup/) |
| Find your way around the repository           | [Repository tour](/flex/start-here/repository-tour/)        |
| Pick the right guide for a task               | [Which guide do I need?](/flex/start-here/which-guide/)     |
