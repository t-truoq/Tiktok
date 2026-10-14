// truonglt phase1 prisma config start
import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';
import { resolve } from 'node:path';

config({ path: resolve(__dirname, '.env'), quiet: true });

export default defineConfig({
  schema: resolve(__dirname, 'prisma/schema.prisma'),
  migrations: { path: resolve(__dirname, 'prisma/migrations') },
  datasource: {
    // Offline validate/generate needs a syntactic URL; this unreachable fallback is not DEV.
    url: process.env.DIRECT_URL || 'postgresql://unused:unused@127.0.0.1:1/NOT_CONFIGURED?sslmode=verify-full',
  },
});
// truonglt phase1 prisma config end
