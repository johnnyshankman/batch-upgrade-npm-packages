#!/usr/bin/env node
import { readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const cliPath = resolve(here, '../dist/bin/cli.js');
const SHEBANG = '#!/usr/bin/env node\n';

const contents = readFileSync(cliPath, 'utf8');
if (!contents.startsWith('#!')) {
  writeFileSync(cliPath, SHEBANG + contents, 'utf8');
}
chmodSync(cliPath, 0o755);
