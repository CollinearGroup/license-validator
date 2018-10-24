const checker = require('../src/checker')
const {
  expect
} = require('chai')

describe('#pruneTreeByLicenses', () => {

  it('should return an empty dep tree when all licenses are valid', async () => {
    let node = {
      name: 'my-module',
      version: '1.0.0',
      dependencies: {
        'sub-module-a': {
          name: 'sub-module-a',
          version: '2.0.0'
        }
      }
    }
    let invalidLicensedModules = {}

    const result = checker.pruneTreeByLicenses(node, invalidLicensedModules)
    expect(result.dependencies).to.eql({})
  })

  it('should return all invalid licensed modules', async () => {
    let node = {
      name: 'my-module',
      version: '1.0.0',
      dependencies: {
        'sub-module-a': {
          name: 'sub-module-a',
          version: '2.0.0'
        }
      }
    }
    let invalidLicensedModules = {
      'sub-module-a': {
        licenses: 'MIT'
      }
    }

    const result = checker.pruneTreeByLicenses(node, invalidLicensedModules)
    const expectedDependencies = {
      'sub-module-a': {
        name: 'sub-module-a',
        version: '2.0.0'
      }
    }
    expect(result.dependencies).to.eql()
  })

})