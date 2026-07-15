#!/usr/bin/env node
import { Command } from 'commander';
import { writeFileSync } from 'node:fs';
import { runTestScanner } from './run';

interface CliOptions {
  path: string;
  release: string;
  module?: string;
  out?: string;
}

const program = new Command();

program
  .name('test-scanner')
  .description('Scans .feature files under a checked-out automation repo for release/module tags and outputs matching scenarios as JSON')
  .requiredOption('--path <dir>', 'directory to scan (a checked-out automation repo, or a subdirectory of it)')
  .requiredOption('--release <version>', 'release tag to match, e.g. "26.1" (matches scenarios tagged @26.1) — supplied by the UI, not hardcoded')
  .option('--module <module>', 'module tag to match, e.g. "Payments"; omit or pass "All" for all modules — supplied by the UI, not hardcoded')
  .option('--out <file>', 'write JSON to a file instead of stdout')
  .action((options: CliOptions) => {
    try {
      const result = runTestScanner(options);
      const json = JSON.stringify(result, null, 2);
      if (options.out) {
        writeFileSync(options.out, json);
        console.error(`Wrote ${options.out}`);
      } else {
        console.log(json);
      }
    } catch (err) {
      console.error('test-scanner failed:', err instanceof Error ? err.message : err);
      process.exitCode = 1;
    }
  });

program.parse();
