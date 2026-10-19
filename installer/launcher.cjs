const { spawn, spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');

const appRoot = __dirname;
const appData = process.env.LOCALAPPDATA
  ? path.join(process.env.LOCALAPPDATA, 'DeliveryOS')
  : path.join(os.homedir(), 'AppData', 'Local', 'DeliveryOS');
const dataDir = path.join(appData, 'data');
const runtimeFile = path.join(appData, 'server.json');
const secretFile = path.join(appData, 'session-secret');
const errorFile = path.join(appData, 'launcher-error.txt');
const nodeExe = path.join(appRoot, 'runtime', 'node.exe');
const serverFile = path.join(appRoot, 'server.js');

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function openFile(file) {
  spawn('notepad.exe', [file], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
}

function openUrl(url) {
  spawn('rundll32.exe', ['url.dll,FileProtocolHandler', url], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  }).unref();
}

function createSessionSecret() {
  fs.mkdirSync(appData, { recursive: true });
  try {
    const fd = fs.openSync(secretFile, 'wx', 0o600);
    try {
      fs.writeFileSync(fd, crypto.randomBytes(48).toString('hex'));
    } finally {
      fs.closeSync(fd);
    }
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
  return fs.readFileSync(secretFile, 'utf8').trim();
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close((error) => {
        if (error) reject(error);
        else resolve(address.port);
      });
    });
  });
}

async function isReady(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/login`, {
      signal: AbortSignal.timeout(1500),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function stopServer() {
  if (!fs.existsSync(runtimeFile)) return;
  const runtime = JSON.parse(fs.readFileSync(runtimeFile, 'utf8'));
  if (Number.isInteger(runtime.pid) && (await isReady(runtime.port))) {
    try {
      process.kill(runtime.pid, 'SIGTERM');
    } catch (error) {
      if (error.code !== 'ESRCH') throw error;
    }
  }
  fs.rmSync(runtimeFile, { force: true });
}

async function startServer() {
  fs.mkdirSync(appData, { recursive: true });
  fs.mkdirSync(dataDir, { recursive: true });

  if (!fs.existsSync(nodeExe) || !fs.existsSync(serverFile)) {
    throw new Error('Arquivos do aplicativo ausentes. Reinstale o Delivery OS.');
  }

  if (fs.existsSync(runtimeFile)) {
    const previous = JSON.parse(fs.readFileSync(runtimeFile, 'utf8'));
    if (await isReady(previous.port)) {
      openUrl(`http://127.0.0.1:${previous.port}/login`);
      return;
    }
    fs.rmSync(runtimeFile, { force: true });
  }

  const setup = spawnSync(nodeExe, [path.join(appRoot, 'initialize-local-db.cjs')], {
    cwd: appRoot,
    env: { ...process.env, DATA_DIR: dataDir, DATABASE_URL: '', DIRECT_URL: '' },
    encoding: 'utf8',
    windowsHide: true,
  });
  if (setup.status !== 0) {
    throw new Error(setup.stderr?.trim() || 'Não foi possível inicializar o banco SQLite.');
  }

  const port = await findFreePort();
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    HOSTNAME: '127.0.0.1',
    PORT: String(port),
    NEXT_DIST_DIR: '.next-installer',
    DATA_DIR: dataDir,
    SESSION_SECRET: createSessionSecret(),
    DATABASE_URL: '',
    DIRECT_URL: '',
  };
  const child = spawn(nodeExe, [serverFile], {
    cwd: appRoot,
    env,
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });

  child.unref();
  fs.writeFileSync(runtimeFile, JSON.stringify({ pid: child.pid, port }), { mode: 0o600 });

  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (await isReady(port)) {
      openUrl(`http://127.0.0.1:${port}/login`);
      const credentialsFile = path.join(appData, 'initial-admin.txt');
      const shownFile = path.join(appData, 'initial-admin-shown');
      if (fs.existsSync(credentialsFile) && !fs.existsSync(shownFile)) {
        fs.writeFileSync(shownFile, new Date().toISOString());
        openFile(credentialsFile);
      }
      return;
    }
    await wait(500);
  }

  try {
    child.kill();
  } catch {
    // The server may already have exited.
  }
  fs.rmSync(runtimeFile, { force: true });
  throw new Error('O servidor local não iniciou. Verifique os arquivos da instalação.');
}

async function main() {
  if (process.argv.includes('--stop')) {
    await stopServer();
    return;
  }
  await startServer();
}

main().catch((error) => {
  fs.mkdirSync(appData, { recursive: true });
  fs.writeFileSync(errorFile, `${error.stack || error.message}\r\n`);
  openFile(errorFile);
  process.exitCode = 1;
});
