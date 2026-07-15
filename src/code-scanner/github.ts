import { Octokit } from '@octokit/rest';

export interface RawFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  previous_filename?: string;
}

export interface CompareResult {
  commits: Array<{
    sha: string;
    commit: { message: string; author: { name?: string; date?: string } | null };
    author: { login?: string } | null;
  }>;
  files: RawFile[];
}

export interface GithubClient {
  octokit: Octokit;
  owner: string;
  name: string;
}

// Accepts a bare "owner/repo" as documented, but also tolerates the most
// common ways people accidentally paste a URL instead — stripping a
// leading scheme/host or a git@ prefix and a trailing ".git" or slash —
// so a copy-pasted URL fails with a clear message instead of silently
// resolving to the wrong owner/repo and a confusing 404 from GitHub.
export function parseRepoSpec(repo: string): { owner: string; name: string } {
  const normalized = repo
    .trim()
    .replace(/^(?:https?:\/\/)?(?:www\.)?github\.com\//i, '')
    .replace(/^git@github\.com:/i, '')
    .replace(/\.git$/i, '')
    .replace(/\/+$/, '');

  const segments = normalized.split('/').filter(Boolean);
  if (segments.length !== 2) {
    throw new Error(
      `Expected repo in "owner/name" form (e.g. "acme/storefront"), got "${repo}"` +
        (normalized !== repo ? ` (normalized to "${normalized}")` : ''),
    );
  }

  const [owner, name] = segments;
  return { owner, name };
}

export function createGithubClient(repo: string, token?: string): GithubClient {
  const { owner, name } = parseRepoSpec(repo);
  return { octokit: new Octokit(token ? { auth: token } : {}), owner, name };
}

export async function fetchCompare(
  client: GithubClient,
  baseRef: string,
  headRef: string,
): Promise<{ data: CompareResult; truncated: boolean }> {
  const { data } = await client.octokit.rest.repos.compareCommitsWithBasehead({
    owner: client.owner,
    repo: client.name,
    basehead: `${baseRef}...${headRef}`,
  });

  // The compare API caps commits at 250 and files at 300 per response with
  // no next-page link; total_commits tells us if commits were cut off.
  const totalCommits = (data as { total_commits?: number }).total_commits ?? data.commits.length;
  const truncated = totalCommits > data.commits.length;

  return { data: data as unknown as CompareResult, truncated };
}

export async function fetchCommitFiles(client: GithubClient, sha: string): Promise<RawFile[]> {
  const { data } = await client.octokit.rest.repos.getCommit({
    owner: client.owner,
    repo: client.name,
    ref: sha,
  });
  return (data.files ?? []) as RawFile[];
}
