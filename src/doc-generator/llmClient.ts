import { DraftDocument, ReleaseFacts } from '../common/types';

export interface LlmClient {
  draftStructured(facts: ReleaseFacts): Promise<DraftDocument>;
}
