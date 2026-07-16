import { createGithubClient, fetchCompare, fetchCommitFiles, RawFile } from './github';
import { classifyCommit } from './classify';
import { inferModule } from './moduleInference';
import { ChangedFile, CodeScanResult, CommitInfo, ModuleSummary } from '../common/types';

export interface CodeScannerOptions {
  repo: string;
  base: string;
  head: string;
  token?: string;
  commitFiles?: boolean;
}

function toChangedFile(f: RawFile): ChangedFile {
  return {
    path: f.filename,
    status: f.status,
    additions: f.additions,
    deletions: f.deletions,
    changes: f.changes,
    module: inferModule(f.filename),
    ...(f.previous_filename ? { previousPath: f.previous_filename } : {}),
    ...(f.patch ? { patch: f.patch } : {}),
  };
}

export async function runCodeScanner(options: CodeScannerOptions): Promise<CodeScanResult> {
  const commitFiles = options.commitFiles ?? true;
  const token = options.token ?? process.env.GITHUB_TOKEN;
  const client = createGithubClient(options.repo, token);
  const { data, truncated } = await fetchCompare(client, options.base, options.head);

  const commits: CommitInfo[] = [];
  for (const c of data.commits) {
    const commit: CommitInfo = {
      sha: c.sha,
      message: c.commit.message,
      author: c.author?.login ?? c.commit.author?.name ?? 'unknown',
      date: c.commit.author?.date ?? null,
      category: classifyCommit(c.commit.message),
    };

    if (commitFiles) {
      const rawFiles = await fetchCommitFiles(client, c.sha);
      commit.files = rawFiles.map(toChangedFile);
    }

    commits.push(commit);
  }

  const files: ChangedFile[] = (data.files ?? []).map(toChangedFile);

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
    repo: options.repo,
    baseRef: options.base,
    headRef: options.head,
    generatedAt: new Date().toISOString(),
    commits,
    files,
    modules: moduleSummary.map((m) => m.module),
    moduleSummary,
    truncated,
  };
}
