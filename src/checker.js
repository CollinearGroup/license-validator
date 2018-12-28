const _ = require('lodash')
const inquirer = require('inquirer')
const {
  promisify,
} = require('util')

const {
  parse,
} = JSON

let fs = require('fs-extra')
const treeify = require('treeify')
let {
  init,
  asSummary,
} = require('license-checker')
init = promisify(init)

const exec = promisify(require('child_process').exec)
const {
  safeLoad,
  safeDump
} = require('js-yaml')

const defaultLicenseInitOpts = {
  start: './',
  production: true,
}

module.exports.getAndValidateConfig = async configPath => {
  const configExists = await fs.exists(configPath)
  if (configExists) {
    return this.loadConfig(configPath)
  }

  return {
    licenses: [],
    modules: []
  }

}

// Simply loads the config file
module.exports.loadConfig = async configPath => {
  const config = safeLoad(await fs.readFile(configPath), { filename: configPath })
  if (!config) {
    throw new Error(`Configuration file found but it is empty.`)
  } else if (!_.isArray(config.licenses)) {
    throw new Error(`Configuration file found but it does not have the expected root level 'licenses' array.`)
  } else if (!_.isArray(config.modules)) {
    throw new Error(`Configuration file found but it does not have the expected root level 'modules' array.`)
  }
  return config
}

// Writes the config
module.exports.writeConfig = async (configPath, configObject) => {
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
  return parse(stdout)
}

// Runs license-checker to just the list of licenses in the format
// that license-checker handles so we can safely call other functions like `asSummary`
module.exports.getDependencies = async (opts = {}) => {
  return await init({ ...defaultLicenseInitOpts, ...opts })
}

// Updates existing licenses based on user input and existing dependencies
module.exports.getUserLicenseInput = async (existingLicenses) => {
  let licenseMap = await this.generateLicensesMap()
  const approvedLicenses = [...existingLicenses]
  for (let licenseName in licenseMap) {
    if (!existingLicenses.includes(licenseName)) {
      let answer = await inquirer.prompt({
        message: `${licenseMap[licenseName]} dependencies use the ${licenseName} license. Would you like to allow this license?`,
        name: 'answerKey',
        type: 'list',
        choices: ['N', 'Y', 'Save and Quit']
      })

      if (answer['answerKey'] === 'Y') {
        approvedLicenses.push(licenseName)
      } else if (answer['answerKey'] === 'Save and Quit') {
        return approvedLicenses
      }
    }
  }

  return approvedLicenses
}

module.exports.getUserModulesInput = async (existingLicenses, existingModules) => {
  let dependencies = await this.getDependencies({ summary: true })
  let unallowedDependencyMap = await this.getUnallowedDependencies(existingLicenses, existingModules, dependencies)
  const approvedModules = [...existingModules]

  if (Object.keys(unallowedDependencyMap).length === 0) {
    return approvedModules
  }

  let initalAnswer = await inquirer.prompt({
    message: `You have ${Object.keys(unallowedDependencyMap).length} modules with unapproved licenses. Would you like to modify your approved module list?`,
    name: 'confirmKey',
    type: 'list',
    choices: ['N', 'Y']
  })

  if (initalAnswer['confirmKey'] === 'N') {
    return approvedModules
  }

  for (let dependencyName in unallowedDependencyMap) {
    let answer = await inquirer.prompt({
      message: `${dependencyName} module has an unapproved license (${unallowedDependencyMap[dependencyName].licenses}). Would you like to allow this module anyway?`,
      name: 'answerKey',
      type: 'list',
      choices: ['N', 'Y', 'Save and Quit']
    })

    if (answer['answerKey'] === 'Y') {
      approvedModules.push(dependencyName)
    } else if (answer['answerKey'] === 'Save and Quit') {
      return approvedModules
    }
  }

  return approvedModules
}

module.exports.getUnallowedDependencies = async (existingLicenses, existingModules, dependencies) => {
  let unallowedDependencyMap = {}

  for (let dependencyName in dependencies) {
    let dependency = dependencies[dependencyName]
    if (!existingLicenses.includes(dependency.licenses) && !existingModules.includes(dependencyName)) {
      unallowedDependencyMap[dependencyName] = dependency
    }
  }

  return unallowedDependencyMap
}

// Shows all the licenses in use for each module.
module.exports.summary = async (filePath) => {
  const currentConfig = await this.getAndValidateConfig(filePath)
  let licenseMap = await this.generateLicensesMap()
  let summary = { approved: {}, unapproved: {} }
  for (let license in licenseMap) {
    if (currentConfig.licenses.includes(license)) {
      summary.approved[license] = licenseMap[license]
    } else {
      summary.unapproved[license] = licenseMap[license]
    }
  }
  return summary
}

module.exports.prettySummary = (summary) => {
  let approvedTree = _.isEmpty(summary.approved) ? '  None' : treeify.asTree(summary.approved, true)
  let unApprovedTree = _.isEmpty(summary.unapproved) ? '  None' : treeify.asTree(summary.unapproved, true)
  let prettySummary = `Licenses\n\nAPPROVED:\n${approvedTree}\nUNAPPROVED:\n${unApprovedTree}\n`
  return prettySummary
}
// Get a map of total count of licenses
module.exports.generateLicensesMap = async () => {
  const opts = {
    start: './',
    production: true,
    summary: true,
  }
  let dependencies = await init(opts)
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

// Main method that initiates the checking process
module.exports.getInvalidModuleDependencyTree = async config => {
  const licenses = await this.getDependencies()
  const invalidLicensedModules = this.getInvalidModules(licenses, config)
  // console.log(invalidLicensedModules)
  if (invalidLicensedModules === undefined) {
    return
  }
  const packageDepTree = await this.getDepTree()
  return this.pruneTreeByLicenses(packageDepTree.name, packageDepTree, invalidLicensedModules)
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
  if(name.includes("validate-npm-package-license@")){
    // console.log(node)
    // console.log(node.licenses)
    console.log(`${name}@${node.version}`)
    console.log(node)
    console.log(invalidLicensedModules[`${name}@${node.version}`])
  }
  let prunedNode
  if (node.dependencies) {
    const prunedDeps = {}
    for (const key in node.dependencies) {
      // dependency is an object
      const dependency = node.dependencies[key]
      const prunedSubTreeNode = this.pruneTreeByLicenses(key, dependency, invalidLicensedModules)
      if (prunedSubTreeNode) {
        prunedDeps[key] = {
          ...prunedSubTreeNode
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

  const moduleId = `${name.trim()}@${node.version.trim()}`
  if (invalidLicensedModules[moduleId] !== undefined) {
    console.log('lkdhfjaksdl')
    return {
      ...node,
      licenses: invalidLicensedModules[moduleId].licenses
    }
  }
}
