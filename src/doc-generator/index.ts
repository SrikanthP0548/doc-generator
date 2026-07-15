#!/usr/bin/env node
import { Command } from 'commander';
import { readFileSync, writeFileSync } from 'node:fs';
import { buildReleaseFacts } from './releaseFacts';
import { createLlmClient } from './createLlmClient';
import { renderMarkdown } from './renderMarkdown';
import { CodeScanResult, MappingResult } from '../common/types';

interface Options {
  mapping: string;
  code: string;
  module: string;
  out?: string;
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

const program = new Command();

program
  .name('doc-generator')
  .description('Drafts a product-readable release document (Markdown) from mapping-engine output + code-scanner facts')
  .requiredOption('--mapping <file>', 'mapping-engine JSON output file')
  .requiredOption('--code <file>', 'code-scanner JSON output file')
  .option('--module <module>', 'module to draft for; "All" for all modules', 'All')
  .option('--out <file>', 'write Markdown to a file instead of stdout')
  .action(async (options: Options) => {
    try {
      const mapping = readJson<MappingResult>(options.mapping);
      const code = readJson<CodeScanResult>(options.code);

      const facts = buildReleaseFacts(mapping, code, options.module);
      const client = createLlmClient();
      const draft = await client.draftStructured(facts);
      const markdown = renderMarkdown(draft, facts);

      if (options.out) {
        writeFileSync(options.out, markdown);
        console.error(`Wrote ${options.out}`);
      } else {
        console.log(markdown);
      }
    } catch (err) {
      console.error('doc-generator failed:', err instanceof Error ? err.message : err);
      process.exitCode = 1;
    }
  });

program.parse();
