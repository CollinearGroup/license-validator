const {
  promisify,
} = require('util')
const {
  parse,
} = JSON

let {
  init,
  asSummary
} = require('license-checker')
init = promisify(init)

const exec = promisify(require('child_process').exec)

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

// Main method that intiates the checking process
module.exports.validate = async (args) => {
  const getLicensesPromise = this.getLicenses()
  const getDepTreePromise = this.getDepTree()

  const [deps, licenseInfo] = [await getDepTreePromise, await getLicensesPromise]

  throw new Error('Not implemented yet.')
  // return this.assignLicenses(deps, licenseInfo)
}

// Will look through a dep list and license list and assign license info to each module
module.exports.assignLicenses = () => {

}

// Flags a license as bad?
module.exports.validateLicense = () => {

}


