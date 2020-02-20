#!/usr/bin/env node

import * as _ from "lodash"
import * as fs from "fs-extra"
import * as treeify from "treeify"
import program = require("commander")
const pkg = fs.readJsonSync("./package.json")

import {
  loadConfig,
  summary,
  getInvalidModuleDependencyTree,
  getAndValidateConfig,
  getUserLicenseInput,
  getUserModulesInput,
  writeConfig,
  prettySummary
} from "./checker"

program
  .version(pkg.version, "-v, --version")
  .option("--summary", "Prints a summary report")
  .option("-i, --interactive", "Runs in interactive mode.")
  .option(
    "-m, --modules-only",
    "Modifies module white list if in interactive mode."
  )

// Default Action
async function action(args: program.Command): Promise<void> {
  const fileName = ".approved-licenses.yml"
  if (args.summary) {
    const summaryMap = await summary(fileName)
    const prettySummaryMap = prettySummary(summaryMap)
    console.log(prettySummaryMap)
    if (_.isEmpty(summaryMap.approved)) {
      console.log(
        `Approved license list is empty. Run with option -i to generate a config file.`
      )
    }
    return
  }

  if (args.interactive) {
    const yamlObj = await getAndValidateConfig(fileName)
    if (!args.modulesOnly) {
      yamlObj.licenses = await getUserLicenseInput(yamlObj.licenses)
    }
    yamlObj.modules = await getUserModulesInput(
      yamlObj.licenses,
      yamlObj.modules
    )
    await writeConfig(fileName, yamlObj)
  }

  const fileExists = await fs.pathExists(fileName)
  if (!fileExists) {
    console.log(
      `Config file ${fileName} not found. Run with option -i to generate a config file.`
    )
    process.exit(1)
  }

  let parsedConfig

  try {
    parsedConfig = await loadConfig(fileName)
  } catch (err) {
    console.error(err.message)
    process.exit(1)
  }

  const depTree = (await getInvalidModuleDependencyTree(parsedConfig)) as any

  if (!_.isEmpty(depTree)) {
    const summaryMap = await summary(fileName)
    const prettySummaryMap = prettySummary(summaryMap)
    console.log(prettySummaryMap)
    console.log(`UNAPPROVED MODULES:`)
    console.log(treeify.asTree(depTree, true, false))
    process.exit(1)
  }

  console.log(
    `Based on your ${fileName} config file, all your dependencies' licenses are valid.`
  )
}

program.action(action)

program.parse(process.argv)
