/**
 * repair-packages.js
 * ---------------------------------------------------------------------------
 * Alguns pacotes ficam incompletos no `npm install` desta máquina (o caminho do
 * perfil contém espaços e acento, o quebra scripts de ciclo de vida).
 * Este script verifica cada dependência direta e, se faltar o package.json,
 * baixa o .tgz do registro e extrai manualmente.
 *
 * Uso: node scripts/repair-packages.js
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const https = require('https');
const os = require('os');

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const deps = { ...pkg.dependencies, ...pkg.devDependencies };

/** Lê entradas de um tar em buffer (ustar POSIX). */
function parseTar(buf) {
  const entries = [];
  let offset = 0;
  while (offset + 512 <= buf.length) {
    const header = buf.subarray(offset, offset + 512);
    if (header.every((b) => b === 0)) break;

    const rawName = header.subarray(0, 100).toString('utf8').replace(/\0.*$/, '');
    const rawPrefix = header.subarray(345, 500).toString('utf8').replace(/\0.*$/, '');
    const name = rawPrefix ? `${rawPrefix}/${rawName}` : rawName;
    const size = parseInt(
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
          return reject(new Error(`HTTP ${res.statusCode} para ${url}`));
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      })
      .on('error', reject);
  });
}

function extract(tgzBuffer, destDir) {
  const tar = zlib.gunzipSync(tgzBuffer);
  const entries = parseTar(tar);
  let count = 0;
  for (const entry of entries) {
    if (!entry.name) continue;
    const rel = entry.name.replace(/^package\//, '');
    if (!rel) continue;
    const outPath = path.join(destDir, rel);
    if (entry.typeFlag === '5' || entry.name.endsWith('/')) {
      fs.mkdirSync(outPath, { recursive: true });
      continue;
    }
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, entry.data);
    count++;
  }
  return count;
}

async function main() {
  const broken = [];

  for (const name of Object.keys(deps)) {
    const dir = path.join(root, 'node_modules', name);
    const hasPkg = fs.existsSync(path.join(dir, 'package.json'));
    if (!hasPkg) broken.push(name);
  }

  if (broken.length === 0) {
    console.log('[repair] todas as dependências estão íntegras.');
    return;
  }

  console.log('[repair] pacotes incompletos: %s', broken.join(', '));

  for (const name of broken) {
    const range = deps[name];
    try {
      // Resolve a versão exata publicada.
      const meta = JSON.parse(
        (await fetch(`https://registry.npmjs.org/${name}`)).toString('utf8'),
      );
      const wanted = range.replace(/^[\^~]/, '');
      const version =
        meta.versions[wanted] !== undefined
          ? wanted
          : meta['dist-tags'].latest;

      const tarball =
        meta.versions[version].dist.tarball;
      console.log(`[repair] baixando ${name}@${version}...`);
      const buf = await fetch(tarball);

      const dir = path.join(root, 'node_modules', name);
      fs.rmSync(dir, { recursive: true, force: true });
      const n = extract(buf, dir);
      console.log(`[repair] ${name}@${version} restaurado (${n} arquivos).`);
    } catch (err) {
      console.error(`[repair] falha ao restaurar ${name}: ${err.message}`);
    }
  }

  console.log('[repair] concluído.');
}

main();
