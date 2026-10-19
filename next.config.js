/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  output: 'standalone',
  reactStrictMode: true,
  experimental: {
    // O banco é o sql.js (SQLite em WebAssembly), que depende de APIs de Node
    // (`fs`, `process.cwd`). Precisa ficar FORA do bundle de Server Components/
    // Server Actions — do contrário ele é compilado para o browser e quebra
    // com "Cannot set properties of undefined (setting 'exports')".
    serverComponentsExternalPackages: ['sql.js'],
  },
  eslint: { ignoreDuringBuilds: true },
  webpack: (config, { dev }) => {
    if (dev) {
      // O banco SQLite local (`data/delivery_os.db`) é reescrito a cada operação
      // do sql.js. Sem ignorá-lo, cada escrita dispara o watcher do Next dev e
      // provoca um rebuild/HMR — deixando as atualizações lentas ou travadas.
      // O `.gitignore` não influencia o watcher: precisa ser excluído aqui.
      config.watchOptions = {
        ...(config.watchOptions || {}),
        ignored: ['**/node_modules/**', '**/.next/**', '**/data/**', '**/db/**'],
      };
    }
    return config;
  },
};

module.exports = nextConfig;
