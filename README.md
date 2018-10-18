# license-validator
> Validates Open Source Licenses for Nodejs Projects

## Usage

First-time setup

```
$ npx license-validator -i
```

This will generate the config file as config/approved-licenses.js. This file can be maintained through the CLI or manually.

After setup simply run a report.

```
$ npx license-validator
```

Returns code 1 when any license has not been explicitly approved via the config file. Prints a dependency tree of the failing modules due to invalid licenses.

## CLI Options

**`--json`**

Will print the json report of your dependency tree with license info (basically a munge of npm list --json and license-checker --json)

**`-p | --production`**

Type Boolean - Default: true

Only runs production dependencies.

**`-i | --interactive`**

Type Boolean - Default: false

Runs interactive mode which will allow you to approve/disapprove on a license by license basis and updates your config file with your entries. Will only run on non-validated licenses/modules.
