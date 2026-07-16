import { CodeScanResult, ModuleSummary } from '../common/types';

// Combines per-repo code-scanner results into one, for the case where a
// single module's code spans multiple repos (e.g. a UI repo + an API
// repo) — all diffed with the same previous_ref/current_ref, since a
// coordinated multi-repo release is assumed to use matching branch names
// across repos.
export function mergeCodeScanResults(results: CodeScanResult[]): CodeScanResult {
  if (results.length === 0) {
    throw new Error('mergeCodeScanResults requires at least one result');
  }
  if (results.length === 1) return results[0];

  const commits = results.flatMap((r) => r.commits);
  const files = results.flatMap((r) => r.files);

  const moduleTotals = new Map<string, ModuleSummary>();
  for (const file of files) {
    const existing = moduleTotals.get(file.module) ?? {
      module: file.module,
      fileCount: 0,
      additions: 0,
      deletions: 0,
    };
    existing.fileCount += 1;
    existing.additions += file.additions;
    existing.deletions += file.deletions;
    moduleTotals.set(file.module, existing);
  }
  const moduleSummary = [...moduleTotals.values()].sort((a, b) => a.module.localeCompare(b.module));

  return {
    repo: results.map((r) => r.repo).join(','),
    baseRef: results[0].baseRef,
    headRef: results[0].headRef,
    generatedAt: new Date().toISOString(),
    commits,
    files,
    modules: moduleSummary.map((m) => m.module),
    moduleSummary,
    truncated: results.some((r) => r.truncated),
  };
}
