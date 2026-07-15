#!/usr/bin/env node
import { Command } from 'commander';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseFeatureFile } from './parseFeatureTags';
import { FeatureFileTags, TestScanResult } from '../common/types';

interface Options {
  path: string;
  release: string;
  module?: string;
  out?: string;
}

function findFeatureFiles(root: string): string[] {
  const results: string[] = [];

  function walk(dir: string): void {
    for (const entry of readdirSync(dir)) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (entry.endsWith('.feature')) {
        results.push(fullPath);
      }
    }
  }

  walk(root);
  return results;
}

function tagMatches(tags: string[], value: string): boolean {
  const target = `@${value}`.toLowerCase();
  return tags.some((t) => t.toLowerCase() === target);
}

function run(options: Options): TestScanResult {
  const moduleFilter = options.module && options.module.toLowerCase() !== 'all' ? options.module : null;

  const files = findFeatureFiles(options.path);
  const features: FeatureFileTags[] = [];
  const modulesObserved = new Set<string>();
  let matchedScenarioCount = 0;

  for (const filePath of files) {
    const content = readFileSync(filePath, 'utf8');
    const parsed = parseFeatureFile(filePath, content);

    const matchingScenarios = parsed.scenarios.filter((scenario) => {
      if (!tagMatches(scenario.tags, options.release)) return false;
      if (moduleFilter && !tagMatches(scenario.tags, moduleFilter)) return false;
      return true;
    });

    for (const scenario of parsed.scenarios) {
      for (const tag of scenario.tags) {
        if (!/^@\d/.test(tag)) modulesObserved.add(tag.slice(1));
      }
    }

    if (matchingScenarios.length > 0) {
      features.push({ ...parsed, scenarios: matchingScenarios });
      matchedScenarioCount += matchingScenarios.length;
    }
  }

  return {
    path: options.path,
    release: options.release,
    module: moduleFilter,
    generatedAt: new Date().toISOString(),
    features,
    summary: {
      featureFileCount: files.length,
      matchedScenarioCount,
      modulesObserved: [...modulesObserved].sort(),
    },
  };
}

const program = new Command();

program
  .name('test-scanner')
  .description('Scans .feature files under a checked-out automation repo for release/module tags and outputs matching scenarios as JSON')
  .requiredOption('--path <dir>', 'directory to scan (a checked-out automation repo, or a subdirectory of it)')
  .requiredOption('--release <version>', 'release tag to match, e.g. "26.1" (matches scenarios tagged @26.1) — supplied by the UI, not hardcoded')
  .option('--module <module>', 'module tag to match, e.g. "Payments"; omit or pass "All" for all modules — supplied by the UI, not hardcoded')
  .option('--out <file>', 'write JSON to a file instead of stdout')
  .action((options: Options) => {
    try {
      const result = run(options);
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
