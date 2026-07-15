import semver from 'semver';
import { GithubClient } from './github';

export interface ResolvedRefs {
  base: string;
  head: string;
}

// Picks the tag matching releaseVersion as head, and the immediately
// preceding tag (by semver order) as base. Tag names are coerced to
// semver (so "v0.40.0", "0.40.0", and "26.1" all sort sensibly); tags
// that don't coerce to a version are ignored for ordering purposes.
export function resolveReleaseRefs(tagNames: string[], releaseVersion: string, tagPrefix = ''): ResolvedRefs {
  const headCandidates = [`${tagPrefix}${releaseVersion}`, releaseVersion, `v${releaseVersion}`];
  const head = headCandidates.find((candidate) => tagNames.includes(candidate));
  if (!head) {
    throw new Error(
      `No tag found matching release "${releaseVersion}" (tried: ${headCandidates.map((c) => `"${c}"`).join(', ')})`,
    );
  }

  const sortable = tagNames
    .map((name) => ({ name, version: semver.coerce(name) }))
    .filter((t): t is { name: string; version: semver.SemVer } => t.version !== null)
    .sort((a, b) => semver.compare(a.version, b.version));

  const headIndex = sortable.findIndex((t) => t.name === head);
  if (headIndex <= 0) {
    throw new Error(`Could not determine a tag preceding "${head}" to use as the diff base`);
  }

  return { base: sortable[headIndex - 1].name, head };
}

export async function fetchAllTagNames(client: GithubClient): Promise<string[]> {
  const tags = await client.octokit.paginate(client.octokit.rest.repos.listTags, {
    owner: client.owner,
    repo: client.name,
    per_page: 100,
  });
  return tags.map((t) => t.name);
}
