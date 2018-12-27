const {
  expect
} = require('chai')
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
    let readFile = async () => {
      return ``
    }
    checker.__set__('readFile', readFile)
    try {
      await checker.loadConfig('./a/valid/filePath')
      expect.fail("Should throw validation error")
    } catch (e) {
      expect(e.message).to.match(/licenses/)
    }

    readFile = async () => {
      return `licenses:\n  - MIT`
    }
    checker.__set__('readFile', readFile)
    const expectedApprovedLicenses = {
      licenses: ['MIT']
    }
    expect(await checker.loadConfig('./a/valid/filePath')).to.eql(expectedApprovedLicenses)
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