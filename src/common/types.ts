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
  // Unified diff text for this file, when GitHub returns one — omitted
  // for binary files and files GitHub considers too large to diff.
  patch?: string;
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
  // Given/When/Then/And/But step lines directly under this scenario
  // (not inherited from a Background: block) — the actual behavior being
  // verified, as opposed to just the scenario's title.
  steps: string[];
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
  steps: string[];
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

export interface CommitSummary {
  sha: string;
  message: string;
  category: ChangeCategory;
}

export interface ModuleFacts {
  module: string;
  confidence: number;
  changeCategories: ChangeCategory[];
  fileCount: number;
  commitCount: number;
  scenarioCount: number;
  // Full file objects (status, +/- counts, and a bounded diff patch when
  // available) rather than bare paths — the drafting LLM needs to see
  // what actually changed, not just which files were touched.
  files: ChangedFile[];
  // Full commit message + category per commit, not just SHAs — the
  // drafting LLM needs actual descriptive text to write a narrative
  // beyond "N commits categorized as feature/bugfix".
  commits: CommitSummary[];
  testScenarios: MappedScenario[];
}

export interface ReleaseFacts {
  releaseVersion: string;
  module: string; // "All" or a specific module name
  repo: string;
  baseRef: string;
  headRef: string;
  moduleFacts: ModuleFacts[];
  gaps: MappingGap[];
}

export interface DraftModuleSection {
  module: string;
  narrative: string;
  highlights: string[];
}

export interface DraftDocument {
  title: string;
  summary: string;
  moduleSections: DraftModuleSection[];
  gapsNarrative: string;
}
