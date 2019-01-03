const {
  spawnSync,
  spawn
} = require('child_process')
const fs = require('fs-extra')
fs.removeSync('./.approved-licenses.yml')

const inputKey = {
  up: "\\027[A",
  down: "\\027[B",
  left: "\\027[D",
  right: "\\027[C",
}

// Yes to all, currently there are 7 licenses in use.
const input = Array(7).fill('').map(() => `${inputKey.down}\n`).join('')
// const {
//   stdout
// } = spawnSync('./index.js', ['-i'], { input, encoding: 'utf8' })

const cp = spawn('./index.js', ['-i'])

// cp.stdout.pipe(process.stdout)

let questionLoaded = false
let questionAnswered = true
let hasGivenAnAnswer = false

cp.stdout.on('data', data => {
  // DEBUG
  const strData = data.toString('utf8')
  console.log(JSON.stringify(strData));
  
  // wait for prompt
  if (questionAnswered && strData.match(/Save and Quit/)) {
    questionLoaded = true
    hasGivenAnAnswer = false
    questionAnswered = false
  }
  if (questionLoaded && strData.match(/\?\s(Y|N)/)) {
    questionAnswered = true
    questionLoaded = false
  }

  if (questionLoaded) {
    if (!questionAnswered && !hasGivenAnAnswer) {
      // answer the question
      cp.stdin.write(`${inputKey.down}`)
      cp.stdin.write('\n')
      hasGivenAnAnswer = true
    }
  }
})

function yes() {
  cp.stdin.write(`${inputKey.down}`)
  cp.stdin.write('\n')
}

function no() {
  cp.stdin.write(`${inputKey.down}`)
  cp.stdin.write('\n')
}

// function saveAndQuit() {
//   cp.stdin.write(`${inputKey.down}`)
//   cp.stdin.write('\n')
// }