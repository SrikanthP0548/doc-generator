import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

// All git calls go through execFile (never a shell), so there is no shell
// to resolve "bash" incorrectly on Windows — the class of problem that
// broke this pipeline under GitHub Actions never applies here.
async function git(args: string[], cwd?: string): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd });
  return stdout.trim();
}

export function authenticatedCloneUrl(repo: string, token: string): string {
  return `https://x-access-token:${token}@github.com/${repo}.git`;
}

export async function cloneRepo(
  repo: string,
  token: string,
  destination: string,
  options: { ref?: string; depth?: number } = {},
): Promise<void> {
  const args = ['clone'];
  if (options.depth) args.push('--depth', String(options.depth));
  if (options.ref) args.push('--branch', options.ref);
  args.push(authenticatedCloneUrl(repo, token), destination);
  await execFileAsync('git', args);
}

export async function checkoutNewBranch(cwd: string, branch: string): Promise<void> {
  await git(['checkout', '-b', branch], cwd);
}

export async function configureIdentity(cwd: string, name: string, email: string): Promise<void> {
  await git(['config', 'user.name', name], cwd);
  await git(['config', 'user.email', email], cwd);
}

export async function addAll(cwd: string): Promise<void> {
  await git(['add', '.'], cwd);
}

export async function commit(cwd: string, message: string): Promise<void> {
  await git(['commit', '-m', message], cwd);
}

export async function push(cwd: string, branch: string): Promise<void> {
  await git(['push', 'origin', branch], cwd);
}
