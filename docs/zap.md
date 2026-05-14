# Zap workflow

The ZAP workflow located in `.github/workflows` runs the OWASP ZAP tool (API scan) against the staging environment to identify vulnerabilities.

---

## Overview


The scan runs every time a deployment to staging is successful. The results are stored as an artifact of the run and can be viewed locally. To download the artifact, go to the Summary tab and scroll to the bottom of a successful ZAP run.

## Files

| Content Type                                 | Location                                                     |
| -------------------------------------------- | ------------------------------------------------------------ |
| Zap workflow                                 | `.github/workflows/zap.yml`                                  |
| Interim OpenAPI docs                         | `.zap/merged-openapi.json`                                   |
| Zap rules                                    | `.zap/rules.tsv`                                             |
| Zap auth header setup                        | `scripts/dastSetups.ts`                                      |

## Directory

```text
.github/
└── workflows/
   └── zap.yml
.zap/
├── merged-openapi.json
└── rules.tsv
scripts/
└── dastSetup.ts
```

---

## Prerequisites

Complete the [Environment Setup](/docs/environment-setup.md) before starting development.

Specific prerequisites for testing:
- GitHub CLI (`gh`)
- Local ZAP installation to verify OpenAPI docs

---

## How to test the workflow

To test the workflow in a branch other than `main`, a few adjustments are required. This is due to the trust policy, which dictates that the staging account role can only be assumed from the `main` branch.

The workflow steps:
- Checkout your new branch
- Edit `.github/workflows/zap.yml`
    - In the Configure AWS credentials step change `secrets.STAGING_DEPLOYMENT_ROLE` to `secrets.DEV_DEPLOYMENT_ROLE`
    - In the ZAP Scan step change `secrets.STAGING_API_URL` to `secrets.DEVELOPMENT_API_URL`

Local github cli setup:
- Install `gh` cli
- Authenticate with `gh auth login`

Testing:
- Push the changes to the new branch (including the `workflow steps` modifications)
- Run `gh workflow run zap.yml --ref feature/branch`


This triggers a new run on GitHub using the branch's logic against the development environment. **Note:** Revert the workflow changes to their original values before merging into `main`.

---

## How to test the openapi

To test the openapi you will need to install the [owasp zap tool](https://www.zaproxy.org/download/).
Open the tool, in the toolbar go to import -> Import OpenAPI Definition. Choose File -> the openapi to verify, change the target to localhost and press import.
The results will appear as soon as it tried to import the file.
