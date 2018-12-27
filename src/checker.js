const _ = require('lodash')
const inquirer = require('inquirer')
const {
  promisify,
} = require('util')

const {
  parse,
  stringify
} = JSON

let fs = require('fs-extra')

let {
  init,
  asSummary,
  asTree,
} = require('license-checker')
init = promisify(init)

const exec = promisify(require('child_process').exec)
const {
  safeLoad,
  safeDump
} = require('js-yaml')

module.exports.getAndValidateConfig = async configPath => {
  const configExists = await fs.exists(configPath)
  if (configExists) {
    return this.loadConfig(configPath)
  }

  return {
    licenses: []
  }

}

// Simply loads the config file
module.exports.loadConfig = async configPath => {
  const config = safeLoad(await fs.readFile(configPath), { filename: configPath })
  if (!_.isObject(config)) {
    throw new Error(`Configuration file found but it does not have the expected root level 'licenses' array and 'modules' array.`)
  } else if (!_.isArray(config.licenses) ) {
    throw new Error(`Configuration file found but it does not have the expected root level 'licenses' array.`)
  } else if (!_.isArray(config.modules)) {
    throw new Error(`Configuration file found but it does not have the expected root level 'modules' array.`)
  }
  return config
}

// Writes the config
module.exports.writeConfig = async(configPath, configObject) => {
  let updatedConfig = safeDump(configObject)
  await fs.writeFile(configPath, updatedConfig)
}

// Builds the dependency tree of node modules.
module.exports.getDepTree = async () => {
  // TODO: Prefer a programmatic way to do this, but performance matters.
  const {
    stdout,
    stderr
  } = await exec('npm list --json');
  //TODO: Return nicer error.
  return parse(stdout)
}

// Runs license-checker to just the list of licenses in the format
// that license-checker handles so we can safely call other functions like `asSummary`
module.exports.getLicenses = async () => {
  const opts = {
    start: './',
    production: true,
  }
  return await init(opts)
}

// Updates existing licenses based on user input and existing dependencies
module.exports.getUserLicenseInput = async (existingLicenses) => {
  let licenseMap = await this.summary()
  const approvedLicenses = [...existingLicenses]
  for (let licenseName in licenseMap) {
    if (!existingLicenses.includes(licenseName)) {
      let answer = await inquirer.prompt({
        message: `${licenseMap[licenseName]} dependencies use the ${licenseName} license. Would you like to allow this license?`,
        name: 'answerKey',
        type: 'confirm',
        default: false
      })

      if (answer['answerKey'] === true) {
        approvedLicenses.push(licenseName)
      }
    }
  }

  return approvedLicenses
}

// Shows all the licenses in use for each module.
module.exports.summary = async (pretty = false) => {
  const opts = {
    start: './',
    production: true,
    summary: true,
  }
  let dependencies = await init(opts)

  if (pretty) {
    return asSummary(dependencies)
  } else {
    let licenses = {}

    for (const name in dependencies) {
      let dependency = dependencies[name]

      if (licenses[dependency.licenses]) {
        licenses[dependency.licenses]++
      } else {
        licenses[dependency.licenses] = 1
      }
    }

    return licenses
  }
}

// Main method that initiates the checking process
module.exports.validate = async (config) => {
  // Really only needs to run getLicenses and cross check it against a config file.
  const licenses = await this.getLicenses()
  const invalidLicensedModules = this.getInvalidModules(licenses, config)
  if (invalidLicensedModules === undefined) {
    return true
  }
  // const invalidModuleLicenses = Object.values(invalidModules).map(el => el.licenses)
  const packageDepTree = await this.getDepTree()
  const invalidLicensedModuleTree = this.pruneTreeByLicenses(packageDepTree.name, packageDepTree, invalidLicensedModules)
  //TODO: This will just print a single top level for now.
  console.log(asTree(invalidLicensedModuleTree))
}

// Compares a modules map with configured valid licenses.
module.exports.getInvalidModules = (moduleList, config) => {
  const invalidModules = {}
  
  for (let moduleName in moduleList) {
    let currentModule = moduleList[moduleName]
    
    let isLicenseValid = config.licenses ? this.isLicenseValidByConfig(config.licenses, currentModule.licenses) : false
    let isModuleValid = config.modules ? this.isModuleValidByConfig(config.modules, moduleName) : false
    if (!isLicenseValid && !isModuleValid) {
        invalidModules[moduleName] = currentModule
    }
  }
    
  if (_.isEmpty(invalidModules)) {
    return
  }
  return invalidModules
}

module.exports.isLicenseValidByConfig = (configLicenses, license) => {
  return configLicenses.includes(license)
}

module.exports.isModuleValidByConfig = (configModules, moduleName) => {
  return configModules.includes(moduleName)
}

// Seems to work but, currently missing the licenses field!
// Should prune out all the 'valid' licensed modules so that the result is
// the tree of modules whose sub-dep licenses are invalid.
module.exports.pruneTreeByLicenses = (name, node, invalidLicensedModules) => {
  let prunedNode
  if (node.dependencies) {
    const prunedDeps = {}
    for (const key in node.dependencies) {
      // dependency is an object
      const dependency = node.dependencies[key]
      const prunedSubTreeNode = this.pruneTreeByLicenses(key, dependency, invalidLicensedModules)
      if (prunedSubTreeNode) {
        prunedDeps[key] = { ...prunedSubTreeNode
        }
      }
    }

    if (_.isEmpty(prunedDeps)) {
      return undefined
    }

    prunedNode = {
      ...node,
      dependencies: prunedDeps
    }

    return prunedNode
  }

  const moduleId = `${name}@${node.version}`
  if (invalidLicensedModules[moduleId] !== undefined) {
    return { ...node,
      licenses: invalidLicensedModules[moduleId].licenses
    }
  }
}


// Will look through a dep list and license list and assign license info to each module
module.exports.assignLicenses = () => {
  throw new Error('Not implemented yet.')
}

// Flags a license as bad?
// module.exports.validateLicense = () => {
// throw new Error('Not implemented yet.')
// }