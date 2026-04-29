import { readFile, writeFile } from 'node:fs/promises';

const target = new URL('../src/generated/api.ts', import.meta.url);
const source = await readFile(target, 'utf8');
const normalized = source
  .split('\n')
  .map((line) => line.replace(/[ \t]+$/u, ''))
  .join('\n');

if (normalized !== source) {
  await writeFile(target, normalized);
}
