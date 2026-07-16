import { CodeScanResult, MappingResult, ModuleFacts, ReleaseFacts } from '../common/types';

export function buildReleaseFacts(
  mapping: MappingResult,
  code: CodeScanResult,
  module: string,
): ReleaseFacts {
  const commitBySha = new Map(code.commits.map((c) => [c.sha, c]));
  const moduleFilter = module.toLowerCase() === 'all' ? null : module;

  const relevantMappings = moduleFilter
    ? mapping.mappings.filter((m) => m.module.toLowerCase() === moduleFilter.toLowerCase())
    : mapping.mappings;
  const relevantGaps = moduleFilter
    ? mapping.gaps.filter((g) => g.module.toLowerCase() === moduleFilter.toLowerCase())
    : mapping.gaps;

  const moduleFacts: ModuleFacts[] = relevantMappings.map((m) => {
    // Resolve each evidence SHA back to its full commit — message text is
    // what actually lets the drafting step describe *what* changed, not
    // just how many commits touched how many files.
    const commits = m.evidence.commitShas
      .map((sha) => commitBySha.get(sha))
      .filter((c): c is NonNullable<typeof c> => c !== undefined)
      .map((c) => ({ sha: c.sha, message: c.message, category: c.category }));

    const changeCategories = [...new Set(commits.map((c) => c.category))];

    return {
      module: m.module,
      confidence: m.confidence,
      changeCategories,
      fileCount: m.evidence.filePaths.length,
      commitCount: m.evidence.commitShas.length,
      scenarioCount: m.evidence.testScenarios.length,
      filePaths: m.evidence.filePaths,
      commits,
      testScenarios: m.evidence.testScenarios,
    };
  });

  return {
    releaseVersion: mapping.releaseVersion,
    module,
    repo: code.repo,
    baseRef: code.baseRef,
    headRef: code.headRef,
    moduleFacts,
    gaps: relevantGaps,
  };
}
