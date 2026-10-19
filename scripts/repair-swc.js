/**
 * repair-swc.js
 * ---------------------------------------------------------------------------
 * O binário nativo do SWC (@next/swc-win32-x64-msvc) chega corrompido/truncado
 * no `npm install` desta máquina. Este script baixa o pacote direto do registro
 * npm e extrai os arquivos manualmente, garantindo bytes íntegros.
 *
 * Uso: node scripts/repair-swc.js [versão do Next]
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const https = require('https');

const root = path.resolve(__dirname, '..');
const nextVersion =
  process.argv[2] ||
  JSON.parse(fs.readFileSync(path.join(root, 'node_modules', 'next', 'package.json'), 'utf8'))
    .version;

const PKG = '@next/swc-win32-x64-msvc';
const URL = `https://registry.npmjs.org/${PKG}/-/swc-win32-x64-msvc-${nextVersion}.tgz`;

function parseTar(buf) {
  const entries = [];
  let offset = 0;
  while (offset + 512 <= buf.length) {
    const header = buf.subarray(offset, offset + 512);
    if (header.every((b) => b === 0)) break;

    const rawName = header.subarray(0, 100).toString('utf8').replace(/\0.*$/, '');
    const rawPrefix = header.subarray(345, 500).toString('utf8').replace(/\0.*$/, '');
    const name = rawPrefix ? `${rawPrefix}/${rawName}` : rawName;
    const size =
      parseInt(
        header.subarray(124, 136).toString('utf8').replace(/\0.*$/, '').trim(),
        8,
      ) || 0;
    const typeFlag = String.fromCharCode(header[156]);
    const dataStart = offset + 512;

    entries.push({ name, size, typeFlag, data: buf.subarray(dataStart, dataStart + size) });
    offset = dataStart + Math.ceil(size / 512) * 512;
  }
  return entries;
}

function fetch(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'delivery-os-repair' } }, (res) => {
        if ([301, 302, 307, 308].includes(res.statusCode) && redirects < 5) {
          res.resume();
          return resolve(fetch(res.headers.location, redirects + 1));
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      })
      .on('error', reject);
  });
}

async function main() {
  const dest = path.join(root, 'node_modules', '@next', 'swc-win32-x64-msvc');

  console.log(`[repair-swc] baixando ${PKG}@${nextVersion}...`);
  const buf = await fetch(URL);
  console.log(`[repair-swc] recebido ${(buf.length / 1048576).toFixed(1)} MB`);

  const tar = zlib.gunzipSync(buf);
  const entries = parseTar(tar);

  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });

  let nodeBinarySize = 0;
  for (const entry of entries) {
    if (!entry.name) continue;
    const rel = entry.name.replace(/^package\//, '');
    if (!rel) continue;
    const outPath = path.join(dest, rel);

    if (entry.typeFlag === '5' || entry.name.endsWith('/')) {
      fs.mkdirSync(outPath, { recursive: true });
      continue;
    }
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, entry.data);
    if (rel.endsWith('.node')) nodeBinarySize = entry.data.length;
  }

  const binPath = path.join(dest, 'next-swc.win32-x64-msvc.node');
  if (!fs.existsSync(binPath)) {
    throw new Error('binário .node não encontrado após a extração');
  }

  const size = fs.statSync(binPath).size;
  console.log(`[repair-swc] binário restaurado: ${(size / 1048576).toFixed(1)} MB`);
  console.log(`[repair-swc] concluído (${nodeBinarySize} bytes escritos).`);
}

main().catch((err) => {
  console.error('[repair-swc] erro:', err.message);
  process.exit(1);
});
