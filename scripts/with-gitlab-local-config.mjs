#!/usr/bin/env node
import { runWithLocalGitLabConfig } from '../src/lib/gitlab-local-config.mjs';

try {
  const [command, ...args] = process.argv.slice(2);
  if (!command || command === '--help') {
    process.stdout.write('Usage: npm run gitlab:local -- <scan|observe|orchestrate> [command options]\nReads config/gitlab.local.json privately and supplies the token through child stdin.\n');
  } else {
    const result = runWithLocalGitLabConfig(command, args);
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
    process.exitCode = result.status;
  }
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
