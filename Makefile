.DEFAULT_GOAL := explain

.PHONY: explain
explain:
	@echo "FLEX (Federated Logic and Events eXchange System)"
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage: \033[36m\033[0m\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

.PHONY: init
init: ## Initialise the project: install dependencies, setup pre-commit
	@pnpm install --frozen-lockfile
	@pre-commit install

.PHONY: pre-commit
pre-commit: ## Run pre-commit against all files
	@pre-commit run --all-files

.PHONY: build
build: ## Build a specific project: make build PROJECT=<project-name>
	@if [ -z "$(PROJECT)" ]; then \
		echo "Error: PROJECT variable not set. \n\nUsage: \n make build PROJECT=<project-name>\n"; \
		exit 1; \
  fi
	@echo "Building $(PROJECT)"
	@npx nx build $(PROJECT)

.PHONY: build-all
build-all: ## Build all projects
	@npx nx run-many --target=build --all

.PHONY: build-affected
build-affected: ## Build only affected projects
	@npx nx affected --target=build

.PHONY: lint
lint: ## Lint a specific project: make lint PROJECT=<project-name>
	@if [ -z "$(PROJECT)" ]; then \
		echo "Error: PROJECT variable not set. \n\nUsage: \n make lint PROJECT=<project-name>\n"; \
		exit 1; \
  fi
	@echo "Linting $(PROJECT)"
	@npx nx lint $(PROJECT)

.PHONY: lint-all
lint-all: ## Lint all projects
	@npx nx run-many --target=lint --all

.PHONY: lint-affected
lint-affected: ## Lint only affected projects
	@npx nx affected --target=lint

.PHONY: test
test: ## Test a specific project: make test PROJECT=<project-name>
	@if [ -z "$(PROJECT)" ]; then \
		echo "Error: PROJECT variable not set. \n\nUsage: \n make test PROJECT=<project-name>\n"; \
		exit 1; \
  fi
	@echo "Testing $(PROJECT)"
	@npx nx test $(PROJECT) -- --reporter=verbose --watch

.PHONY: test-all
test-all: ## Test all unit tests
	@npx vitest run

.PHONY: test-affected
test-affected: ## Test only affected projects
	@npx nx affected --target=test

.PHONY: format
format: ## Format all files with Prettier
	@npx prettier --write .

.PHONY: format-check
format-check: ## Format check
	@npx prettier --check .

.PHONY: graph
graph: ## Show dependency graph
	@npx nx graph

.PHONY: graph-affected
graph-affected: ## Show affected dependency graph
	@npx nx graph --affected

.PHONY: projects
projects: ## List all projects
	@echo "Available Nx projects:"
	@npx nx show projects

.PHONY: projects-libs
projects-libs: ## List only libraries
	@echo "Available Nx libraries:"
	@npx nx show projects --type=lib

.PHONY: projects-modules
projects-modules: ## List only modules
	@echo "Available Nx modules:"
	@npx nx show projects --type=app

.PHONY: generate-lib
generate-lib: ## Generate shared lib for FLEX repo: make generate-lib PROJECT=<project>
	@if [ -z "$(PROJECT)" ]; then \
		echo "Error: PROJECT variable not set."; \
		exit 1; \
	fi
	@echo "Generating module $(PROJECT)"
	@cd tools/generators/sharedLib && npx tsc --skipLibCheck --esModuleInterop --module commonjs --target ES2020 index.ts
	@npx nx g ./tools/generators:new-lib --libName=$(PROJECT); \
	EXIT_CODE=$$?; \
	rm -f tools/generators/sharedLib/index.js; \
	exit $$EXIT_CODE

.PHONY: generate-module
generate-module: ## Generate base module for FLEX repo: make generate-module PROJECT=<project>
	@if [ -z "$(PROJECT)" ]; then \
		echo "Error: PROJECT variable not set."; \
		exit 1; \
	fi
	@echo "Generating module $(PROJECT)"
	@cd tools/generators/module && npx tsc --skipLibCheck --esModuleInterop --module commonjs --target ES2020 index.ts
	@npx nx g ./tools/generators:new-module --projectName=$(PROJECT); \
	EXIT_CODE=$$?; \
	rm -f tools/generators/module/index.js; \
	exit $$EXIT_CODE

.PHONY: clean
clean: ## Remove build output and Nx cache
	@rm -rf dist/
	@npx nx reset
