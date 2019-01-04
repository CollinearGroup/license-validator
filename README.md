# license-validator
> Validates Open Source Licenses for Nodejs Projects

[![Build Status](https://travis-ci.org/CollinearGroup/license-validator.svg?branch=master)](https://travis-ci.org/travis-ci/travis-web)
[![Coverage Status](https://coveralls.io/repos/github/CollinearGroup/license-validator/badge.svg?branch=master)](https://coveralls.io/github/CollinearGroup/license-validator?master)

## Usage

First-time setup

```
$ npx license-validator -i
```

This will generate the config file as `approved-licenses.yml`. This file can be maintained through the CLI or manually.

After setup simply run a report.

```
$ npx license-validator
```

Returns code 1 when any license has not been explicitly approved via the config file. Prints a dependency tree of the failing modules due to invalid licenses.

The `.approved-licenses.yml` can be added to via interactive mode. Removing licenses or modules should be done manually.

## CLI Options

**`--summary`**

Prints a summary of existing licenses and modules and whether or not they are approved.

**`-i | --interactive`**

Runs interactive mode which will allow you to approve/disapprove on a license by license basis and updates your config file with your entries. Will only run on non-validated licenses/modules.

**`-m | --modules-only`**

Example: `npx license-validator -im`

Runs interactive mode but only runs through the projects modules.

**`--help`**

Prints the help menu.