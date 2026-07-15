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
