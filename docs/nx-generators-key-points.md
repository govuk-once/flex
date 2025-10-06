# Nx Generators

## What are `nx` generators?

- A way to scaffold new projects through the creation of template files that enforce your projects with your tool/framework's "best practice"

- Generators provide an API for managing files within your workspace. 
    - Generates can `create`, `update`, `move`, and `delete` files.

- Generators can use template where you can insert dynamic content into new projects

[Example](/tools/my-plugin/src/generators/my-generator/files/src/README__name__.md.template)

- Nx allows you to encode these best practices in code generators that have been tailored to your specific repository.

- For instance we can create a generator that:
    - Enforces the use of Vitest for unit tests
    - Every project to use tagging i.e. `scope:*` 

- Generators live within a plugin.

## Note on plugins

Plugins are packages that extend `nx` with:

- `Generators`: for code scaffolding/updating and config
- `Executors`: to run tasks like building, linting, deploying
- `Migrations`: codemods/config updates for version upgrades


- Generators/executors don't require `nx.json` entires
    - They are discoverable via a plugin's [`package.json`](/tools/my-plugin/package.json)
        - `generators` -> `generators.json`
        - `executors` -> `executors.json`
        - `nx-migrations` -> `migrations.json`


#### Local vs published

- Local plugins live inside your workspace repo (and are not published to npm)
- typically live in `tools/<your-plugin>`   
- You can develop generators/executors in-repo and run them with:
    - `nx g @flex/my-plugin:my-generator`

- Local plugins are great for org-specific scaffolding and tasks
* **Sanity-Check**: local plugins won't run via `nx migrate <scope/plugin>@version` (unless you use a local registry like Verdaccio)

#### Registration:
- Only add to `nx.json` when enabling runtime inference/config:
`"plugins": ["@scope/plugin"]` or `"plugins": ["./dist/tools/my-plugin/src/index.js"]` for a local runtime plugin.


You can list all plugins installed using:

```
pnpm nx list
```

You can add a plugin using

```
pnpm nx add @nx/react
```

Or to generate a local plugin:

```
pnpm nx g @nx/plugin:plugin <plugin-name>
```



----

## How

```
pnpm nx add @nx/plugin

pnpm nx g @nx/plugin:plugin tools/<plugin-name>

pnpm nx g @nx/plugin:generator tools/<plugin-name>/src/generators/<generator-name>

pnpm nx g @flex/<plugin-name>:<generator-name> <name>
```


## Sync Generators

- Sync generators ensure your repo is maintained in a correct state. One use case is to use the project graph to update files. These can be global config files (i.e. linting rules) or scripts, or task level to ensure files are in sync before a task is run.

Sync Generator Examples:

- Update a custom CI script with binning strategies based on the current project graph
- Update TypeScript config files with project references based on the current project graph
- Ensure code is formatted in a specific way before CI is run

- Sync generators can be associated with a task. 
- global sync generators are executed via `nx sync` or `nx sync:check` commands and are registered in the `nx.json`
- Sync generators are generators that are used to ensure that your file system is in the correct state before a task is run or the CI process is started.

```
pnpm nx 

pnpm nx sync:check

pnpm nx sync
```

## Migrations

When your plugin is being used in other repos, it is helpful to provide migration generators to automatically update configuration files when your plugin makes a breaking change.

A migration generator is a normal generator that is triggered when a developer runs the nx migrate command.
