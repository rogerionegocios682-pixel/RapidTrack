/**
 * fix-env.js
 * ---------------------------------------------------------------------------
 * Workaround for Windows machines whose user profile path contains spaces or
 * non-ASCII characters (e.g. "C:\Users\Rogério Herculano").
 *
 * npm/gyp/node-gyp split unquoted paths on whitespace, which breaks native
 * module builds and even some lifecycle scripts. This script normalises the
 * environment for the Next.js process so the app boots reliably.
 *
 * It is intentionally dependency-free and safe to run repeatedly.
 */
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');

/**
 * Cria um diretório sem derrubar o build quando o filesystem é somente-leitura
 * (Vercel, containers). Nesses ambientes o diretório de dados é montado em
 * outro caminho (ver DATA_DIR) e o cache do npm já existe.
 */
function ensureDir(dir, label) {
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return true;
  } catch (err) {
    console.warn(
      '[fix-env] não foi possível criar %s (%s): %s — seguindo sem ela.',
      label,
      dir,
      err.code || err.message,
    );
    return false;
  }
}

// 1) Make sure the persistent data directory exists (stores the SQLite file).
//    Respeita DATA_DIR quando definido (ex.: volume gravável no deploy).
const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(root, 'data');
ensureDir(dataDir, 'diretório de dados');

// 2) Point npm/node config at the local cache to dodge ACL issues on the
//    accented profile folder. Only set when not already provided.
//    Em CI/Vercel não criamos cache local — o próprio ambiente já configura um.
if (!process.env.npm_config_cache && !process.env.CI && !process.env.VERCEL) {
  const cacheDir = path.join(root, '.npm-cache');
  if (ensureDir(cacheDir, 'cache do npm')) {
    process.env.npm_config_cache = cacheDir;
  }
}

// 3) Silence the noisy "npm warn config" deprecation output.
process.env.NPM_CONFIG_FUND = 'false';
process.env.NPM_CONFIG_AUDIT = 'false';

console.log('[fix-env] environment ready (root: %s)', root);
