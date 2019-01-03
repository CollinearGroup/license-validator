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

describe('#getDependencies', () => {
  it('should return module-license map', async () => {
    let checker = rewire('../src/checker.js')
    checker.__set__('init', async () => {
      return {
        mockResult: true
      }
    })
    let result = await checker.getDependencies()
    expect(result).to.eql({
      mockResult: true
    })
  })
})

describe('#getUserLicenseInput', () => {
  it('should request and return approved licenses', async () => {
    const checker = rewire('../src/checker.js')
    checker.__set__('generateLicensesMap', async () => {
      return {
        'Custom': 1, // false
        'MIT': 100, // not called
        'Apache 2.0': 100, // true
        'GPL 1.0': 1, // save and quit
      }
    })
    let answers = ['N', 'Y', 'Save and Quit']
    checker.__set__('inquirer', {
      prompt: async () => {
        return {
          answerKey: answers.shift()
        }
      }
    })
    const existingLicenses = ['MIT']

    const result = await checker.getUserLicenseInput(existingLicenses)
    expect(result).to.eql(['MIT', 'Apache 2.0'])
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