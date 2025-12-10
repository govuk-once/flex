# FLEX (Federated Logic and Events eXchange System)

![linting](https://github.com/govuk-once/flex/actions/workflows/ci.yml/badge.svg)

> Monorepo for the business layer known as FLEX internally

## Installation

### 1. Prerequisites

1. **Node.js:** Recommended install via [nvm](https://github.com/nvm-sh/nvm)
2. **[pre-commit](https://pre-commit.com/)**: `brew install pre-commit`
3. **PNPM**: [install](https://pnpm.io/installation)

### 2. Installation

Run the following `make` command to install dependencies and setup pre-commit:

```bash
pnpm install --frozen-lockfile
pre-commit install
```

## Useful commands to use

To see a list of available commands you can check `package.json` scripts
here are a few useful commands below:

```bash
pnpm test:affected
pnpm build:affected
pnpm lint:affected
pnpm format:check
```

## Repo Overview

```txt
flex/
├── libs/        # Shared libraries directory
│   └── utils/   # Shared utils for modules to use
└── domains/     # Domains directory (application code)
```

| Repo        | Overview                               | README                         |
| ----------- | -------------------------------------- | ------------------------------ |
| @domains    | Domains - application code             | [Link](./domains/README.md)    |
| @flex/utils | Shared utils to be used across modules | [Link](./libs/utils/README.md) |

## How to generate a new shared library

```bash
npx nx g ./tools/generators:newSharedLib --libName=example
```

> The above command will create a project called `example`

Then you will need to append the new project into the `tsconfig.base.json`
in the case of the example project you would add:

```
"paths": {
  "@flex/utils": ["libs/utils/src/index.ts"]
  "@flex/example": ["libs/example/src/index.ts"]
}
```

## Committing work

When wanting to commit changes please first squash your commits.

### Simple command line procedure

Get the current number of commits on your branch:

```bash
git rev-list --count HEAD ^main
```

Supposing this returns 3 then you have made 3 commits since creating your
branch and you want to squash them down into one:

```bash
git rebase -i HEAD~3
```

Which will launch an interactive rebase session in the terminal.
