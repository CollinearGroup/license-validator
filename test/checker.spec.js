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
    let readFile = async () => {
      return ``
    }
    checker.__set__('fs', {readFile})
    try {
      await checker.loadConfig('./a/valid/filePath')
      expect.fail("Should throw validation error")
    } catch (e) {
      expect(e.message).to.match(/licenses/)
    }

    readFile = async () => {
      return `licenses:\n  - MIT`
    }
    checker.__set__('fs', {readFile})
    const expectedApprovedLicenses = {
      licenses: ['MIT']
    }
    expect(await checker.loadConfig('./a/valid/filePath')).to.eql(expectedApprovedLicenses)
  })
  
})

describe('#getDepTree', () => {
  it('should return json dependency tree', async() => {
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
      return { mockResult: true }
    })
    let result = await checker.getLicenses()
    expect(result).to.eql({ mockResult: true })
  })
})

// describe('#summary', () => {
  // it('should return license summary', () => {
    // let checker = rewire('../src/checker.js')
    // TODO: give legit result? or just mock both?
    // checker.__set__('init', async () => {
      // return { mockResult: true }
    // })
    // let result = await checker.getLicenses()
//   })
// })

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