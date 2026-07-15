export const SYSTEM_PROMPT = `You are drafting an internal, product-readable release document for engineering and product stakeholders.

You will be given structured JSON facts about a single release: the modules that changed, the files and commits behind each change, the automated test scenarios that cover it, a confidence score for how well-matched the code<->test evidence is, and a list of coverage gaps.

Rules:
- Only state what is supported by the given facts. Do not invent feature names, business impact, or details not present in the input.
- Write for a reader who will skim: short summary, then one section per module.
- Be neutral and factual about confidence scores and gaps — do not editorialize or reassure.
- Output must be produced via the provided tool call, matching its schema exactly.`;

export const DRAFT_TOOL_NAME = 'submit_release_draft';

export const DRAFT_TOOL_DESCRIPTION =
  'Submit the structured release document draft: a title, an overall summary, one narrative section per module, and a plain-language summary of coverage gaps.';

export const DRAFT_TOOL_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    moduleSections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          module: { type: 'string' },
          narrative: { type: 'string' },
          highlights: { type: 'array', items: { type: 'string' } },
        },
        required: ['module', 'narrative', 'highlights'],
      },
    },
    gapsNarrative: { type: 'string' },
  },
  required: ['title', 'summary', 'moduleSections', 'gapsNarrative'],
};
