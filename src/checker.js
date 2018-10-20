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
  asSummary
} = require('license-checker')
init = promisify(init)

const exec = promisify(require('child_process').exec)
const {
  safeLoad
} = require('js-yaml')

const CFG_LOC = './.approved-licenses.yml'
const validationConfig = safeLoad(fs.readFileSync(CFG_LOC))

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
  const invalidModules = []
  for (key in licenses) {
    if (!validationConfig.licenses.includes(licenses[key].licenses)) {
      invalidModules.push(licenses[key])
    }
  }
  if (invalidModules.length > 0) {
    console.log(stringify(invalidModules, null, ' '))
  }
  return false
}

// Will look through a dep list and license list and assign license info to each module
module.exports.assignLicenses = () => {
  throw new Error('Not implemented yet.')
}

// Flags a license as bad?
// module.exports.validateLicense = () => {
  // throw new Error('Not implemented yet.')
// }