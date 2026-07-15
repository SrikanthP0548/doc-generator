import { DraftDocument, ReleaseFacts } from '../common/types';
import { LlmClient } from './llmClient';

// Deterministic stand-in for the real LLM call — renders a structured
// draft directly from the facts with no network call, so the pipeline is
// runnable end to end before an LLM provider is wired up. Used when
// LLM_PROVIDER is unset or "dummy" (the default).
export class DummyLlmClient implements LlmClient {
  async draftStructured(facts: ReleaseFacts): Promise<DraftDocument> {
    const moduleLabel = facts.module === 'All' ? 'All Modules' : facts.module;
    const totalFiles = facts.moduleFacts.reduce((sum, m) => sum + m.fileCount, 0);
    const totalScenarios = facts.moduleFacts.reduce((sum, m) => sum + m.scenarioCount, 0);

    const title = `Release ${facts.releaseVersion} — ${moduleLabel}`;
    const summary =
      `This release (${facts.releaseVersion}) touched ${facts.moduleFacts.length} module(s) across ` +
      `${totalFiles} file(s) in ${facts.repo}, diffed between \`${facts.baseRef}\` and \`${facts.headRef}\`, ` +
      `covered by ${totalScenarios} automated scenario(s). ${facts.gaps.length} coverage gap(s) were flagged for review.`;

    const moduleSections = facts.moduleFacts.map((m) => ({
      module: m.module,
      narrative:
        `${m.module} changed across ${m.fileCount} file(s) via ${m.commitCount} commit(s) ` +
        `(${m.changeCategories.join(', ') || 'uncategorized'}), covered by ${m.scenarioCount} automated scenario(s). ` +
        `Mapping confidence: ${Math.round(m.confidence * 100)}%.`,
      highlights: m.filePaths.slice(0, 5),
    }));

    const gapsNarrative = facts.gaps.length
      ? facts.gaps.map((g) => `- **${g.type}** (${g.module}): ${g.detail}`).join('\n')
      : 'No coverage gaps were flagged for this release/module.';

    return { title, summary, moduleSections, gapsNarrative };
  }
}
