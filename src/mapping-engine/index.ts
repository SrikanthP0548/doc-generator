#!/usr/bin/env node
import { Command } from 'commander';
import { readFileSync, writeFileSync } from 'node:fs';
import { buildMapping } from './mapping';
import { CodeScanResult, TestScanResult } from '../common/types';

interface Options {
  code: string;
  tests: string;
  release?: string;
  modules?: string;
  out?: string;
  gapsOut?: string;
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

const program = new Command();

program
  .name('mapping-engine')
  .description('Combines code-scanner and test-scanner JSON into a deterministic module<->test mapping with evidence, confidence scores, and gaps')
  .requiredOption('--code <file>', 'code-scanner JSON output file')
  .requiredOption('--tests <file>', 'test-scanner JSON output file')
  .option('--release <version>', 'release version label for the output; defaults to the tests file\'s "release" field')
  .option(
    '--modules <list>',
    'comma-separated known module vocabulary (e.g. from the UI\'s Module dropdown source); ' +
      'without it, a module with test coverage but zero code changes this release cannot be flagged as an orphan-test gap',
  )
  .option('--out <file>', 'write mapping JSON to a file instead of stdout')
  .option('--gaps-out <file>', 'also write the gaps list to a separate file')
  .action((options: Options) => {
    try {
      const code = readJson<CodeScanResult>(options.code);
      const tests = readJson<TestScanResult>(options.tests);
      const releaseVersion = options.release ?? tests.release;

      if (tests.release !== releaseVersion) {
        console.error(
          `Warning: --release "${releaseVersion}" does not match test-scanner's release "${tests.release}"`,
        );
      }

      const knownModules = options.modules
        ? options.modules.split(',').map((m) => m.trim()).filter(Boolean)
        : [];
      const result = buildMapping(code, tests, releaseVersion, knownModules);

      const json = JSON.stringify(result, null, 2);
      if (options.out) {
        writeFileSync(options.out, json);
        console.error(`Wrote ${options.out}`);
      } else {
        console.log(json);
      }

      if (options.gapsOut) {
        writeFileSync(options.gapsOut, JSON.stringify(result.gaps, null, 2));
        console.error(`Wrote ${options.gapsOut}`);
      }
    } catch (err) {
      console.error('mapping-engine failed:', err instanceof Error ? err.message : err);
      process.exitCode = 1;
    }
  });

program.parse();
