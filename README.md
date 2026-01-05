# FLEX (Federated Logic and Events eXchange System)

![linting](https://github.com/govuk-once/flex/actions/workflows/ci.yml/badge.svg)

> Monorepo for the business layer known as FLEX internally

## Installation

### 1. Prerequisites

1. **Node.js:** Recommended install via [nvm](https://github.com/nvm-sh/nvm)
2. **[pre-commit](https://pre-commit.com/)**: `brew install pre-commit`
3. **PNPM**: [install](https://pnpm.io/installation)
4. **checkov**: Required for Infrastructure as Code (IaC) linting. Install via one of:
   - **pipx** (recommended): `pipx install checkov`
   - **pip**: `pip install checkov`
   - **homebrew** (macOS): `brew install checkov`

### 2. Installation

Run the following commands to install dependencies and setup pre-commit:

```bash
pnpm install --frozen-lockfile
pre-commit install
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

## Committing work

This repository uses Nx with conventional commits to automatically generate changelogs. When committing work the command `pnpm commit` is available to help format commit messages. Please squash any commits that are related into a single commit following the above convention.

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
