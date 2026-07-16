import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { DraftDocument, ReleaseFacts } from '../common/types';
import { LlmClient } from './llmClient';
import { DRAFT_TOOL_DESCRIPTION, DRAFT_TOOL_NAME, DRAFT_TOOL_SCHEMA, SYSTEM_PROMPT } from './prompt';

// Calls Claude via AWS Bedrock's Converse API, forcing the model to
// respond through a single tool call so the draft comes back as
// structured JSON rather than freeform text. Credentials are resolved by
// the AWS SDK's default provider chain (env vars, shared config, SSO,
// IAM role, etc.) — nothing enterprise-specific is hardcoded here.
//
// This also covers Bedrock API keys (the bearer-token auth AWS added as
// a simpler alternative to full IAM SigV4 credentials) with zero extra
// code: @aws-sdk/client-bedrock-runtime resolves credentials for the
// "bedrock" signing name, and its default auth-scheme resolution checks
// for AWS_BEARER_TOKEN_BEDROCK in the environment — if it's set, the
// client automatically signs requests with smithy.api#httpBearerAuth
// instead of aws.auth#sigv4, no client config needed here to opt in.
// Falls back to standard IAM credential resolution if that env var
// isn't set. To use a Bedrock API key: export
// AWS_BEARER_TOKEN_BEDROCK=<the key>, alongside AWS_REGION and
// BEDROCK_MODEL_ID as usual — nothing else changes.
export class BedrockLlmClient implements LlmClient {
  constructor(
    private readonly modelId: string,
    private readonly region: string,
  ) {}

  async draftStructured(facts: ReleaseFacts): Promise<DraftDocument> {
    const client = new BedrockRuntimeClient({ region: this.region });

    const response = await client.send(
      new ConverseCommand({
        modelId: this.modelId,
        system: [{ text: SYSTEM_PROMPT }],
        messages: [
          {
            role: 'user',
            content: [{ text: `Release facts:\n${JSON.stringify(facts, null, 2)}` }],
          },
        ],
        toolConfig: {
          tools: [
            {
              toolSpec: {
                name: DRAFT_TOOL_NAME,
                description: DRAFT_TOOL_DESCRIPTION,
                inputSchema: { json: DRAFT_TOOL_SCHEMA },
              },
            },
          ],
          toolChoice: { tool: { name: DRAFT_TOOL_NAME } },
        },
      }),
    );

    const toolUse = response.output?.message?.content?.find((block) => block.toolUse)?.toolUse;
    if (!toolUse?.input) {
      throw new Error('Bedrock response did not include the expected tool call');
    }

    return toolUse.input as unknown as DraftDocument;
  }
}
