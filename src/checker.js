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
const readFile = promisify(fs.readFile)
const {
  safeLoad
} = require('js-yaml')

const CFG_LOC = './.approved-licenses.yml'
let validationConfig

module.exports.loadConfig = async () => {
  try {
    validationConfig = safeLoad(await readFile(CFG_LOC))
  } catch (error) {
    // TODO: make this better
    process.emitWarning('Unable to load a configuration')
    validationConfig = {
      licenses: []
    }
  }
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

// Gets the licenses and returns them in dep tree format.
// module.exports.getLicencesAsTree = () => {
//   const getLicensesPromise = this.getLicenses()
//   const getDepTreePromise = this.getDepTree()
//   const [deps, licenseInfo] = [await getDepTreePromise, await getLicensesPromise]
// }


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
module.exports.validate = async (args) => {
  // Really only needs to run getLicenses and cross check it against a config file.
  const licenses = await this.getLicenses()
  const invalidLicensedModules = this.getInvalidModules(licenses, validationConfig)
  if (invalidLicensedModules === undefined) {
    return true
  }
  // const invalidModuleLicenses = Object.values(invalidModules).map(el => el.licenses)
  const packageDepTree = await this.getDepTree()
  const invalidLicencedModuleTree = this.pruneTreeByLicenses(packageDepTree, invalidLicensedModules)
  //TODO: This will just print a single top level for now.
  console.log(asTree(invalidLicencedModuleTree))
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
module.exports.pruneTreeByLicenses = (node, invalidLicensedModules) => {
  console.log(node, invalidLicensedModules);
  let prunedNode
  if (node.dependencies) {
    const prunedDeps = {}
    Object.values(node.dependencies).forEach(dep => {
      const node = this.pruneTreeByLicenses(dep, invalidLicensedModules)
      if (node) {
        prunedDeps[node.from] = { ...node
        }
      }
    })
    prunedNode = { ...node,
      dependencies: prunedDeps
    }
  }
  if (prunedNode) {
    return prunedNode
  }
  let moduleId = `${node.from}@${node.version}`
  if (invalidLicensedModules[moduleId] !== undefined) {
    return node
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