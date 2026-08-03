#!/usr/bin/env node
import path from 'node:path';
import process from 'node:process';
import { createCoreBetaFixtureController } from '../src/lib/core-beta-fixture-controller.mjs';

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`);
    const name = token.slice(2);
    if (name === 'help') {
      options.help = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for --${name}`);
    options[name] = value;
    index += 1;
  }
  return options;
}

function usage() {
  return `Core Beta fixture controller

Usage:
  npm run core-beta:fixture-controller -- \\
    --providers <provider-manifest.json> \\
    --work-dir <runtime-directory> \\
    [--host 127.0.0.1] [--port 58432]

The controller only listens on loopback. A Case is declared ready only after
its executable provider returns an exact contract/action/evidence/oracle
acknowledgement. Missing providers, failed probes, stale leases and incomplete
driver responses fail closed. The controller never fabricates test evidence.
`;
}

const options = parseArgs(process.argv.slice(2));
if (options.help) {
  process.stdout.write(usage());
  process.exit(0);
}
if (!options.providers) throw new Error('Missing --providers');
if (!options['work-dir']) throw new Error('Missing --work-dir');

const controller = createCoreBetaFixtureController({
  providerManifest: path.resolve(options.providers),
  workDir: path.resolve(options['work-dir']),
});
const address = await controller.listen({
  host: options.host || '127.0.0.1',
  port: Number(options.port || 58432),
});
process.stdout.write(`${JSON.stringify({
  ok: true,
  schema_version: 'qbot-core-beta-fixture-controller-start/v1',
  url: `http://${address.host}:${address.port}`,
  provider_manifest_sha256: controller.manifest.sha256,
  provider_count: controller.manifest.providers.length,
})}\n`);

let closing = false;
const close = async () => {
  if (closing) return;
  closing = true;
  await controller.close();
  process.exit(0);
};
process.on('SIGINT', close);
process.on('SIGTERM', close);
