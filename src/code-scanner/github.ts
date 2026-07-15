import { Octokit } from '@octokit/rest';

export interface CompareResult {
  commits: Array<{
    sha: string;
    commit: { message: string; author: { name?: string; date?: string } | null };
    author: { login?: string } | null;
  }>;
  files: Array<{
    filename: string;
    status: string;
    additions: number;
    deletions: number;
    changes: number;
    previous_filename?: string;
  }>;
}

export async function fetchCompare(
  repo: string,
  baseRef: string,
  headRef: string,
  token?: string,
): Promise<{ data: CompareResult; truncated: boolean }> {
  const [owner, name] = repo.split('/');
  if (!owner || !name) {
    throw new Error(`Expected repo in "owner/name" form, got "${repo}"`);
  }

  const octokit = new Octokit(token ? { auth: token } : {});

  const { data } = await octokit.rest.repos.compareCommitsWithBasehead({
    owner,
    repo: name,
    basehead: `${baseRef}...${headRef}`,
  });

  // The compare API caps commits at 250 and files at 300 per response with
  // no next-page link; total_commits tells us if commits were cut off.
  const totalCommits = (data as { total_commits?: number }).total_commits ?? data.commits.length;
  const truncated = totalCommits > data.commits.length;

  return { data: data as unknown as CompareResult, truncated };
}
