#!/usr/bin/env node
const fs = require('fs-extra')
const program = require('commander');
const pkg = require('./package')
const {
  loadConfig,
  summary,
  validate,
  getAndValidateConfig,
  getUserLicenseInput,
  writeConfig
} = require('./src/checker')

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
      await writeConfig(fileName, yamlObj)
    }

    const fileExists = await fs.exists(fileName)
    if (!fileExists) {
      console.log(`Config file ${fileName} not found. Run with option -i to generate a config file.`)
      process.exit(1)
    }

    const approvedLicenses = await loadConfig(fileName)
    const isValid = await validate(approvedLicenses)
    if (!isValid) {
      console.error('Not all licenses are approved!');
      process.exit(1)
    }
    console.log(`Based on your ${fileName} config file, all your dependencies' licenses are valid.`)
  })

program.parse(process.argv);