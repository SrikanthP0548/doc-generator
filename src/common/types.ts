export type ChangeCategory =
  | 'feature'
  | 'bugfix'
  | 'config'
  | 'refactor'
  | 'docs'
  | 'test'
  | 'other';

export interface CommitInfo {
  sha: string;
  message: string;
  author: string;
  date: string | null;
  category: ChangeCategory;
  // Per-commit changed files, module-tagged. Populated when code-scanner
  // runs with commit-file attribution enabled (the default); omitted when
  // run with --no-commit-files, in which case module<->commit attribution
  // cannot be made precisely downstream.
  files?: ChangedFile[];
}

export interface ChangedFile {
  path: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  module: string;
  previousPath?: string;
}

export interface ModuleSummary {
  module: string;
  fileCount: number;
  additions: number;
  deletions: number;
}

export interface CodeScanResult {
  repo: string;
  baseRef: string;
  headRef: string;
  generatedAt: string;
  commits: CommitInfo[];
  files: ChangedFile[];
  modules: string[];
  moduleSummary: ModuleSummary[];
  truncated: boolean;
}

export interface FeatureScenario {
  name: string;
  type: 'Scenario' | 'Scenario Outline';
  line: number;
  tags: string[];
}

export interface FeatureFileTags {
  file: string;
  featureName: string;
  featureTags: string[];
  scenarios: FeatureScenario[];
}

export interface TestScanResult {
  path: string;
  release: string;
  module: string | null;
  generatedAt: string;
  features: FeatureFileTags[];
  summary: {
    featureFileCount: number;
    matchedScenarioCount: number;
    modulesObserved: string[];
  };
}

export interface MappedScenario {
  file: string;
  scenario: string;
  tags: string[];
}

export interface MappingEvidence {
  matchedTag: string;
  filePaths: string[];
  commitShas: string[];
  testScenarios: MappedScenario[];
}

export interface MappingEntry {
  module: string;
  confidence: number;
  evidence: MappingEvidence;
}

export type MappingGapType = 'untested-change' | 'orphan-test';

export interface MappingGap {
  type: MappingGapType;
  module: string;
  detail: string;
}

export interface MappingResult {
  releaseVersion: string;
  generatedAt: string;
  commitFileAttributionAvailable: boolean;
  mappings: MappingEntry[];
  gaps: MappingGap[];
}
