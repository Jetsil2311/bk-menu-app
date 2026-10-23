// Entry point for the local test environment.
//
//   node scripts/test-env/run.mjs dev     → npm run dev:test
//   node scripts/test-env/run.mjs reset   → npm run test:reset   (add --demo for the demo menu)
//
// `dev` starts the Firestore + Auth emulators (with the Emulator UI) and the
// Vite app in emulator mode. Everything you change is saved to
// ./emulator-data when you stop it (Ctrl+C) and loaded again next time.
import fs from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
import { DATA_DIR, TEST_PROJECT_ID } from './shared.mjs'

const [, , command = 'dev', ...rest] = process.argv

const firebaseAvailable = spawnSync('firebase --version', { stdio: 'ignore', shell: true }).status === 0
if (!firebaseAvailable) {
  console.error('✗ Falta Firebase CLI. Instálalo con: npm install -g firebase-tools')
  process.exit(1)
}

// One command string (not an args array) — avoids Node's DEP0190 warning
// about unescaped args with `shell: true`. All parts are fixed strings.
const run = (args) =>
  new Promise((resolve) => {
    const child = spawn(['firebase', ...args].join(' '), { stdio: 'inherit', shell: true })
    child.on('exit', (code) => resolve(code ?? 0))
  })

const base = ['emulators:exec', '--project', TEST_PROJECT_ID, '--only', 'firestore,auth']

const reset = () => {
  if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true })
  const seedCmd = ['node scripts/test-env/seed.mjs', ...rest].join(' ')
  return run([...base, `--export-on-exit=${JSON.stringify(DATA_DIR)}`, JSON.stringify(seedCmd)])
}

const dev = async () => {
  if (!fs.existsSync(DATA_DIR)) {
    console.log('Primera vez: preparando datos de prueba…\n')
    const code = await reset()
    if (code !== 0) process.exit(code)
  }
  console.log(`
  ┌──────────────────────────────────────────────────────────┐
  │  MODO PRUEBA — los cambios NO tocan los datos del café   │
  │  App:              http://localhost:5173                 │
  │  Ver/editar datos: http://127.0.0.1:4000                 │
  │  Ctrl+C para salir (los cambios se guardan para la      │
  │  próxima vez; npm run test:reset para empezar de cero)   │
  └──────────────────────────────────────────────────────────┘
`)
  const code = await run([...base, '--ui', `--import=${JSON.stringify(DATA_DIR)}`, `--export-on-exit=${JSON.stringify(DATA_DIR)}`, JSON.stringify('vite --mode emulator')])
  process.exit(code)
}

if (command === 'reset') {
  process.exit(await reset())
} else {
  await dev()
}
