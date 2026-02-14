import * as claudeAgentSDK from "@anthropic-ai/claude-agent-sdk";
import { createRaindropClaudeAgentSDK, type EventMetadata as EventMetadataType } from "@raindrop-ai/claude-agent-sdk";

const writeKey = process.env.RAINDROP_WRITE_KEY;
const raindrop = writeKey
  ? createRaindropClaudeAgentSDK({
      writeKey,
      traces: { enabled: true, debug: true, debugSpans: true },
      events: { enabled: true, debug: true },
    })
  : null;

const wrapped = raindrop
  ? raindrop.wrap(claudeAgentSDK, {
      context: {
        eventName: "agent_query",
      },
    })
  : null;

/** Wrapped query that captures events and traces when RAINDROP_WRITE_KEY is set. */
export const query: typeof claudeAgentSDK.query & {
  (args: Parameters<typeof claudeAgentSDK.query>[0], metadata?: EventMetadataType): ReturnType<typeof claudeAgentSDK.query>;
} = (wrapped?.query ?? claudeAgentSDK.query) as any;

/** Raindrop client for flush, identify, signals, etc. Null when RAINDROP_WRITE_KEY is not set. */
export const raindropClient = raindrop;

export { eventMetadata } from "@raindrop-ai/claude-agent-sdk";
