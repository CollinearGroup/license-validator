const {
  promisify,
} = require('util')
const {
  parse,
} = JSON

const checker = {
  init: promisify(require('license-checker').init)
}
const exec = promisify(require('child_process').exec)

// Builds the dependency tree of node modules.
module.exports.getDepTree = async () => {
  const {
    stdout: deps,
    stderr
  } = await exec('npm list --json');
  return parse(deps)
}

// Shows all the licenses in use for each module.
module.exports.getLicenses = async () => {
  const licenseInfo = await checker.init({
    start: './',
    production: true
  })
  return licenseInfo
}

// Main method that intiates the checking process
module.exports.check = async () => {
  const getLicensesPromise = this.getLicenses()
  const getDepTreePromise = this.getDepTree()

  const [deps, licenseInfo] = [await getDepTreePromise, await getLicensesPromise]

  // return this.assignLicenses(deps, licenseInfo)
}

// Will look through a dep list and license list and assign license info to each module
module.exports.assignLicenses = () => {

}

// Flags a license as bad?
module.exports.validateLicense = () => {

}


