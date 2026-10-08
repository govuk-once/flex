# Flex

Flex (Federated Logic and Events eXchange) is the serverless platform behind the GOV.UK app, built
on AWS with CDK and TypeScript.

**Documentation: <https://govuk-once.github.io/flex/>**, built from [`docs/`](docs/).

## Working in this repo

Use the Node version in `.nvmrc` and the pnpm version pinned in `package.json`.

```bash
nvm use
pnpm install
pre-commit install
pnpm lint
pnpm tsc
pnpm test
pnpm --filter @flex/docs dev   # the documentation site, with live reload
```

See [Environment setup](https://govuk-once.github.io/flex/start/environment-setup/) for
prerequisites and AWS access, [Working in the repo](https://govuk-once.github.io/flex/start/working-in-the-repo/)
for the commands, and [Conventions](https://govuk-once.github.io/flex/start/conventions/) for
commits, pull requests and documentation.
