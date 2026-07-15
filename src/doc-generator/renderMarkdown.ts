import { DraftDocument, ReleaseFacts } from '../common/types';

export function renderMarkdown(draft: DraftDocument, facts: ReleaseFacts): string {
  const lines: string[] = [];

  lines.push(`# ${draft.title}`, '');
  lines.push(draft.summary, '');
  lines.push(`**Repo:** ${facts.repo}`);
  lines.push(`**Diff:** \`${facts.baseRef}...${facts.headRef}\``, '');

  for (const section of draft.moduleSections) {
    lines.push(`## ${section.module}`, '');
    lines.push(section.narrative, '');
    if (section.highlights.length > 0) {
      for (const highlight of section.highlights) lines.push(`- \`${highlight}\``);
      lines.push('');
    }
  }

  lines.push('## Coverage Gaps', '');
  lines.push(draft.gapsNarrative, '');

  return lines.join('\n');
}
