import { LlmClient } from './llmClient';
import { DummyLlmClient } from './dummyLlmClient';
import { BedrockLlmClient } from './bedrockLlmClient';

// LLM_PROVIDER=dummy (default) needs no credentials and produces a
// deterministic draft — useful until a real Bedrock model/key is wired
// up. LLM_PROVIDER=bedrock requires BEDROCK_MODEL_ID and an AWS region
// to be set explicitly; no model ID is guessed or defaulted.
export function createLlmClient(): LlmClient {
  const provider = (process.env.LLM_PROVIDER ?? 'dummy').toLowerCase();

  if (provider === 'bedrock') {
    const modelId = process.env.BEDROCK_MODEL_ID;
    if (!modelId) {
      throw new Error('BEDROCK_MODEL_ID is required when LLM_PROVIDER=bedrock');
    }
    const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION;
    if (!region) {
      throw new Error('AWS_REGION (or AWS_DEFAULT_REGION) is required when LLM_PROVIDER=bedrock');
    }
    return new BedrockLlmClient(modelId, region);
  }

  if (provider !== 'dummy') {
    throw new Error(`Unknown LLM_PROVIDER "${provider}" (expected "dummy" or "bedrock")`);
  }

  return new DummyLlmClient();
}
