#!/usr/bin/env node
import 'dotenv/config';
import { Command } from 'commander';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCodeScanner } from '../code-scanner/run';
import { runTestScanner } from '../test-scanner/run';
import { buildMapping } from '../mapping-engine/mapping';
import { runDocGenerator } from '../doc-generator/run';
import { cloneRepo, checkoutNewBranch, configureIdentity, addAll, commit, push } from './git';
import { getDefaultBranch, openPullRequest } from './githubPr';
import { sanitizeForPath } from './sanitize';
import { mergeCodeScanResults } from './mergeCodeScans';

interface CliOptions {
  appRepo: string;
  previousRef: string;
  currentRef: string;
  automationRepo: string;
  automationSubpath?: string;
  testBranch?: string;
  testTagVersion: string;
  module: string;
  knownModules?: string;
  docsRepo: string;
  appToken?: string;
  automationToken?: string;
  docsToken?: string;
  skipPr?: boolean;
  keepWorkDir?: boolean;
}

function resolveToken(specific: string | undefined): string {
  const token = specific ?? process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('No token available — pass it explicitly or set $GITHUB_TOKEN');
  }
  return token;
}

async function run(options: CliOptions): Promise<void> {
  const appToken = resolveToken(options.appToken);
  const automationToken = resolveToken(options.automationToken);
  const docsToken = resolveToken(options.docsToken);

  const workDir = mkdtempSync(join(tmpdir(), 'release-doc-'));
  console.error(`Working directory: ${workDir}`);

  try {
    const automationCheckoutDir = join(workDir, 'automation-repo');
    const appRepos = options.appRepo.split(',').map((r) => r.trim()).filter(Boolean);
    if (appRepos.length === 0) {
      throw new Error('--app-repo must name at least one repo');
    }

    console.error(
      appRepos.length > 1
        ? `Scanning ${appRepos.length} app repos and test coverage in parallel...`
        : 'Scanning code changes and test coverage in parallel...',
    );
    const [codeResults, testResult] = await Promise.all([
      Promise.all(
        appRepos.map((repo) =>
          runCodeScanner({
            repo,
            base: options.previousRef,
            head: options.currentRef,
            token: appToken,
          }),
        ),
      ),
      (async () => {
        await cloneRepo(options.automationRepo, automationToken, automationCheckoutDir, {
          ref: options.testBranch,
          depth: 1,
        });
        const scanPath = options.automationSubpath
          ? join(automationCheckoutDir, options.automationSubpath)
          : automationCheckoutDir;
        return runTestScanner({
          path: scanPath,
          release: options.testTagVersion,
          module: options.module,
        });
      })(),
    ]);

    const codeResult = mergeCodeScanResults(codeResults);
    console.error(
      `Code scan: ${appRepos.length} repo(s), ${codeResult.commits.length} commits, ${codeResult.files.length} files changed`,
    );
    console.error(`Test scan: ${testResult.summary.matchedScenarioCount} matching scenario(s)`);

    console.error('Building mapping...');
    const knownModules = options.knownModules
      ? options.knownModules.split(',').map((m) => m.trim()).filter(Boolean)
      : [];
    const mapping = buildMapping(codeResult, testResult, options.testTagVersion, knownModules, options.module !== 'All' ? options.module : undefined);
    console.error(`Mapping: ${mapping.mappings.length} module(s) mapped, ${mapping.gaps.length} gap(s)`);

    console.error('Drafting release document...');
    const { markdown } = await runDocGenerator(mapping, codeResult, options.module);

    console.error(`Fetching default branch of ${options.docsRepo}...`);
    const baseBranch = await getDefaultBranch(options.docsRepo, docsToken);

    const docsCheckoutDir = join(workDir, 'docs-output');
    await cloneRepo(options.docsRepo, docsToken, docsCheckoutDir, { ref: baseBranch });

    const safeRelease = sanitizeForPath(options.testTagVersion);
    const safeModule = sanitizeForPath(options.module);
    const branch = `release-doc/${safeRelease}-${safeModule}-${Date.now()}`;
    await checkoutNewBranch(docsCheckoutDir, branch);

    const docDir = join(docsCheckoutDir, 'releases', safeRelease, safeModule);
    mkdirSync(docDir, { recursive: true });
    writeFileSync(join(docDir, 'release-doc.md'), markdown);
    writeFileSync(join(docDir, 'evidence.json'), JSON.stringify(mapping, null, 2));

    await configureIdentity(docsCheckoutDir, 'release-doc-bot', 'release-doc-bot@users.noreply.github.com');
    await addAll(docsCheckoutDir);
    await commit(docsCheckoutDir, `Draft release doc for ${options.testTagVersion} (${options.module})`);
    await push(docsCheckoutDir, branch);
    console.error(`Pushed branch ${branch} to ${options.docsRepo}`);

    if (options.skipPr) {
      console.log(JSON.stringify({ branch, prUrl: null }, null, 2));
      return;
    }

    const pr = await openPullRequest({
      repo: options.docsRepo,
      token: docsToken,
      head: branch,
      base: baseBranch,
      title: `Draft release doc for ${options.testTagVersion} (${options.module})`,
      body: `Automated draft. ${mapping.gaps.length} coverage gap(s) flagged — see evidence.json.`,
    });
    console.error(`Opened PR #${pr.number}: ${pr.url}`);

    console.log(JSON.stringify({ branch, prUrl: pr.url }, null, 2));
  } finally {
    if (!options.keepWorkDir) {
      rmSync(workDir, { recursive: true, force: true });
    } else {
      console.error(`Kept working directory: ${workDir}`);
    }
  }
}

const program = new Command();

program
  .name('release-doc-generate')
  .description('End-to-end release document generation: scan, map, draft, and open a PR — no CI runner required')
  .requiredOption(
    '--app-repo <owner/name[,owner/name...]>',
    'app repo(s) code-scanner diffs, comma-separated if the module\'s code spans multiple repos (e.g. a UI repo + an API repo) — all diffed with the same --previous-ref/--current-ref',
  )
  .requiredOption('--previous-ref <ref>', 'previous release branch/tag — code diff "from" side')
  .requiredOption('--current-ref <ref>', 'current release branch/tag — code diff "to" side')
  .requiredOption('--automation-repo <owner/name>', 'automation repo containing .feature files')
  .option('--automation-subpath <path>', 'subdirectory within the automation repo containing .feature files')
  .option('--test-branch <branch>', 'branch/tag of the automation repo to scan; defaults to its default branch')
  .requiredOption('--test-tag-version <version>', 'release label automation tests are tagged with, e.g. 25.3')
  .option('--module <module>', 'module to document, or "All" for every module', 'All')
  .option('--known-modules <list>', 'comma-separated known module vocabulary, needed to detect orphan-test gaps')
  .requiredOption('--docs-repo <owner/name>', 'repo the draft branch/PR is pushed to')
  .option('--app-token <token>', 'token for all --app-repo repos (defaults to $GITHUB_TOKEN); must have access to each one')
  .option('--automation-token <token>', 'token for --automation-repo (defaults to $GITHUB_TOKEN)')
  .option('--docs-token <token>', 'token for --docs-repo (defaults to $GITHUB_TOKEN)')
  .option('--skip-pr', 'push the branch but do not open a pull request')
  .option('--keep-work-dir', 'do not delete the temporary working directory on exit (debugging)')
  .action(async (options: CliOptions) => {
    try {
      await run(options);
    } catch (err) {
      console.error('release-doc-generate failed:', err instanceof Error ? err.message : err);
      process.exitCode = 1;
    }
  });

program.parse();
