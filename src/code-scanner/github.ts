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

export function createGithubClient(repo: string, token?: string): GithubClient {
  const [owner, name] = repo.split('/');
  if (!owner || !name) {
    throw new Error(`Expected repo in "owner/name" form, got "${repo}"`);
  }
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
