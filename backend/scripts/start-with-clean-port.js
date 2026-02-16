/**
 * Start backend – pehle port pe chalne wala process kill karo, phir server start.
 * "Port already in use" error ab nahi aayega.
 */
require('dotenv').config();
const { spawn } = require('child_process');
const path = require('path');

const config = require('../src/config');
const port = config.port;

async function killPort() {
  try {
    const kill = require('kill-port');
    await kill(port, 'tcp');
    console.log(`[start] Port ${port} freed (old process stopped).`);
  } catch (err) {
    // Port pe koi process nahi tha – ignore
    if (err.message && !err.message.includes('not found')) {
      console.warn('[start] kill-port:', err.message);
    }
  }
}

async function main() {
  await killPort();
  await new Promise((r) => setTimeout(r, 800));

  const child = spawn(process.execPath, [path.join(__dirname, '..', 'src', 'server.js')], {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
  });

  child.on('error', (err) => {
    console.error('[start] Failed:', err.message);
    process.exit(1);
  });

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });
}

main().catch((err) => {
  console.error('[start]', err.message);
  process.exit(1);
});
