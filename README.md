# FLEX (Federated Logic and Events eXchange System)

> Monorepo for the business layer known as FLEX internally

## Installation

### 1. Prerequisites

1. **Node.js:** Recommended install via [nvm](https://github.com/nvm-sh/nvm)
2. **[pre-commit](https://pre-commit.com/)**: `brew install pre-commit`
3. **Nx** install globally: `npm add --global nx@latest`
4. **Terraform CLI** `>=1.8`: `brew tap hashicorp/tap && brew install hashicorp/tap/terraform`
5. **Terragrunt**: `brew install terragrunt`
6. **TFLint**: `brew install tflint`
7. **Checkov**: `brew install checkov`

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
  terraform-init        Initialise Terraform providers for infra/bootstrap
  terragrunt-init       Initialise Terragrunt to wrap the shared Terraform sources
  tflint                Run TFLint with the configured AWS ruleset
  checkov               Execute Checkov against the infra directory
```

## Repo Overview

```txt
flex/
├── libs/        # Shared libraries directory
│   └── utils/   # Shared utils for modules to use
└── modules/     # Module directory
```

| Repo             | Overview                               | README                              |
| ---------------- | -------------------------------------- | ----------------------------------- |
| @modules/example | Example module repo                    | [Link](./modules/example/README.md) |
| @libs/utils      | Shared utils to be used across modules | [Link](./libs/utils/README.md)      |
| infra            | Terraform/Terragrunt bounded context   | (this file)                         |

## Infrastructure

### Folder Structure

The `infra/` contains the core infrastructure owned and maintained by the FLEX platform. Core infra is orchestrated through Terragrunt to support environment-specific stacks. Each workspace inherits the same AWS provider configuration and linting standards enforced through `.tflint.hcl`, `.terraformignore`, and Checkov.

### Quick start

1. `make terraform-init`
2. `make terragrunt-init`
3. `make tflint`
4. `make checkov`

## Committing work

When wanting to commit changes please first squash your commits.

### Simple command line procedure

Get the current number of commits on your branch:

```bash
git rev-list --count HEAD ^main
```

Supposing this returns 3 then you have made 3 commits since creating your branch and you want to squash them down into one:

```bash
git rebase -i HEAD~3
```

Which will launch an interactive rebase session in the terminal.
