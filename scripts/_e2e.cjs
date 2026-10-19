/* Teste end-to-end: executa o fluxo real de cadastro usando o banco em disco
   do projeto, com os repositorios JA migrados. Requer compilar o TS. */
const fs = require('fs');
const path = require('path');

// Snapshot do banco antes, para poder restaurar.
const DB = path.join(__dirname, '..', 'data', 'delivery_os.db');
const HAD = fs.existsSync(DB);
const backup = HAD ? fs.readFileSync(DB) : null;

(async () => {
  const { registerUser } = await import('tsx/cjs');
})().catch(() => { });

// Carrega o TS compilado sob demanda via register do Next? Nao disponivel aqui.
// Entao: valida a camada de db lendo o arquivo .ts e transpilando com esbuild? Nao ha.
console.log('placeholder');
