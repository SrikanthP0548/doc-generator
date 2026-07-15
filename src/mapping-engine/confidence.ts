import { ChangeCategory } from '../common/types';

const FUNCTIONAL_CATEGORIES: ReadonlySet<ChangeCategory> = new Set(['feature', 'bugfix']);

export interface ConfidenceInput {
  exactCaseMatch: boolean;
  scenarioCount: number;
  commitCategories: ChangeCategory[];
}

// Deterministic confidence score in [0, 1] from concrete match metadata —
// no fuzzy/semantic matching, only signals directly present in the scan
// data: whether the module tag matched case-exactly, how much test
// evidence covers it, and whether the code change is functional in nature.
export function scoreConfidence(input: ConfidenceInput): number {
  let score = 0.5; // base: module + release match found at all

  if (input.exactCaseMatch) score += 0.15;
  score += Math.min(0.2, input.scenarioCount * 0.05);
  if (input.commitCategories.some((c) => FUNCTIONAL_CATEGORIES.has(c))) score += 0.1;

  return Math.min(1, Math.round(score * 100) / 100);
}
