const {
  expect
} = require('chai')
const {
  spawnSync
} = require('child_process')
const fs = require('fs-extra')
const CONFIG_FILENAME = '.approved-licenses.yml'
const inputKey = {
  up: "\\027[A",
  down: "\\027[B",
  left: "\\027[D",
  right: "\\027[C",
}

xdescribe('integration test: current state', () => {

  it('should have valid config file', async () => {
    // Tests current state
    const fileExists = await fs.exists('./.approved-licenses.yml')
    expect(fileExists).to.be.true

    const expectedResult = "Based on your .approved-licenses.yml config file, all your dependencies' licenses are valid.\n"
    const {
      stdout
    } = spawnSync('./index.js')
    expect(stdout.toString('utf-8')).to.equal(expectedResult)
  })

  it('should print summary', async () => {
    const expectedResult = [
      `Licenses`,
      '',
      'APPROVED:',
      '├─ ISC: 21',
      '├─ MIT: 58',
      '├─ BSD-2-Clause: 2',
      '├─ BSD-3-Clause: 2',
      '├─ Apache-2.0: 4',
      '└─ CC-BY-3.0: 2',
      '',
      'UNAPPROVED:',
      '└─ CC0-1.0: 1',
      '',
      '',
      '',
    ].join('\n')
    const {
      stdout
    } = spawnSync('./index.js', ['--summary'])
    expect(stdout.toString('utf-8')).to.equal(expectedResult)
  })
})

describe('integration test: bad files', () => {

  before(async () => {
    await fs.remove('./tmp')
    await fs.ensureDir('./tmp')
    await fs.copy(`${CONFIG_FILENAME}`, `tmp/${CONFIG_FILENAME}`)
  })

  after(async () => {
    await fs.copy(`tmp/${CONFIG_FILENAME}`, `${CONFIG_FILENAME}`)
  })

  it('should error on bad files', async () => {
    // No file
    await fs.remove(CONFIG_FILENAME)
    const {
      stdout: noFileResult
    } = spawnSync('./index.js')
    expect(noFileResult.toString('utf-8')).to.equal('Config file .approved-licenses.yml not found. Run with option -i to generate a config file.\n')

    // empty config file
    await fs.writeFile(CONFIG_FILENAME, [
      `licenses: []`,
      `modules: []`,
    ].join('\n'))
    const {
      stdout: emptyConfigResult
    } = spawnSync('./index.js')
    expect(emptyConfigResult.toString('utf-8')).to.match(/APPROVED:\n\s+None/)

    // Yes to all, currently there are 7 licenses in use.
    const input = Array(7).fill('').map(() => `${inputKey.down}\n`).join('')
    const {
      stdout: yesToAllResult
    } = spawnSync('./index.js', ['-i'], { input })
    expect(yesToAllResult.toString('utf-8')).to.match(/UNAPPROVED:\n\s+None/)

  }).timeout(10000)
})