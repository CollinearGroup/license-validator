import * as _ from "lodash"
let inquirer = require("inquirer")
import { promisify } from "util"

let { parse } = JSON

let fs = require("fs-extra")
let treeify = require("treeify")
import { init as lcInit } from "license-checker"
let init = promisify(lcInit)

let { exec } = require("child_process")

import { safeLoad, safeDump } from "js-yaml"

const defaultLicenseInitOpts = {
  start: "./",
  production: true
}

export async function getAndValidateConfig (configPath) {
  const configExists = await fs.pathExists(configPath)
  if (configExists) {
    return loadConfig(configPath)
  }

  return {
    licenses: [],
    modules: []
  }
}

// Simply loads the config file

export async function loadConfig (configPath) {
  let fileContents = await fs.readFile(configPath)
  const config = safeLoad( fileContents.toString(), {
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

// Writes the config
export async function writeConfig (configPath, configObject) {
  let updatedConfig = safeDump(configObject)
  await fs.writeFile(configPath, updatedConfig)
}

// Builds the dependency tree of node modules.
export async function getDepTree () {
  // TODO: Prefer a programmatic way to do this, but performance matters.
  let result = ""
  // https://nodejs.org/api/child_process.html#child_process_maxbuffer_and_unicode
  // It won't throw an error (except in sync mode) it just kills the process...
  const cp = exec("npm list --json", {
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
export async function getDependencies (opts = {}) {
  return await init({ ...defaultLicenseInitOpts, ...opts })
}

// Updates existing licenses based on user input and existing dependencies
export async function getUserLicenseInput (existingLicenses) {
  let { licenses: licenseMap } = await generateLicensesMap()
  const approvedLicenses = [...existingLicenses]
  for (let licenseName in licenseMap) {
    if (!existingLicenses.includes(licenseName)) {
      let answer = await inquirer.prompt({
        message: `${
          licenseMap[licenseName]
        } dependencies use the ${licenseName} license. Would you like to allow this license?`,
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

export async function getUserModulesInput (existingLicenses, existingModules) {
  let dependencies = await getDependencies({
    summary: true
  })
  let unallowedDependencyMap = await getUnallowedDependencies(
    existingLicenses,
    existingModules,
    dependencies
  )
  const approvedModules = [...existingModules]

  if (Object.keys(unallowedDependencyMap).length === 0) {
    return approvedModules
  }

  let initalAnswer = await inquirer.prompt({
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

  for (let dependencyName in unallowedDependencyMap) {
    let answer = await inquirer.prompt({
      message: `${dependencyName} module has an unapproved license (${
        unallowedDependencyMap[dependencyName].licenses
      }). Would you like to allow this module anyway?`,
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

export async function getUnallowedDependencies (existingLicenses, existingModules, dependencies) {
  let unallowedDependencyMap = {}

  for (let dependencyName in dependencies) {
    let dependency = dependencies[dependencyName]
    if (
      !existingLicenses.includes(dependency.licenses) &&
      !existingModules.includes(dependencyName)
    ) {
      unallowedDependencyMap[dependencyName] = dependency
    }
  }

  return unallowedDependencyMap
}

// Shows all the licenses in use for each module.
export async function summary (filePath) {
  const currentConfig = await getAndValidateConfig(filePath)
  let {
    licenses: licenseMap,
    unprocessedLicenseEntries
  } = await generateLicensesMap()
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

export function prettySummary (summary) {
  let approvedTree = _.isEmpty(summary.approved)
    ? "  None\n"
    : treeify.asTree(summary.approved, true, true)
  let unApprovedTree = _.isEmpty(summary.unapproved)
    ? "  None\n"
    : treeify.asTree(summary.unapproved, true, true)
  let unprocessedTree = _.isEmpty(summary.unprocessedLicenseEntries)
    ? "  None\n"
    : treeify.asTree(summary.unprocessedLicenseEntries, true, true)

  let prettySummary = [
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
export async function generateLicensesMap () {
  const opts = {
    start: "./",
    production: true,
    summary: true
  }
  let dependencies = await init(opts)
  let licenses = {}
  let unprocessedLicenseEntries = {}
  for (const name in dependencies) {
    let dependency = dependencies[name]

    // Should only handle licenses that follow the npm package.json recommendations
    if (!canBeProcessed(dependency.licenses)) {
      unprocessedLicenseEntries[name] = dependency.licenses
      continue
    }
    let key = dependency.licenses.toString()
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

// If it is not a string you have to specifically allow the module.
export function canBeProcessed (licenseEntry) {
  return typeof licenseEntry === "string"
}

// Main method that initiates the checking process
export async function getInvalidModuleDependencyTree (config) {
  const licenses = await getDependencies()
  const invalidLicensedModules = getInvalidModules(licenses, config)
  if (invalidLicensedModules === undefined) {
    return
  }
  const packageDepTree = await getDepTree() as any
  return pruneTreeByLicenses(
    packageDepTree.name,
    packageDepTree,
    invalidLicensedModules
  )
}

// Compares a modules map with configured valid licenses.
export function getInvalidModules (moduleList, config) {
  const invalidModules = {}
  for (let moduleName in moduleList) {
    let currentModule = moduleList[moduleName]
    let isLicenseValid = config.licenses
      ? isLicenseValidByConfig(config.licenses, currentModule.licenses)
      : false
    let isModuleValid = config.modules
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

export function isLicenseValidByConfig (configLicenses, license) {
  return configLicenses.includes(license)
}

export function isModuleValidByConfig (configModules, moduleName) {
  return configModules.includes(moduleName)
}

interface prunedNode { licenses: any; version: string }
// Prune out all the 'valid' licensed modules so that the result is
// the tree of modules whose sub-dep licenses are invalid.
export function pruneTreeByLicenses (name, node, invalidLicensedModules) {
  let prunedNode = {} as prunedNode

  let prunedDeps = {} as prunedNode
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