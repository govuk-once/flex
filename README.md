# FLEX (Federated Logic and Events eXchange System)

> Monorepo for the business layer known as FLEX

## Installation

### 1. Prerequisites

1. **Node.js:** Recommended install via [nvm](https://github.com/nvm-sh/nvm)
2. **[pre-commit](https://pre-commit.com/)**: `brew install pre-commit`
3. **Nx** install globally: `npm add --global nx@latest`
4. **PNPM** install globally: [Install page](https://pnpm.io/installation)

### 2. Installation

Run the following `make` command to install dependencies and setup pre-commit:

```bash
make init
```

## List of available commands

To see a list of available commands you can run `make` or see below:

```bash
FLEX (Federated Logic and Events eXchange System)

Usage:
  init                  Initialise the project: install dependencies, setup pre-commit
  pre-commit            Run pre-commit against all files
  build                 Build a specific project: make build PROJECT=<project-name>
  build-all             Build all projects
  build-affected        Build only affected projects
  lint                  Lint a specific project: make lint PROJECT=<project-name>
  lint-all              Lint all projects
  lint-affected         Lint only affected projects
  test                  Test a specific project: make test PROJECT=<project-name>
  test-all              Test all unit tests
  test-affected         Test only affected projects
  format                Format all files with Prettier
  format-check          Format check
  graph                 Show dependency graph
  graph-affected        Show affected dependency graph
  projects              List all projects
  projects-libs         List only libraries
  projects-modules      List only modules
  clean                 Remove build output and Nx cache
```

## Repo Overview

```txt
flex/           # Root of the repo
├── libs/       # Shared libraries directory
│   └── utils/  # Shared utils for modules to use
├── tools/      # NX project generators
└── modules/    # Module directory
```

### List of Shared Libraries we have within FLEX

| Repo        | Overview                               | README                         |
| ----------- | -------------------------------------- | ------------------------------ |
| @libs/utils | Shared utils to be used across modules | [Link](./libs/utils/README.md) |

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
