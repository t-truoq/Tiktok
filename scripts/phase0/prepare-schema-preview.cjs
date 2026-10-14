// truonglt offline schema preview start
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const prisma = path.join(root, 'node_modules/prisma/build/index.js');
const schema = 'docs/phase2/schema.prisma';
const config = 'apps/api/prisma.config.ts';
execFileSync(process.execPath, [prisma, 'validate', '--config', config, '--schema', schema], { cwd: root, stdio: 'inherit' });
// Both diff endpoints are offline. Do not replace either with --*-config-datasource.
const generated = execFileSync(process.execPath, [prisma, 'migrate', 'diff', '--from-empty',
  '--to-schema', schema, '--script', '--config', config], { cwd: root, encoding: 'utf8' });
const constraints = fs.readFileSync(path.join(root, 'docs/phase2/constraints-preview.sql'), 'utf8');
const output = '-- truonglt phase2 offline migration preview start\n' +
  '-- REVIEW ARTIFACT ONLY: not in active Prisma migrations; not applied to any database.\n' +
  generated + '\n' + constraints + '\n-- truonglt phase2 offline migration preview end\n';
fs.writeFileSync(path.join(root, 'docs/phase2/migration-preview.sql'), output);
console.log('Offline schema validation and SQL preview generated; zero database calls/migration execution.');
// truonglt offline schema preview end
