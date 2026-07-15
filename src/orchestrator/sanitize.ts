// Pure-JS equivalent of the bash `sanitize()` helper generate.yml used
// (tr + sed), for safe use in branch names and filesystem paths.
export function sanitizeForPath(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
