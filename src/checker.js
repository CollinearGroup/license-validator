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
  init
} = require('license-checker')
init = promisify(init)

let {
  exec
} = require('child_process')

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
  const config = safeLoad(await fs.readFile(configPath), {
    filename: configPath
  })
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
  let result = ''
  // https://nodejs.org/api/child_process.html#child_process_maxbuffer_and_unicode
  // It won't throw an error (except in sync mode) it just kills the process...
  const cp = exec('npm list --json', {
    maxBuffer: 1024 * 1024 * 2
  });
  cp.stdout.on('data', data => result += data)
  return new Promise((resolve, reject) => {
    cp.on('close', () => {
      resolve(parse(result))
    })
  })
}

// Runs license-checker to just the list of licenses in the format
// that license-checker handles so we can safely call other functions like `asSummary`
module.exports.getDependencies = async (opts = {}) => {
  return await init({ ...defaultLicenseInitOpts,
    ...opts
  })
}

// Updates existing licenses based on user input and existing dependencies
module.exports.getUserLicenseInput = async (existingLicenses) => {
  let {
    licenses: licenseMap
  } = await this.generateLicensesMap()
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
  let dependencies = await this.getDependencies({
    summary: true
  })
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
  let {
    licenses: licenseMap,
    unprocessedLicenseEntries
  } = await this.generateLicensesMap()
  let summary = {
    approved: {},
    unapproved: {},
    unprocessedLicenseEntries
  }
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
  let approvedTree = _.isEmpty(summary.approved) ? '  None\n' : treeify.asTree(summary.approved, true)
  let unApprovedTree = _.isEmpty(summary.unapproved) ? '  None\n' : treeify.asTree(summary.unapproved, true)
  let unprocessedTree = _.isEmpty(summary.unprocessedLicenseEntries) ? '  None\n' : treeify.asTree(summary.unprocessedLicenseEntries, true)

  let prettySummary = [
    `Licenses`,
    '',
    'APPROVED:',
    approvedTree,
    'UNAPPROVED:',
    unApprovedTree,
    'UNPROCESSED:',
    unprocessedTree,
  ].join('\n')

  return prettySummary
}

/**
 * Get an object of total count of licenses
 *
 * Example return
 * {
 *   licenses: {
 *     'GPL-2.0': 23
 *   },
 *   unprocessedLicenseEntries: {
 *     'json-schema': ['BSD', 'AFLv2.1']
 *   }
 * }
 */
module.exports.generateLicensesMap = async () => {
  const opts = {
    start: './',
    production: true,
    summary: true,
  }
  let dependencies = await init(opts)
  let licenses = {}
  let unprocessedLicenseEntries = {}
  for (const name in dependencies) {
    let dependency = dependencies[name]

    // Should only handle licenses that follow the npm package.json recommendations
    if (!this.canBeProcessed(dependency.licenses)) {
      unprocessedLicenseEntries[name] = dependency.licenses
      continue
    }
    if (licenses[dependency.licenses]) {
      licenses[dependency.licenses]++
    } else {
      licenses[dependency.licenses] = 1
    }
  }
  return {
    licenses,
    unprocessedLicenseEntries
  }
}

// If it is not a string you have to specifically allow the module.
module.exports.canBeProcessed = (licenseEntry) => {
  return typeof licenseEntry === 'string'
}

// Main method that initiates the checking process
module.exports.getInvalidModuleDependencyTree = async config => {
  const licenses = await this.getDependencies()
  const invalidLicensedModules = this.getInvalidModules(licenses, config)
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

// Prune out all the 'valid' licensed modules so that the result is
// the tree of modules whose sub-dep licenses are invalid.
module.exports.pruneTreeByLicenses = (name, node, invalidLicensedModules) => {
  let prunedNode = {}

  let prunedDeps = {}
  for (const key in node.dependencies) {
    // dependency is an object
    const dependency = node.dependencies[key]
    const prunedSubTreeNode = this.pruneTreeByLicenses(key, dependency, invalidLicensedModules)
    if (!_.isEmpty(prunedSubTreeNode)) {
      prunedDeps[key] = { ...prunedSubTreeNode
      }
    }
  }

  if (!_.isEmpty(prunedDeps)) {
    prunedNode = {
      ...prunedDeps
    }
  }

  const moduleId = `${name}@${node.version}`
  if (invalidLicensedModules[moduleId] !== undefined) {
    prunedNode.licenses = invalidLicensedModules[moduleId].licenses
    prunedNode.version = node.version
  } else if (!_.isEmpty(prunedDeps)) {
    prunedNode.version = node.version
  }

  return prunedNode

}