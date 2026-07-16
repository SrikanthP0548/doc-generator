import { FeatureFileTags, FeatureScenario } from '../common/types';

const TAG_LINE = /^@\S+(\s+@\S+)*$/;
const TAG_TOKEN = /@\S+/g;
const STEP_LINE = /^(Given|When|Then|And|But|\*)\s+.+$/;

function extractTags(line: string): string[] {
  return line.trim().match(TAG_TOKEN) ?? [];
}

// Parses a single .feature file's text into its feature-level tags and
// each scenario's effective tags (feature tags + scenario's own tags),
// following Gherkin's tag inheritance: a scenario/scenario outline
// inherits every tag declared above the Feature: line, plus any tags
// declared directly above it.
export function parseFeatureFile(file: string, content: string): FeatureFileTags {
  const lines = content.split(/\r?\n/);

  let featureTags: string[] = [];
  let featureName = '';
  let pendingTags: string[] = [];
  const scenarios: FeatureScenario[] = [];
  let sawFeatureLine = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();

    if (!trimmed || trimmed.startsWith('#')) continue;

    if (TAG_LINE.test(trimmed)) {
      pendingTags.push(...extractTags(trimmed));
      continue;
    }

    const featureMatch = trimmed.match(/^Feature:\s*(.*)$/);
    if (featureMatch && !sawFeatureLine) {
      featureTags = pendingTags;
      featureName = featureMatch[1].trim();
      pendingTags = [];
      sawFeatureLine = true;
      continue;
    }

    const scenarioMatch = trimmed.match(/^(Scenario Outline|Scenario):\s*(.*)$/);
    if (scenarioMatch) {
      const type = scenarioMatch[1] as 'Scenario' | 'Scenario Outline';
      const name = scenarioMatch[2].trim();
      const ownTags = pendingTags;
      pendingTags = [];
      scenarios.push({
        name,
        type,
        line: i + 1,
        tags: dedupe([...featureTags, ...ownTags]),
        steps: [],
      });
      continue;
    }

    // Step lines (Given/When/Then/And/But/*) attach to whichever scenario
    // was most recently opened — this only captures steps written
    // directly under the scenario, not ones inherited from a Background:
    // block above it.
    if (STEP_LINE.test(trimmed) && scenarios.length > 0) {
      scenarios[scenarios.length - 1].steps.push(trimmed);
      continue;
    }

    // Any other content (Background:, Examples: tables, docstrings) does
    // not consume pending tags; a stray tag block followed by such a line
    // is left dangling and is dropped at the next Scenario/EOF.
  }

  return { file, featureName, featureTags, scenarios };
}

function dedupe(tags: string[]): string[] {
  return [...new Set(tags)];
}
