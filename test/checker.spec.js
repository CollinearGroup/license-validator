const {
  expect
} = require('chai')
const {
  stringify
} = JSON
const rewire = require('rewire')

describe('#loadConfig', () => {
  let checker
  before(() => {
    checker = rewire('../src/checker.js')
  })
  it('should throw error if no config file found', () => {
    expect(checker.loadConfig).to.throw
  })

  it('should load and validate a config file', async () => {
    // Test an empty file.
    let readFile = async () => {
      return ``
    }
    checker.__set__('fs', {
      readFile
    })
    try {
      await checker.loadConfig('./a/valid/filePath')
      expect.fail("Should throw validation error")
    } catch (e) {
      expect(e.message).to.equal('Configuration file found but it is empty.')
    }

    // Test if it is missing modules
    readFile = async () => {
      return `licenses:\n  - MIT`
    }
    checker.__set__('fs', {
      readFile
    })
    try {
      await checker.loadConfig('./a/valid/filePath')
      expect.fail("Should throw validation error")
    } catch (e) {
      expect(e.message).to.equal(`Configuration file found but it does not have the expected root level 'modules' array.`)
    }

    // Test if it is missing licenses
    readFile = async () => {
      return `modules: []`
    }
    checker.__set__('fs', {
      readFile
    })
    try {
      await checker.loadConfig('./a/valid/filePath')
      expect.fail("Should throw validation error")
    } catch (e) {
      expect(e.message).to.equal(`Configuration file found but it does not have the expected root level 'licenses' array.`)
    }

    // Test if it is missing licenses
    readFile = async () => {
      return `modules: []\nlicenses: []\n`
    }
    checker.__set__('fs', {
      readFile
    })
    const expectedApprovedLicenses = {
      licenses: [],
      modules: [],
    }
    expect(await checker.loadConfig('./a/valid/filePath')).to.eql(expectedApprovedLicenses)
  })

})

describe('#getAndValidateConfig', () => {
  it('should load an existing config or return new baseline config', async () => {
    const checker = rewire('../src/checker.js')
    // Test when file does not exist
    checker.__set__('fs', {
      exists: async () => false
    })
    let result = await checker.getAndValidateConfig('./path/to/.config')
    expect(result).to.eql({
      licenses: [],
      modules: []
    })

    // Test when file exists
    checker.__set__('fs', {
      exists: async () => true,
      readFile: async () => `licenses:\n  - MIT\nmodules: []\n`,
    })
    // 'this' is broken when we rewire()
    checker.__set__('loadConfig', checker.loadConfig)
    result = await checker.getAndValidateConfig('./path/to/.config')
    expect(result).to.eql({
      licenses: ['MIT'],
      modules: []
    })
  })
})

describe('#getDepTree', () => {
  it('should return json dependency tree', async () => {
    let checker = rewire('../src/checker.js')
    let stdout = stringify({
      name: "arrsome-module",
      dependencies: {
        'a-dep': {
          from: 'a-dep@1.0.0'
        }
      }
    })
    checker.__set__('exec', async () => {
      return {
        stdout: stdout,
        stderr: ''
      }
    })
    const result = await checker.getDepTree()
    expect(result).to.eql({
      name: "arrsome-module",
      dependencies: {
        'a-dep': {
          from: 'a-dep@1.0.0'
        }
      }
    })
  })
})

describe('#getLicenses', () => {
  it('should return module-license map', async () => {
    let checker = rewire('../src/checker.js')
    checker.__set__('init', async () => {
      return {
        mockResult: true
      }
    })
    let result = await checker.getLicenses()
    expect(result).to.eql({
      mockResult: true
    })
  })
})

describe('#getUserLicenseInput', () => {
  it('should request and return approved licenses', async () => {
    const checker = rewire('../src/checker.js')
    checker.__set__('summary', () => {
      return {
        'Custom': 1, // false
        'MIT': 100, // not called
        'Apache 2.0': 100, // true
        'GPL 1.0': 1, // false
      }
    })
    // Yes to everything, should only be called once.
    let counter = 0
    checker.__set__('inquirer', {
      prompt: async () => {
        // Every other call is opposite, starting with false.
        return {
          answerKey: !!(counter++ % 2)
        }
      }
    })
    const existingLicenses = ['MIT']

    const result = await checker.getUserLicenseInput(existingLicenses)
    expect(result).to.eql(['MIT', 'Apache 2.0'])
  })
})

describe('#summary', () => {
  it('should return license summary', async () => {
    let checker = rewire('../src/checker.js')
    checker.__set__('init', async () => {
      return {
        'module-fire@1.0.0': {
          licenses: "ISC"
        },
        'module-water@1.0.0': {
          licenses: "ISC"
        }
      }
    })
    let result = await checker.summary(true)
    expect(result).to.equal(`└─ ISC: 2\n`)
    result = await checker.summary()
    expect(result).to.eql({
      ISC: 2
    })
  })
})

describe('#pruneTreeByLicenses', () => {
  let checker = require('../src/checker.js')

  it('should return an empty dep tree when all licenses are valid', async () => {
    let node = {
      name: 'my-module',
      version: '1.0.0',
      dependencies: {
        'sub-module-a': {
          name: 'sub-module-a',
          from: 'sub-module-a@^2.0.0',
          version: '2.0.3'
        }
      }
    }
    let invalidLicensedModules = {}

    const result = checker.pruneTreeByLicenses('my-module', node, invalidLicensedModules)
    expect(result).to.be.undefined
  })

  it('should return all invalid licensed modules', async () => {
    // Based on the node module dep tree output
    let node = {
      name: 'my-module',
      dependencies: {
        'sub-module-a': {
          from: 'sub-module-a@2.0.0',
          version: '2.0.0',
          dependencies: {
            'sub-module-a-b': {
              from: 'sub-module-a-b@1.0.0',
              version: '1.0.0'
            },
            'sub-module-d-b': {
              from: 'sub-module-d-b@1.0.0',
              version: '1.0.0'
            }
          }
        }
      }
    }
    // Based on the output from getInvalidModules()
    let invalidLicensedModules = {
      'sub-module-a-b@1.0.0': {
        licenses: 'MIT'
      }
    }

    const result = checker.pruneTreeByLicenses('my-module', node, invalidLicensedModules)
    const expectedDependencies = {
      name: 'my-module',
      dependencies: {
        'sub-module-a': {
          from: 'sub-module-a@2.0.0',
          version: '2.0.0',
          dependencies: {
            'sub-module-a-b': {
              from: 'sub-module-a-b@1.0.0',
              version: '1.0.0',
              licenses: 'MIT'
            }
          }
        }
      }
    }

    expect(result).to.eql(expectedDependencies)
  })
})

describe('#writeConfig', () => {
  it('should write the config to yaml', async () => {
    const checker = rewire('../src/checker.js')
    let calledArguments
    checker.__set__('fs', {
      writeFile: async function (path, config) {
        calledArguments = arguments
      }
    })

    const licenses = ['MIT']
    const modules = []
    await checker.writeConfig('.config', {
      licenses,
      modules
    })
    expect(calledArguments[1]).to.equal(`licenses:\n  - MIT\nmodules: []\n`)
  })
})

describe('#getInvalidModuleDependencyTree', () => {
  it('should return undefined when all modules are valid', async () => {
    const checker = rewire('../src/checker.js')
    // Deal with rewire bug with modeul.exports and 'this'
    for (let key in checker) {
      checker.__set__(key, checker[key])
    }
    checker.__set__('getLicenses', async () => {
      return {
        'modules@1.0.0': {
          licenses: 'MIT'
        }
      }
    })
    let config = {
      licenses: ['MIT']
    }
    const result = await checker.getInvalidModuleDependencyTree(config)
    expect(result).to.be.undefined

    // ensures we're just calling through the functions.
    checker.__set__('getDepTree', async () => {
      return {}
    })
    checker.__set__('pruneTreeByLicenses', async () => {
      return {
        name: 'my-module'
      }
    })
    config = {
      license: []
    }
    const invalidLicenseModuleTree = await checker.getInvalidModuleDependencyTree(config)
    expect(invalidLicenseModuleTree).to.eql({
      name: 'my-module'
    })
  })
  it('should return invalid module tree when modules are invalid', () => {})
})

describe('#getInvalidModules', () => {
  it('should return undefined when no invalid modules', () => {
    const checker = require('../src/checker')
    const modulesList = {
      'module@1.0.0': {
        licenses: 'MIT'
      }
    }
    // Tests license whitelisting
    let config = {
      licenses: ['MIT']
    }
    let result = checker.getInvalidModules(modulesList, config)
    expect(result).to.be.undefined

    // Tests modules whitelisting
    config = {
      modules: ['module@1.0.0']
    }
    result = checker.getInvalidModules(modulesList, config)
    expect(result).to.be.undefined
  })

  it('should return module details when it is invalid', () => {
    const checker = require('../src/checker')
    const modulesList = {
      'module@1.0.0': {
        licenses: 'MIT',
        key: 'Value'
      }
    }
    const config = {
      licenses: []
    }
    const result = checker.getInvalidModules(modulesList, config)
    expect(result).to.eql({
      'module@1.0.0': {
        licenses: 'MIT',
        key: 'Value'
      }
    })
  })
})