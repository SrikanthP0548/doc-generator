// Infers a module name from a changed file's path. Uses the first path
// segment as the module boundary (e.g. "src/Payments/Checkout.ts" ->
// "Payments"); top-level files with no directory fall into "root", and
// dotfile directories (".github") are normalized without the leading dot.
export function inferModule(filePath: string): string {
  const normalized = filePath.replace(/^\.\//, '');
  const segments = normalized.split('/');

  if (segments.length === 1) return 'root';

  let first = segments[0];
  if (first.startsWith('.')) first = first.slice(1);

  return first || 'root';
}
