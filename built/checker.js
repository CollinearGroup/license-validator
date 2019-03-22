"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var _ = require("lodash");
var inquirer = require("inquirer");
var util_1 = require("util");
var parse = JSON.parse;
var fs = require("fs-extra");
var treeify = require("treeify");
var license_checker_1 = require("license-checker");
var init = util_1.promisify(license_checker_1.init);
var exec = require("child_process").exec;
var js_yaml_1 = require("js-yaml");
var defaultLicenseInitOpts = {
    start: "./",
    production: true
};
function getAndValidateConfig(configPath) {
    return __awaiter(this, void 0, void 0, function () {
        var configExists;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, fs.pathExists(configPath)];
                case 1:
                    configExists = _a.sent();
                    if (configExists) {
                        return [2 /*return*/, loadConfig(configPath)];
                    }
                    return [2 /*return*/, {
                            licenses: [],
                            modules: []
                        }];
            }
        });
    });
}
exports.getAndValidateConfig = getAndValidateConfig;
// Simply loads the config file
function loadConfig(configPath) {
    return __awaiter(this, void 0, void 0, function () {
        var fileContents, config;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, fs.readFile(configPath)];
                case 1:
                    fileContents = _a.sent();
                    config = js_yaml_1.safeLoad(fileContents.toString(), {
                        filename: configPath
                    });
                    if (!config) {
                        throw new Error("Configuration file found but it is empty.");
                    }
                    else if (!_.isArray(config.licenses)) {
                        throw new Error("Configuration file found but it does not have the expected root level 'licenses' array.");
                    }
                    else if (!_.isArray(config.modules)) {
                        throw new Error("Configuration file found but it does not have the expected root level 'modules' array.");
                    }
                    return [2 /*return*/, config];
            }
        });
    });
}
exports.loadConfig = loadConfig;
// Writes the config
function writeConfig(configPath, configObject) {
    return __awaiter(this, void 0, void 0, function () {
        var updatedConfig;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    updatedConfig = js_yaml_1.safeDump(configObject);
                    return [4 /*yield*/, fs.writeFile(configPath, updatedConfig)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
exports.writeConfig = writeConfig;
// Builds the dependency tree of node modules.
function getDepTree() {
    return __awaiter(this, void 0, void 0, function () {
        var result, cp;
        return __generator(this, function (_a) {
            result = "";
            cp = exec("npm list --json", {
                maxBuffer: 1024 * 1024 * 2
            });
            cp.stdout.on("data", function (data) { return (result += data); });
            return [2 /*return*/, new Promise(function (resolve, reject) {
                    cp.on("close", function () {
                        resolve(parse(result));
                    });
                    cp.on("error", reject);
                })];
        });
    });
}
exports.getDepTree = getDepTree;
// Runs license-checker to just the list of licenses in the format
// that license-checker handles so we can safely call other functions like `asSummary`
function getDependencies(opts) {
    if (opts === void 0) { opts = {}; }
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, init(__assign({}, defaultLicenseInitOpts, opts))];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
exports.getDependencies = getDependencies;
// Updates existing licenses based on user input and existing dependencies
function getUserLicenseInput(existingLicenses) {
    return __awaiter(this, void 0, void 0, function () {
        var licenseMap, approvedLicenses, _a, _b, _i, licenseName, answer;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, generateLicensesMap()];
                case 1:
                    licenseMap = (_c.sent()).licenses;
                    approvedLicenses = existingLicenses.slice();
                    _a = [];
                    for (_b in licenseMap)
                        _a.push(_b);
                    _i = 0;
                    _c.label = 2;
                case 2:
                    if (!(_i < _a.length)) return [3 /*break*/, 5];
                    licenseName = _a[_i];
                    if (!!existingLicenses.includes(licenseName)) return [3 /*break*/, 4];
                    return [4 /*yield*/, inquirer.prompt({
                            message: licenseMap[licenseName] + " dependencies use the " + licenseName + " license. Would you like to allow this license?",
                            name: "answerKey",
                            type: "list",
                            choices: ["N", "Y", "Save and Quit"]
                        })];
                case 3:
                    answer = _c.sent();
                    if (answer["answerKey"] === "Y") {
                        approvedLicenses.push(licenseName);
                    }
                    else if (answer["answerKey"] === "Save and Quit") {
                        return [2 /*return*/, approvedLicenses];
                    }
                    _c.label = 4;
                case 4:
                    _i++;
                    return [3 /*break*/, 2];
                case 5: return [2 /*return*/, approvedLicenses];
            }
        });
    });
}
exports.getUserLicenseInput = getUserLicenseInput;
function getUserModulesInput(existingLicenses, existingModules) {
    return __awaiter(this, void 0, void 0, function () {
        var dependencies, unallowedDependencyMap, approvedModules, initalAnswer, _a, _b, _i, dependencyName, answer;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, getDependencies({
                        summary: true
                    })];
                case 1:
                    dependencies = _c.sent();
                    return [4 /*yield*/, getUnallowedDependencies(existingLicenses, existingModules, dependencies)];
                case 2:
                    unallowedDependencyMap = _c.sent();
                    approvedModules = existingModules.slice();
                    if (Object.keys(unallowedDependencyMap).length === 0) {
                        return [2 /*return*/, approvedModules];
                    }
                    return [4 /*yield*/, inquirer.prompt({
                            message: "You have " + Object.keys(unallowedDependencyMap).length + " modules with unapproved licenses. Would you like to modify your approved module list?",
                            name: "confirmKey",
                            type: "list",
                            choices: ["N", "Y"]
                        })];
                case 3:
                    initalAnswer = _c.sent();
                    if (initalAnswer["confirmKey"] === "N") {
                        return [2 /*return*/, approvedModules];
                    }
                    _a = [];
                    for (_b in unallowedDependencyMap)
                        _a.push(_b);
                    _i = 0;
                    _c.label = 4;
                case 4:
                    if (!(_i < _a.length)) return [3 /*break*/, 7];
                    dependencyName = _a[_i];
                    return [4 /*yield*/, inquirer.prompt({
                            message: dependencyName + " module has an unapproved license (" + unallowedDependencyMap[dependencyName].licenses + "). Would you like to allow this module anyway?",
                            name: "answerKey",
                            type: "list",
                            choices: ["N", "Y", "Save and Quit"]
                        })];
                case 5:
                    answer = _c.sent();
                    if (answer["answerKey"] === "Y") {
                        approvedModules.push(dependencyName);
                    }
                    else if (answer["answerKey"] === "Save and Quit") {
                        return [2 /*return*/, approvedModules];
                    }
                    _c.label = 6;
                case 6:
                    _i++;
                    return [3 /*break*/, 4];
                case 7: return [2 /*return*/, approvedModules];
            }
        });
    });
}
exports.getUserModulesInput = getUserModulesInput;
function getUnallowedDependencies(existingLicenses, existingModules, dependencies) {
    return __awaiter(this, void 0, void 0, function () {
        var unallowedDependencyMap, dependencyName, dependency;
        return __generator(this, function (_a) {
            unallowedDependencyMap = {};
            for (dependencyName in dependencies) {
                dependency = dependencies[dependencyName];
                if (!existingLicenses.includes(dependency.licenses) &&
                    !existingModules.includes(dependencyName)) {
                    unallowedDependencyMap[dependencyName] = dependency;
                }
            }
            return [2 /*return*/, unallowedDependencyMap];
        });
    });
}
exports.getUnallowedDependencies = getUnallowedDependencies;
// Shows all the licenses in use for each module.
function summary(filePath) {
    return __awaiter(this, void 0, void 0, function () {
        var currentConfig, _a, licenseMap, unprocessedLicenseEntries, summary, license;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, getAndValidateConfig(filePath)];
                case 1:
                    currentConfig = _b.sent();
                    return [4 /*yield*/, generateLicensesMap()];
                case 2:
                    _a = _b.sent(), licenseMap = _a.licenses, unprocessedLicenseEntries = _a.unprocessedLicenseEntries;
                    summary = {
                        approved: {},
                        unapproved: {},
                        unprocessedLicenseEntries: unprocessedLicenseEntries
                    };
                    for (license in licenseMap) {
                        if (currentConfig.licenses.includes(license)) {
                            summary.approved[license] = licenseMap[license];
                        }
                        else {
                            summary.unapproved[license] = licenseMap[license];
                        }
                    }
                    return [2 /*return*/, summary];
            }
        });
    });
}
exports.summary = summary;
function prettySummary(summary) {
    var approvedTree = _.isEmpty(summary.approved)
        ? "  None\n"
        : treeify.asTree(summary.approved, true, true);
    var unApprovedTree = _.isEmpty(summary.unapproved)
        ? "  None\n"
        : treeify.asTree(summary.unapproved, true, true);
    var unprocessedTree = _.isEmpty(summary.unprocessedLicenseEntries)
        ? "  None\n"
        : treeify.asTree(summary.unprocessedLicenseEntries, true, true);
    var prettySummary = [
        "Licenses",
        "",
        "APPROVED:",
        approvedTree,
        "UNAPPROVED:",
        unApprovedTree,
        "UNPROCESSED:",
        unprocessedTree
    ].join("\n");
    return prettySummary;
}
exports.prettySummary = prettySummary;
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
function generateLicensesMap() {
    return __awaiter(this, void 0, void 0, function () {
        var opts, dependencies, licenses, unprocessedLicenseEntries, name_1, dependency, key;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    opts = {
                        start: "./",
                        production: true,
                        summary: true
                    };
                    return [4 /*yield*/, init(opts)];
                case 1:
                    dependencies = _a.sent();
                    licenses = {};
                    unprocessedLicenseEntries = {};
                    for (name_1 in dependencies) {
                        dependency = dependencies[name_1];
                        // Should only handle licenses that follow the npm package.json recommendations
                        if (!canBeProcessed(dependency.licenses)) {
                            unprocessedLicenseEntries[name_1] = dependency.licenses;
                            continue;
                        }
                        key = dependency.licenses.toString();
                        if (licenses[key]) {
                            licenses[key]++;
                        }
                        else {
                            licenses[key] = 1;
                        }
                    }
                    return [2 /*return*/, {
                            licenses: licenses,
                            unprocessedLicenseEntries: unprocessedLicenseEntries
                        }];
            }
        });
    });
}
exports.generateLicensesMap = generateLicensesMap;
// If it is not a string you have to specifically allow the module.
function canBeProcessed(licenseEntry) {
    return typeof licenseEntry === "string";
}
exports.canBeProcessed = canBeProcessed;
// Main method that initiates the checking process
function getInvalidModuleDependencyTree(config) {
    return __awaiter(this, void 0, void 0, function () {
        var licenses, invalidLicensedModules, packageDepTree;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getDependencies()];
                case 1:
                    licenses = _a.sent();
                    invalidLicensedModules = getInvalidModules(licenses, config);
                    if (invalidLicensedModules === undefined) {
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, getDepTree()];
                case 2:
                    packageDepTree = _a.sent();
                    return [2 /*return*/, pruneTreeByLicenses(packageDepTree.name, packageDepTree, invalidLicensedModules)];
            }
        });
    });
}
exports.getInvalidModuleDependencyTree = getInvalidModuleDependencyTree;
// Compares a modules map with configured valid licenses.
function getInvalidModules(moduleList, config) {
    var invalidModules = {};
    for (var moduleName in moduleList) {
        var currentModule = moduleList[moduleName];
        var isLicenseValid = config.licenses
            ? isLicenseValidByConfig(config.licenses, currentModule.licenses)
            : false;
        var isModuleValid = config.modules
            ? isModuleValidByConfig(config.modules, moduleName)
            : false;
        if (!isLicenseValid && !isModuleValid) {
            invalidModules[moduleName] = currentModule;
        }
    }
    if (_.isEmpty(invalidModules)) {
        return;
    }
    return invalidModules;
}
exports.getInvalidModules = getInvalidModules;
function isLicenseValidByConfig(configLicenses, license) {
    return configLicenses.includes(license);
}
exports.isLicenseValidByConfig = isLicenseValidByConfig;
function isModuleValidByConfig(configModules, moduleName) {
    return configModules.includes(moduleName);
}
exports.isModuleValidByConfig = isModuleValidByConfig;
// Prune out all the 'valid' licensed modules so that the result is
// the tree of modules whose sub-dep licenses are invalid.
function pruneTreeByLicenses(name, node, invalidLicensedModules) {
    var prunedNode = {};
    var prunedDeps = {};
    for (var key in node.dependencies) {
        // dependency is an object
        var dependency = node.dependencies[key];
        var prunedSubTreeNode = pruneTreeByLicenses(key, dependency, invalidLicensedModules);
        if (!_.isEmpty(prunedSubTreeNode)) {
            prunedDeps[key] = __assign({}, prunedSubTreeNode);
        }
    }
    if (!_.isEmpty(prunedDeps)) {
        prunedNode = __assign({}, prunedDeps);
    }
    var moduleId = name + "@" + node.version;
    if (invalidLicensedModules[moduleId] !== undefined) {
        prunedNode.licenses = invalidLicensedModules[moduleId].licenses;
        prunedNode.version = node.version;
    }
    else if (!_.isEmpty(prunedDeps)) {
        prunedNode.version = node.version;
    }
    return prunedNode;
}
exports.pruneTreeByLicenses = pruneTreeByLicenses;
