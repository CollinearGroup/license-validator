#!/usr/bin/env node

const program = require('commander');
const pkg = require('./package')
const {
  loadConfig,
  getDepTree,
  summary,
  validate,
} = require('./src/checker')
const fs = require('fs-extra')
const jsYaml = require('js-yaml')
const inquirer = require('inquirer')

loadConfig()

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
      console.log(await summary(true))
      return
    }

    if (args.interactive) {
      let licenseMap = await summary()
      
      let fileName = '.approved-licenses.yml'
      await fs.ensureFile(fileName)
      let config = await fs.readFile(fileName, 'utf8')
      const yamlObj = jsYaml.safeLoad(config) || {licenses:[]}

      for (let licenseName in licenseMap) {
        if (!yamlObj.licenses.includes(licenseName)) {
          let answer = await inquirer.prompt({ 
            message: `${licenseMap[licenseName]} dependencies use the ${licenseName} license. Would you like to allow this license?`, 
            name: 'answerKey',
            type: 'confirm', 
            default: false 
          })
          
          if(answer['answerKey'] === true){
            yamlObj.licenses.push(licenseName)
          }
        }
      }

      let updatedConfig = jsYaml.safeDump(yamlObj)
      await fs.writeFile(fileName, updatedConfig)
      await loadConfig()
    }

    // if (args.json) {
    //   console.log(await get())
    //   return
    // }

    const isValid = await validate()
    if (!isValid) {
      console.error('Not all licenses are approved!');
      process.exit(1)
    }
  })

program.parse(process.argv);
