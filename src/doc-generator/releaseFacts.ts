import { CodeScanResult, MappingResult, ModuleFacts, ReleaseFacts } from '../common/types';

export function buildReleaseFacts(
  mapping: MappingResult,
  code: CodeScanResult,
  module: string,
): ReleaseFacts {
  const commitCategoryBySha = new Map(code.commits.map((c) => [c.sha, c.category]));
  const moduleFilter = module.toLowerCase() === 'all' ? null : module;

  const relevantMappings = moduleFilter
    ? mapping.mappings.filter((m) => m.module.toLowerCase() === moduleFilter.toLowerCase())
    : mapping.mappings;
  const relevantGaps = moduleFilter
    ? mapping.gaps.filter((g) => g.module.toLowerCase() === moduleFilter.toLowerCase())
    : mapping.gaps;

  const moduleFacts: ModuleFacts[] = relevantMappings.map((m) => {
    const changeCategories = [
      ...new Set(
        m.evidence.commitShas
          .map((sha) => commitCategoryBySha.get(sha))
          .filter((c): c is NonNullable<typeof c> => c !== undefined),
      ),
    ];

    return {
      module: m.module,
      confidence: m.confidence,
      changeCategories,
      fileCount: m.evidence.filePaths.length,
      commitCount: m.evidence.commitShas.length,
      scenarioCount: m.evidence.testScenarios.length,
      filePaths: m.evidence.filePaths,
      commitShas: m.evidence.commitShas,
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
