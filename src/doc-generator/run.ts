import { buildReleaseFacts } from './releaseFacts';
import { createLlmClient } from './createLlmClient';
import { renderMarkdown } from './renderMarkdown';
import { CodeScanResult, DraftDocument, MappingResult, ReleaseFacts } from '../common/types';

export interface DocGeneratorResult {
  facts: ReleaseFacts;
  draft: DraftDocument;
  markdown: string;
}

export async function runDocGenerator(
  mapping: MappingResult,
  code: CodeScanResult,
  module: string,
): Promise<DocGeneratorResult> {
  const facts = buildReleaseFacts(mapping, code, module);
  const client = createLlmClient();
  const draft = await client.draftStructured(facts);
  const markdown = renderMarkdown(draft, facts);
  return { facts, draft, markdown };
}
