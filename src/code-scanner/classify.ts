import { ChangeCategory } from '../common/types';

// Maps commit-message tag keywords (bracket-style e.g. "[Fix] ..." or
// conventional-commit style e.g. "fix: ...") to a change category.
const TAG_KEYWORD_MAP: Record<string, ChangeCategory> = {
  new: 'feature',
  feat: 'feature',
  feature: 'feature',
  fix: 'bugfix',
  bugfix: 'bugfix',
  patch: 'bugfix',
  hotfix: 'bugfix',
  refactor: 'refactor',
  cleanup: 'refactor',
  docs: 'docs',
  doc: 'docs',
  readme: 'docs',
  test: 'test',
  tests: 'test',
  chore: 'config',
  build: 'config',
  ci: 'config',
  actions: 'config',
  config: 'config',
  deps: 'config',
  'dev deps': 'config',
  security: 'config',
  style: 'config',
};

export function classifyCommit(message: string): ChangeCategory {
  const subject = (message.split('\n')[0] || '').trim();

  const bracketMatch = subject.match(/^\[([^\]]+)\]/);
  if (bracketMatch) {
    const category = TAG_KEYWORD_MAP[bracketMatch[1].toLowerCase()];
    if (category) return category;
  }

  const conventionalMatch = subject.match(/^(\w+)(?:\([^)]*\))?!?:/);
  if (conventionalMatch) {
    const category = TAG_KEYWORD_MAP[conventionalMatch[1].toLowerCase()];
    if (category) return category;
  }

  const lower = subject.toLowerCase();
  if (/\bfix(es|ed)?\b|\bbug\b/.test(lower)) return 'bugfix';
  if (/\badd(s|ed)?\b|\bnew\b|\bfeature\b/.test(lower)) return 'feature';
  if (/\brefactor/.test(lower)) return 'refactor';
  if (/\breadme\b|\bdocs?\b/.test(lower)) return 'docs';
  if (/\btest(s|ing)?\b/.test(lower)) return 'test';

  return 'other';
}
