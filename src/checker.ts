import * as _ from "lodash"
import inquirer = require("inquirer")
import { promisify } from "util"
import fs = require("fs-extra")
import treeify = require("treeify")
import { init as lcInit } from "license-checker"
// import { exec } from "child_process"
import childProcess = require("child_process")
// import * as childProcess from "child_process"
import { safeLoad, safeDump } from "js-yaml"
const { parse } = JSON
const init = promisify(lcInit)

interface LicenseConfig {
  licenses: string[]
  modules: string[]
}

interface PrunedNode {
  licenses: any
  version: string
}

const defaultLicenseInitOpts = {
  start: "./",
  production: true
}

// If it is not a string you have to specifically allow the module.
export function canBeProcessed(licenseEntry): boolean {
  return typeof licenseEntry === "string"
}

export function isLicenseValidByConfig(configLicenses, license): boolean {
  return configLicenses.includes(license)
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
export async function generateLicensesMap() {
  const opts = {
    start: "./",
    production: true,
    summary: true
  }
  const dependencies = await init(opts)
  const licenses = {}
  const unprocessedLicenseEntries = {}
  for (const name in dependencies) {
    const dependency = dependencies[name]

    // Should only handle licenses that follow the npm package.json recommendations
    if (!canBeProcessed(dependency.licenses)) {
      unprocessedLicenseEntries[name] = dependency.licenses
      continue
    }
    const key = dependency.licenses.toString()
    if (licenses[key]) {
      licenses[key]++
    } else {
      licenses[key] = 1
    }
  }
  return {
    licenses,
    unprocessedLicenseEntries
  }
}

export function isModuleValidByConfig(configModules, moduleName) {
  return configModules.includes(moduleName)
}

export async function getUnallowedDependencies(
  existingLicenses,
  existingModules,
  dependencies
) {
  const unallowedDependencyMap = {}

  for (const dependencyName in dependencies) {
    const dependency = dependencies[dependencyName]
    if (
      !existingLicenses.includes(dependency.licenses) &&
      !existingModules.includes(dependencyName)
    ) {
      unallowedDependencyMap[dependencyName] = dependency
    }
  }

  return unallowedDependencyMap
}

// Simply loads the config file
export async function loadConfig(configPath): Promise<LicenseConfig> {
  const fileContents = await fs.readFile(configPath)
  const config = safeLoad(fileContents.toString(), {
    filename: configPath
  })
  if (!config) {
    throw new Error(`Configuration file found but it is empty.`)
  } else if (!_.isArray(config.licenses)) {
    throw new Error(
      `Configuration file found but it does not have the expected root level 'licenses' array.`
    )
  } else if (!_.isArray(config.modules)) {
    throw new Error(
      `Configuration file found but it does not have the expected root level 'modules' array.`
    )
  }
  return config
}

export async function getAndValidateConfig(configPath): Promise<LicenseConfig> {
  const configExists = await fs.pathExists(configPath)
  if (configExists) {
    return loadConfig(configPath)
  }

  return {
    licenses: [],
    modules: []
  }
}

// Writes the config
export async function writeConfig(configPath, configObject) {
  const updatedConfig = safeDump(configObject)
  await fs.writeFile(configPath, updatedConfig)
}

// Builds the dependency tree of node modules.
export async function getDepTree() {
  // TODO: Prefer a programmatic way to do this, but performance matters.
  let result = ""
  // https://nodejs.org/api/child_process.html#child_process_maxbuffer_and_unicode
  // It won't throw an error (except in sync mode) it just kills the process...
  const cp = childProcess.exec("npm list --json", {
    maxBuffer: 1024 * 1024 * 2
  })
  cp.stdout.on("data", data => (result += data))
  return new Promise((resolve, reject) => {
    cp.on("close", () => {
      resolve(parse(result))
    })
    cp.on("error", reject)
  })
}

// Runs license-checker to just the list of licenses in the format
// that license-checker handles so we can safely call other functions like `asSummary`
export async function getDependencies(opts = {}) {
  return await init({ ...defaultLicenseInitOpts, ...opts })
}

// Updates existing licenses based on user input and existing dependencies
export async function getUserLicenseInput(existingLicenses) {
  const { licenses: licenseMap } = await generateLicensesMap()
  const approvedLicenses = [...existingLicenses]
  for (const licenseName in licenseMap) {
    if (!existingLicenses.includes(licenseName)) {
      const answer = await inquirer.prompt({
        message: `${licenseMap[licenseName]} dependencies use the ${licenseName} license. Would you like to allow this license?`,
        name: "answerKey",
        type: "list",
        choices: ["N", "Y", "Save and Quit"]
      })

      if (answer["answerKey"] === "Y") {
        approvedLicenses.push(licenseName)
      } else if (answer["answerKey"] === "Save and Quit") {
        return approvedLicenses
      }
    }
  }

  return approvedLicenses
}

export async function getUserModulesInput(existingLicenses, existingModules) {
  const dependencies = await getDependencies({
    summary: true
  })
  const unallowedDependencyMap = await getUnallowedDependencies(
    existingLicenses,
    existingModules,
    dependencies
  )
  const approvedModules = [...existingModules]

  if (Object.keys(unallowedDependencyMap).length === 0) {
    return approvedModules
  }

  const initalAnswer = await inquirer.prompt({
    message: `You have ${
      Object.keys(unallowedDependencyMap).length
    } modules with unapproved licenses. Would you like to modify your approved module list?`,
    name: "confirmKey",
    type: "list",
    choices: ["N", "Y"]
  })

  if (initalAnswer["confirmKey"] === "N") {
    return approvedModules
  }

  for (const dependencyName in unallowedDependencyMap) {
    const answer = await inquirer.prompt({
      message: `${dependencyName} module has an unapproved license (${unallowedDependencyMap[dependencyName].licenses}). Would you like to allow this module anyway?`,
      name: "answerKey",
      type: "list",
      choices: ["N", "Y", "Save and Quit"]
    })

    if (answer["answerKey"] === "Y") {
      approvedModules.push(dependencyName)
    } else if (answer["answerKey"] === "Save and Quit") {
      return approvedModules
    }
  }

  return approvedModules
}

// Shows all the licenses in use for each module.
export async function summary(filePath) {
  const currentConfig = await getAndValidateConfig(filePath)
  const {
    licenses: licenseMap,
    unprocessedLicenseEntries
  } = await generateLicensesMap()
  const summary = {
    approved: {},
    unapproved: {},
    unprocessedLicenseEntries
  }
  for (const license in licenseMap) {
    if (currentConfig.licenses.includes(license)) {
      summary.approved[license] = licenseMap[license]
    } else {
      summary.unapproved[license] = licenseMap[license]
    }
  }
  return summary
}

export function prettySummary(summary) {
  const approvedTree = _.isEmpty(summary.approved)
    ? "  None\n"
    : treeify.asTree(summary.approved, true, true)
  const unApprovedTree = _.isEmpty(summary.unapproved)
    ? "  None\n"
    : treeify.asTree(summary.unapproved, true, true)
  const unprocessedTree = _.isEmpty(summary.unprocessedLicenseEntries)
    ? "  None\n"
    : treeify.asTree(summary.unprocessedLicenseEntries, true, true)

  const prettySummary = [
    `Licenses`,
    "",
    "APPROVED:",
    approvedTree,
    "UNAPPROVED:",
    unApprovedTree,
    "UNPROCESSED:",
    unprocessedTree
  ].join("\n")

  return prettySummary
}

// Compares a modules map with configured valid licenses.
export function getInvalidModules(moduleList, config) {
  const invalidModules = {}
  for (const moduleName in moduleList) {
    const currentModule = moduleList[moduleName]
    const isLicenseValid = config.licenses
      ? isLicenseValidByConfig(config.licenses, currentModule.licenses)
      : false
    const isModuleValid = config.modules
      ? isModuleValidByConfig(config.modules, moduleName)
      : false
    if (!isLicenseValid && !isModuleValid) {
      invalidModules[moduleName] = currentModule
    }
  }
  if (_.isEmpty(invalidModules)) {
    return
  }
  return invalidModules
}

// Prune out all the 'valid' licensed modules so that the result is
// the tree of modules whose sub-dep licenses are invalid.
export function pruneTreeByLicenses(name, node, invalidLicensedModules) {
  let prunedNode: PrunedNode = {
    licenses: null,
    version: null
  }

  const prunedDeps: PrunedNode = {
    licenses: null,
    version: null
  }
  for (const key in node.dependencies) {
    // dependency is an object
    const dependency = node.dependencies[key]
    const prunedSubTreeNode = pruneTreeByLicenses(
      key,
      dependency,
      invalidLicensedModules
    )
    if (!_.isEmpty(prunedSubTreeNode)) {
      prunedDeps[key] = { ...prunedSubTreeNode }
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

// Main method that initiates the checking process
export async function getInvalidModuleDependencyTree(config) {
  const licenses = await getDependencies()
  const invalidLicensedModules = getInvalidModules(licenses, config)
  if (invalidLicensedModules === undefined) {
    return
  }
  const packageDepTree = (await getDepTree()) as any
  return pruneTreeByLicenses(
    packageDepTree.name,
    packageDepTree,
    invalidLicensedModules
  )
}
