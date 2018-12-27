#!/usr/bin/env node

const program = require('commander');
const pkg = require('./package')
const {
  loadConfig,
  getDepTree,
  summary,
  validate,
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
    if (args.summary) {
      console.log(await summary())
      return
    }

    // if (args.json) {
    //   console.log(await get())
    //   return
    // }
    const approvedLicenses = await loadConfig('./.approved-licenses.yml')
    const isValid = await validate(approvedLicenses)
    if (!isValid) {
      console.error('Not all licenses are approved!');
      process.exit(1)
    }
  })

program.parse(process.argv);
