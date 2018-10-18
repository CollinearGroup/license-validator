#!/usr/bin/env node

const program = require('commander');
const pkg = require('./package')
const {
  getLicenses,
  getDepTree,
  check,
} = require('./src/checker')

program
  .version(pkg.version, '-v, --version')
  .option('--json', 'Prints a json report')
  .option('-i, --interactive', 'Runs in interactive mode.')

program
  .action(() => {
    if (program.interactive) {
      throw new Error('Should run check() then interactively add licenses to the approved list.')
    }
    check()
  })

program.parse(process.argv);
