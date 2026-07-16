#!/usr/bin/env node
import 'dotenv/config';
import { Command } from 'commander';
import { writeFileSync } from 'node:fs';
import { runCodeScanner } from './run';

interface CliOptions {
  repo: string;
  base: string;
  head: string;
  token?: string;
  out?: string;
  commitFiles: boolean;
}

const program = new Command();

program
  .name('code-scanner')
  .description('Diffs two refs on a GitHub repo and outputs classified commits + module-tagged changed files as JSON')
  .requiredOption('--repo <owner/name>', 'GitHub repo, e.g. nvm-sh/nvm')
  .requiredOption('--base <ref>', 'base ref — a tag or branch name (or SHA); the "previous" side of the diff')
  .requiredOption('--head <ref>', 'head ref — a tag or branch name (or SHA); the "current" side of the diff')
  .option('--token <token>', 'GitHub token (defaults to $GITHUB_TOKEN); unauthenticated works for public repos at a lower rate limit')
  .option('--out <file>', 'write JSON to a file instead of stdout')
  .option(
    '--no-commit-files',
    'skip fetching each commit\'s changed-file list (one extra API call per commit); faster, but downstream mapping evidence loses commit<->module attribution',
  )
  .action(async (options: CliOptions) => {
    try {
      const result = await runCodeScanner(options);
      const json = JSON.stringify(result, null, 2);
      if (options.out) {
        writeFileSync(options.out, json);
        console.error(`Wrote ${options.out}`);
      } else {
        console.log(json);
      }
    } catch (err) {
      console.error('code-scanner failed:', err instanceof Error ? err.message : err);
      process.exitCode = 1;
    }
  });

program.parse();
