/**
 * Extrai um pacote .tgz do npm diretamente para node_modules.
 * Usado como plano B quando o npm não consegue completar a instalação
 * (caminhos com espaços/acentos no Windows quebram alguns scripts).
 *
 * Uso: node scripts/extract-tgz.js <arquivo.tgz> <destino>
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const [, , tgzPath, destDir] = process.argv;
if (!tgzPath || !destDir) {
  console.error('uso: node scripts/extract-tgz.js <arquivo.tgz> <destino>');
  process.exit(1);
}

/** Lê entradas de um tar em buffer (formato ustar POSIX). */
function parseTar(buf) {
  const entries = [];
  let offset = 0;

  while (offset + 512 <= buf.length) {
    const header = buf.subarray(offset, offset + 512);

    // Bloco de fim: tudo zerado.
    if (header.every((b) => b === 0)) break;

    const rawName = header.subarray(0, 100).toString('utf8').replace(/\0.*$/, '');
    const rawPrefix = header.subarray(345, 500).toString('utf8').replace(/\0.*$/, '');
    const name = rawPrefix ? `${rawPrefix}/${rawName}` : rawName;

    const sizeStr = header.subarray(124, 136).toString('utf8').replace(/\0.*$/, '').trim();
    const size = parseInt(sizeStr, 8) || 0;
    const typeFlag = String.fromCharCode(header[156]);

    const dataStart = offset + 512;
    const data = buf.subarray(dataStart, dataStart + size);

    entries.push({ name, size, typeFlag, data });
    offset = dataStart + Math.ceil(size / 512) * 512;
  }
  return entries;
}

const gz = fs.readFileSync(tgzPath);
const tar = zlib.gunzipSync(gz);
const entries = parseTar(tar);

let fileCount = 0;
for (const entry of entries) {
  if (!entry.name) continue;
  // Remove o diretório "package/" que todo pacote npm possui na raiz.
  const rel = entry.name.replace(/^package\//, '');
  if (!rel) continue;

  const outPath = path.join(destDir, rel);

  if (entry.typeFlag === '5' || entry.name.endsWith('/')) {
    fs.mkdirSync(outPath, { recursive: true });
    continue;
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, entry.data);
  fileCount++;
}

console.log(`[extract-tgz] ${fileCount} arquivo(s) extraído(s) para ${destDir}`);
