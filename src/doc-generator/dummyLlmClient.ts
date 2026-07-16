import { DraftDocument, ReleaseFacts } from '../common/types';
import { LlmClient } from './llmClient';

// Deterministic stand-in for the real LLM call — renders a structured
// draft directly from the facts with no network call, so the pipeline is
// runnable end to end before an LLM provider is wired up. Used when
// LLM_PROVIDER is unset or "dummy" (the default).
//
// It's still a template, not a real narrative writer — it surfaces the
// actual commit messages and test-step text verbatim rather than
// synthesizing prose from them, since that synthesis is exactly the job
// the real LLM client is meant to do. This is meant to be a legible,
// honest placeholder, not a fake LLM.
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

    const moduleSections = facts.moduleFacts.map((m) => {
      const changesList = m.commits.length
        ? m.commits.map((c) => `- ${c.message.split('\n')[0]} (${c.category})`).join('\n')
        : '- (no commit messages available)';

      const coverageList = m.testScenarios.length
        ? m.testScenarios
            .map((s) => {
              const steps = s.steps.length ? `\n  ${s.steps.join('\n  ')}` : '';
              return `- ${s.scenario}${steps}`;
            })
            .join('\n')
        : '- (no matching scenarios)';

      const narrative =
        `${m.module} changed across ${m.fileCount} file(s) via ${m.commitCount} commit(s), ` +
        `covered by ${m.scenarioCount} automated scenario(s). Mapping confidence: ${Math.round(m.confidence * 100)}%.\n\n` +
        `Changes:\n${changesList}\n\n` +
        `Test coverage:\n${coverageList}`;

      return {
        module: m.module,
        narrative,
        highlights: m.filePaths.slice(0, 5),
      };
    });

    const gapsNarrative = facts.gaps.length
      ? facts.gaps.map((g) => `- **${g.type}** (${g.module}): ${g.detail}`).join('\n')
      : 'No coverage gaps were flagged for this release/module.';

    return { title, summary, moduleSections, gapsNarrative };
  }
}
