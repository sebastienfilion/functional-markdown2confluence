# Markdown2Confluence

Simple CLI to publish local Markdown files to Confluence.

# Installation

Requires [Deno](https://deno.land/) (>=1.0.0).

```shell script
$ deno install --unstable --allow-read --allow-env --allow-net -n m2c https://deno.land/x/functional_markdown2confluence@v0.2.1/cli.js
```

# Usage

You can run the CLI by passing the relative local file paths -- either HTML or Markdown.

```shell script
$ m2c publish <file-path...>
```

## Configurations

You can either store your configurations as environment variables or by passing the path to the configurations file.

```
// m2c.conf

domain={DOMAIN}
token={TOKEN}
username={USERNAME}
space={SPACE}
```

```shell script
$ m2c publish <file-path...> --configurations m2c.conf
```
