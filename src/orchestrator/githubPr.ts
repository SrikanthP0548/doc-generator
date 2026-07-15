import { createGithubClient } from '../code-scanner/github';

export async function getDefaultBranch(repo: string, token: string): Promise<string> {
  const client = createGithubClient(repo, token);
  const { data } = await client.octokit.rest.repos.get({ owner: client.owner, repo: client.name });
  return data.default_branch;
}

export interface OpenPrOptions {
  repo: string;
  token: string;
  head: string;
  base: string;
  title: string;
  body: string;
}

export async function openPullRequest(options: OpenPrOptions): Promise<{ url: string; number: number }> {
  const client = createGithubClient(options.repo, options.token);
  const { data } = await client.octokit.rest.pulls.create({
    owner: client.owner,
    repo: client.name,
    head: options.head,
    base: options.base,
    title: options.title,
    body: options.body,
  });
  return { url: data.html_url, number: data.number };
}
