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
    // Based on the node module dep tree output
    let node = {
      name: 'my-module',
      version: '1.0.0',
      dependencies: {
        'sub-module-a': {
          from: 'sub-module-a',
          version: '2.0.0',
          dependencies: {
            'sub-module-a-b': {
              from: 'sub-module-a-b',
              version: '1.0.0',
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

    const result = checker.pruneTreeByLicenses(node, invalidLicensedModules)
    // const expectedDependencies = {
    //   'sub-module-a': {
    //     from: 'sub-module-a',
    //     version: '2.0.0'
    //   }
    // }
    expect(result).to.eql(node)
  })

})