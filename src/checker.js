const _ = require('lodash')

const {
  promisify,
} = require('util')

const {
  parse,
  stringify
} = JSON

const fs = require('fs')

let {
  init,
  asSummary,
  asTree,
} = require('license-checker')
init = promisify(init)

const exec = promisify(require('child_process').exec)
let readFile = promisify(fs.readFile)
const {
  safeLoad
} = require('js-yaml')

// Simply loads the config file
module.exports.loadConfig = async configPath => {
  const approvedLicenses = safeLoad(await readFile(configPath))
  if (!_.isObject(approvedLicenses) || !_.isArray(approvedLicenses.licenses)) {
    throw new Error(`Configuration file found but it does not have the expected root level 'licenses' array.`)
  }
  return approvedLicenses
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

// Shows all the licenses in use for each module.
module.exports.summary = async () => {
  const opts = {
    start: './',
    production: true,
    summary: true,
  }
  return asSummary(await init(opts))
}

// Main method that initiates the checking process
module.exports.validate = async (approvedLicenses) => {
  // Really only needs to run getLicenses and cross check it against a config file.
  const licenses = await this.getLicenses()
  const invalidLicensedModules = this.getInvalidModules(licenses, approvedLicenses)
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
module.exports.getInvalidModules = (licenses, config) => {
  const invalidModules = {}
  let zeroFound = true
  for (key in licenses) {
    if (!config.licenses.includes(licenses[key].licenses)) {
      invalidModules[key] = licenses[key]
      zeroFound = false
    }
  }
  if (zeroFound) {
    return
  }
  return invalidModules
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
        prunedDeps[key] = { ...prunedSubTreeNode }
      }
    }

    if (_.isEmpty(prunedDeps)) {
      return undefined
    }

    prunedNode = { ...node,
      dependencies: prunedDeps
    }

    return prunedNode
  }

  const moduleId = `${name}@${node.version}`
  if (invalidLicensedModules[moduleId] !== undefined) {
    return { ...node, licenses: invalidLicensedModules[moduleId].licenses }
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