#!/usr/bin/env node

const _ = require('lodash')
const fs = require('fs-extra')
const program = require('commander');
const pkg = require('./package')
const {
  loadConfig,
  summary,
  getInvalidModuleDependencyTree,
  getAndValidateConfig,
  getUserLicenseInput,
  writeConfig,
} = require('./src/checker')
const {
  asTree,
} = require('license-checker')

program
  .version(pkg.version, '-v, --version')
  .option('--json', 'Prints a json report')
  .option('--summary', 'Prints a summary report')
  .option('-i, --interactive', 'Runs in interactive mode.')

// Default Action
program
  // TODO: Move to testable function
  .action(async (args) => {
    let fileName = '.approved-licenses.yml'
    if (args.summary) {
      console.log(await summary(true))
      return
    }

    if (args.interactive) {
      const yamlObj = await getAndValidateConfig(fileName)
      yamlObj.licenses = await getUserLicenseInput(yamlObj.licenses)
      yamlObj.modules = yamlObj.modules || []
      await writeConfig(fileName, yamlObj)
    }

    const fileExists = await fs.exists(fileName)
    if (!fileExists) {
      console.log(`Config file ${fileName} not found. Run with option -i to generate a config file.`)
      process.exit(1)
    }

    let parsedConfig

    try {
      parsedConfig = await loadConfig(fileName)
    } catch (err) {
      console.error(err.message)
      process.exit(1)
    }

    const depTree = await getInvalidModuleDependencyTree(parsedConfig)
    if (!_.isEmpty(depTree)) {
      console.log(asTree(depTree))
      console.log('Not all licenses are approved!')
      process.exit(1)
    }

    console.log(`Based on your ${fileName} config file, all your dependencies' licenses are valid.`)
  })

program.parse(process.argv)