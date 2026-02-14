import * as claudeAgentSDK from "@anthropic-ai/claude-agent-sdk";
import { createRaindropClaudeAgentSDK } from "@raindrop-ai/claude-agent-sdk";

const writeKey = process.env.RAINDROP_WRITE_KEY;
const raindrop = writeKey
  ? createRaindropClaudeAgentSDK({
      writeKey,
      traces: { enabled: true },
      events: { enabled: true },
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
export const query = wrapped?.query ?? claudeAgentSDK.query;

/** Raindrop client for flush, identify, signals, etc. Null when RAINDROP_WRITE_KEY is not set. */
export const raindropClient = raindrop;

export { eventMetadata } from "@raindrop-ai/claude-agent-sdk";
