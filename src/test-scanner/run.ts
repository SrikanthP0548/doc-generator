import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parseFeatureFile } from './parseFeatureTags';
import { FeatureFileTags, TestScanResult } from '../common/types';

export interface TestScannerOptions {
  path: string;
  release: string;
  module?: string;
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

export function runTestScanner(options: TestScannerOptions): TestScanResult {
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
