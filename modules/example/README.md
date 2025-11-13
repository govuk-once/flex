# Example

> This is just an example of a module

## Commands

You can build the project by running the following command:

```sh
make build PROJECT=@modules/example
```

You can run unit tests against the project by running the following command:

```sh
make test PROJECT=@modules/example
```

You can also run the lambda locally with the following command:

```sh
node -e "import('./dist/modules/example/main.js').then(m => m.handler({ test: 'hello' })).then(console.log)"
```
