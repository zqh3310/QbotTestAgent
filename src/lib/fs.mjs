import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

export function readJsonFile(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function writeJsonFile(file, data) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

export function writeTextFile(file, text) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, text, 'utf8');
}

export function exists(file) {
  return fs.existsSync(file);
}

export function hashText(text) {
  return createHash('sha256').update(String(text || ''), 'utf8').digest('hex').slice(0, 16);
}

export function normalizeText(text) {
  return String(text || '').replace(/\r/g, '').trim();
}

export function slugify(text) {
  return String(text || 'item')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'item';
}

export function timestampForPath(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

export function toCsvValue(value) {
  const text = Array.isArray(value) ? value.join('; ') : value == null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export function writeCsv(file, rows, columns) {
  const lines = [columns.join(',')];
  for (const row of rows) {
    lines.push(columns.map((column) => toCsvValue(row[column])).join(','));
  }
  writeTextFile(file, `${lines.join('\n')}\n`);
}

export function listFilesRecursive(root, predicate) {
  if (!fs.existsSync(root)) return [];
  const out = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const file = path.join(root, entry.name);
    if (entry.isDirectory()) out.push(...listFilesRecursive(file, predicate));
    else if (!predicate || predicate(file)) out.push(file);
  }
  return out;
}

export function parseArgs(argv) {
  const args = [...argv];
  const command = args.shift() || 'run';
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    if (key.startsWith('no-')) {
      options[key.slice(3)] = false;
      continue;
    }
    const next = args[index + 1];
    if (!next || next.startsWith('--')) {
      options[key] = true;
    } else {
      options[key] = next;
      index += 1;
    }
  }
  return { command, options };
}

