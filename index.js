#!/usr/bin/env node

const program = require('commander');
const pkg = require('./package')
const {
  getDepTree,
  summary,
  validate,
} = require('./src/checker')

program
  .version(pkg.version, '-v, --version')
  .option('--json', 'Prints a json report')
  .option('--summary', 'Prints a summary report')
  .option('-i, --interactive', 'Runs in interactive mode.')

// program
//   .command('check')
//   .action(async (args) => {
//     const result = await check(args)
//     console.log(result);
//   })

// Default Action
program
  .action(async (args) => {
    if (args.summary) {
      console.log(await summary())
      return
    }
    
    console.log(await validate())
  })

program.parse(process.argv);
