import { ChangedFile, CodeScanResult, MappingResult, ModuleFacts, ReleaseFacts } from '../common/types';

// Bounds how much diff text reaches the prompt per file — a release can
// touch dozens of files, and unbounded patches would make prompt size
// scale with total diff size rather than release size. GitHub itself
// already omits `patch` for files it considers too large or binary, so
// this only trims the remaining "large but text" case.
const MAX_PATCH_CHARS = 2000;

function boundPatch(file: ChangedFile): ChangedFile {
  if (!file.patch || file.patch.length <= MAX_PATCH_CHARS) return file;
  return { ...file, patch: `${file.patch.slice(0, MAX_PATCH_CHARS)}\n... (truncated)` };
}

export function buildReleaseFacts(
  mapping: MappingResult,
  code: CodeScanResult,
  module: string,
): ReleaseFacts {
  const commitBySha = new Map(code.commits.map((c) => [c.sha, c]));
  const fileByPath = new Map(code.files.map((f) => [f.path, f]));
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

    // Resolve each evidence path back to its full ChangedFile (status,
    // +/- counts, and a bounded diff patch) — a bare path tells the
    // drafting step nothing about what actually changed there.
    const files = m.evidence.filePaths
      .map((path) => fileByPath.get(path))
      .filter((f): f is NonNullable<typeof f> => f !== undefined)
      .map(boundPatch);

    return {
      module: m.module,
      confidence: m.confidence,
      changeCategories,
      fileCount: files.length,
      commitCount: m.evidence.commitShas.length,
      scenarioCount: m.evidence.testScenarios.length,
      files,
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
