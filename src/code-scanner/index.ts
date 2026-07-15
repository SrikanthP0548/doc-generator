#!/usr/bin/env node
import { Command } from 'commander';
import { writeFileSync } from 'node:fs';
import { createGithubClient, fetchCompare, fetchCommitFiles, RawFile } from './github';
import { classifyCommit } from './classify';
import { inferModule } from './moduleInference';
import { ChangedFile, CodeScanResult, CommitInfo, ModuleSummary } from '../common/types';

interface Options {
  repo: string;
  base: string;
  head: string;
  token?: string;
  out?: string;
  commitFiles: boolean;
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
  };
}

async function run(options: Options): Promise<CodeScanResult> {
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

    if (options.commitFiles) {
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

const program = new Command();

program
  .name('code-scanner')
  .description('Diffs two release refs on a GitHub repo and outputs classified commits + module-tagged changed files as JSON')
  .requiredOption('--repo <owner/name>', 'GitHub repo, e.g. nvm-sh/nvm')
  .requiredOption('--base <ref>', 'base ref (tag/branch/sha) — the older release')
  .requiredOption('--head <ref>', 'head ref (tag/branch/sha) — the newer release')
  .option('--token <token>', 'GitHub token (defaults to $GITHUB_TOKEN); unauthenticated works for public repos at a lower rate limit')
  .option('--out <file>', 'write JSON to a file instead of stdout')
  .option(
    '--no-commit-files',
    'skip fetching each commit\'s changed-file list (one extra API call per commit); faster, but downstream mapping evidence loses commit<->module attribution',
  )
  .action(async (options: Options) => {
    try {
      const result = await run(options);
      const json = JSON.stringify(result, null, 2);
      if (options.out) {
        writeFileSync(options.out, json);
        console.error(`Wrote ${options.out}`);
      } else {
        console.log(json);
      }
    } catch (err) {
      console.error('code-scanner failed:', err instanceof Error ? err.message : err);
      process.exitCode = 1;
    }
  });

program.parse();
