import {
  ChangeCategory,
  ChangedFile,
  CodeScanResult,
  MappedScenario,
  MappingEntry,
  MappingGap,
  MappingResult,
  TestScanResult,
} from '../common/types';
import { scoreConfidence } from './confidence';

function addToSetMap<K, V>(map: Map<K, Set<V>>, key: K, value: V): void {
  const set = map.get(key) ?? new Set<V>();
  set.add(value);
  map.set(key, set);
}

interface ScenarioMatch extends MappedScenario {
  matchedTag: string;
}

export function buildMapping(
  code: CodeScanResult,
  tests: TestScanResult,
  releaseVersion: string,
  knownModules: string[] = [],
  selectedModule?: string,
): MappingResult {
  const commitFileAttributionAvailable = code.commits.some((c) => c.files && c.files.length > 0);

  // If a module is pre-selected (via --module CLI flag), all code changes are
  // treated as part of that module, and all tests (which are already filtered
  // by test-scanner) are automatically mapped to that module.
  if (selectedModule) {
    const allScenarios: ScenarioMatch[] = [];
    for (const feature of tests.features) {
      for (const scenario of feature.scenarios) {
        allScenarios.push({
          file: feature.file,
          scenario: scenario.name,
          tags: scenario.tags,
          steps: scenario.steps,
          matchedTag: `@${selectedModule}`,
        });
      }
    }

    const mappings: MappingEntry[] = [];
    const gaps: MappingGap[] = [];

    if (code.files.length > 0 && allScenarios.length > 0) {
      // Both code changes and tests exist — create a mapping
      const exactCaseMatch = allScenarios.some((s) => s.tags.some((t) => t.slice(1) === selectedModule));
      const confidence = scoreConfidence({
        exactCaseMatch,
        scenarioCount: allScenarios.length,
        commitCategories: [...code.commits.map((c) => c.category)],
      });

      const commitShas = new Set<string>();
      for (const commit of code.commits) {
        commitShas.add(commit.sha);
      }

      mappings.push({
        module: selectedModule,
        confidence,
        evidence: {
          matchedTag: `@${selectedModule}`,
          filePaths: code.files.map((f) => f.path),
          commitShas: [...commitShas],
          testScenarios: allScenarios.map((s) => ({ file: s.file, scenario: s.scenario, tags: s.tags, steps: s.steps })),
        },
      });
    } else if (code.files.length === 0 && allScenarios.length > 0) {
      // Tests exist but no code changes
      gaps.push({
        type: 'orphan-test',
        module: selectedModule,
        detail: `${allScenarios.length} scenario(s) found but no code changes in this release`,
      });
    } else if (code.files.length > 0 && allScenarios.length === 0) {
      // Code changes exist but no tests
      gaps.push({
        type: 'untested-change',
        module: selectedModule,
        detail: `${code.files.length} file(s) changed but no matching test scenarios were found`,
      });
    }

    return {
      releaseVersion,
      generatedAt: new Date().toISOString(),
      commitFileAttributionAvailable,
      mappings,
      gaps,
    };
  }

  // Standard module matching: match tests and code by module name

  // module -> commit SHAs / categories, attributed via each commit's own
  // changed-file list when available (precise); when code-scanner ran
  // with --no-commit-files, every commit in range is associated with
  // every touched module as a best-effort fallback.
  const moduleToCommits = new Map<string, Set<string>>();
  const moduleToCategories = new Map<string, Set<ChangeCategory>>();

  if (commitFileAttributionAvailable) {
    for (const commit of code.commits) {
      for (const file of commit.files ?? []) {
        addToSetMap(moduleToCommits, file.module, commit.sha);
        addToSetMap(moduleToCategories, file.module, commit.category);
      }
    }
  } else {
    for (const commit of code.commits) {
      for (const module of code.modules) {
        addToSetMap(moduleToCommits, module, commit.sha);
        addToSetMap(moduleToCategories, module, commit.category);
      }
    }
  }

  const moduleToFiles = new Map<string, ChangedFile[]>();
  for (const file of code.files) {
    const list = moduleToFiles.get(file.module) ?? [];
    list.push(file);
    moduleToFiles.set(file.module, list);
  }

  // A scenario tag counts as a module match only if it names a module we
  // otherwise know about — either one touched by code this release, or one
  // declared via --modules (the app repo's known module vocabulary, e.g.
  // sourced from the same list backing the UI's Module dropdown). Without
  // that declared list, a module with test coverage but zero code changes
  // this release is indistinguishable from an arbitrary non-module tag
  // (@Smoke, @Regression) and can't be flagged as an orphan-test gap.
  const moduleUniverse = new Set([...code.modules, ...knownModules]);

  const moduleToScenarios = new Map<string, ScenarioMatch[]>();
  for (const feature of tests.features) {
    for (const scenario of feature.scenarios) {
      for (const tag of scenario.tags) {
        const tagName = tag.slice(1);
        const module = [...moduleUniverse].find((m) => m.toLowerCase() === tagName.toLowerCase());
        if (!module) continue;

        const list = moduleToScenarios.get(module) ?? [];
        list.push({
          file: feature.file,
          scenario: scenario.name,
          tags: scenario.tags,
          steps: scenario.steps,
          matchedTag: tag,
        });
        moduleToScenarios.set(module, list);
      }
    }
  }

  const mappings: MappingEntry[] = [];
  const gaps: MappingGap[] = [];

  for (const module of moduleUniverse) {
    const scenarios = moduleToScenarios.get(module) ?? [];
    const files = moduleToFiles.get(module) ?? [];

    // Declared module (via --modules) with neither code changes nor test
    // coverage this release — not relevant to this generation, skip.
    if (scenarios.length === 0 && files.length === 0) continue;

    if (files.length === 0) {
      gaps.push({
        type: 'orphan-test',
        module,
        detail: `${scenarios.length} scenario(s) tagged @${module} @${releaseVersion} found but no code changes touched "${module}" in this release`,
      });
      continue;
    }

    if (scenarios.length === 0) {
      gaps.push({
        type: 'untested-change',
        module,
        detail: `${files.length} file(s) changed in "${module}" for ${releaseVersion} but no automation scenario tagged @${module} @${releaseVersion} was found`,
      });
      continue;
    }

    const exactCaseMatch = scenarios.some((s) => s.matchedTag.slice(1) === module);
    const confidence = scoreConfidence({
      exactCaseMatch,
      scenarioCount: scenarios.length,
      commitCategories: [...(moduleToCategories.get(module) ?? [])],
    });

    mappings.push({
      module,
      confidence,
      evidence: {
        matchedTag: `@${module}`,
        filePaths: files.map((f) => f.path),
        commitShas: [...(moduleToCommits.get(module) ?? [])],
        testScenarios: scenarios.map(({ file, scenario, tags, steps }) => ({ file, scenario, tags, steps })),
      },
    });
  }

  mappings.sort((a, b) => a.module.localeCompare(b.module));
  gaps.sort((a, b) => a.module.localeCompare(b.module) || a.type.localeCompare(b.type));

  return {
    releaseVersion,
    generatedAt: new Date().toISOString(),
    commitFileAttributionAvailable,
    mappings,
    gaps,
  };
}
