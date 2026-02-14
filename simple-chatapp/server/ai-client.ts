import { query, eventMetadata } from "./raindrop.js";
import type { ChatMessage } from "./types.js";

const SYSTEM_PROMPT = `You are a helpful AI assistant. You can help users with a wide variety of tasks including:
- Answering questions
- Writing and editing text
- Coding and debugging
- Analysis and research
- Creative tasks

Be concise but thorough in your responses.`;

type UserMessage = {
  type: "user";
  message: { role: "user"; content: string };
};

// Simple async queue - messages go in via push(), come out via async iteration
class MessageQueue {
  private messages: UserMessage[] = [];
  private waiting: ((msg: UserMessage) => void) | null = null;
  private closed = false;

  push(content: string) {
    const msg: UserMessage = {
      type: "user",
      message: {
        role: "user",
        content,
      },
    };

    if (this.waiting) {
      // Someone is waiting for a message - give it to them
      this.waiting(msg);
      this.waiting = null;
    } else {
      // No one waiting - queue it
      this.messages.push(msg);
    }
  }

  async *[Symbol.asyncIterator](): AsyncIterableIterator<UserMessage> {
    while (!this.closed) {
      if (this.messages.length > 0) {
        yield this.messages.shift()!;
      } else {
        // Wait for next message
        yield await new Promise<UserMessage>((resolve) => {
          this.waiting = resolve;
        });
      }
    }
  }

  close() {
    this.closed = true;
  }
}

export class AgentSession {
  private queue = new MessageQueue();
  private queryInstance: any = null;
  private outputIterator: AsyncIterator<any> | null = null;

  constructor(
    conversationHistory: ChatMessage[] = [],
    private readonly userId?: string,
    private readonly chatId?: string
  ) {
    // Build system prompt with conversation history if available
    let systemPrompt = SYSTEM_PROMPT;

    if (conversationHistory.length > 0) {
      systemPrompt += `\n\n## Previous Conversation Context\n\nThis chat has previous history. Here are the messages so far:\n\n`;
      for (const msg of conversationHistory) {
        systemPrompt += `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}\n\n`;
      }
      systemPrompt += `Continue the conversation naturally from this point. You have full context of the previous discussion.`;
    }

    // Start the query immediately with the queue as input
    // Cast to any - SDK accepts simpler message format at runtime
    const options: Record<string, unknown> = {
      maxTurns: 100,
      model: "opus",
      allowedTools: [
        "Bash",
        "Read",
        "Write",
        "Edit",
        "Glob",
        "Grep",
        "WebSearch",
        "WebFetch",
      ],
      systemPrompt,
    };

    const queryArgs = {
      prompt: this.queue as any,
      options,
    };

    // Pass eventMetadata as second argument when using Raindrop-wrapped SDK
    const metadata = (this.userId || this.chatId) && process.env.RAINDROP_WRITE_KEY
      ? eventMetadata({
          userId: this.userId,
          convoId: this.chatId,
        })
      : undefined;

    console.log('[DEBUG] AgentSession created with metadata:', {
      userId: this.userId,
      chatId: this.chatId,
      hasMetadata: !!metadata,
      metadata: metadata,
      hasRaindropKey: !!process.env.RAINDROP_WRITE_KEY
    });

    // Store the Query instance so we can call interrupt() on it
    this.queryInstance = metadata
      ? query(queryArgs, metadata)
      : query(queryArgs);

    this.outputIterator = this.queryInstance[Symbol.asyncIterator]();
  }

  // Send a message to the agent
  sendMessage(content: string) {
    console.log('[DEBUG] AgentSession.sendMessage called with:', content.substring(0, 50));
    this.queue.push(content);
  }

  // Interrupt the current query execution
  async interrupt() {
    console.log('[AGENT] interrupt() called');
    console.log('[AGENT] queryInstance exists:', !!this.queryInstance);
    console.log('[AGENT] queryInstance type:', typeof this.queryInstance);
    console.log('[AGENT] queryInstance has interrupt method:', this.queryInstance && typeof this.queryInstance.interrupt === 'function');

    if (!this.queryInstance) {
      console.error('[AGENT] No queryInstance - throwing error');
      throw new Error("Session not initialized");
    }

    console.log('[AGENT] Calling queryInstance.interrupt()...');
    try {
      const result = await this.queryInstance.interrupt();
      console.log('[AGENT] queryInstance.interrupt() returned:', result);
      console.log('[AGENT] interrupt completed successfully');
    } catch (error) {
      console.error('[AGENT] queryInstance.interrupt() threw error:', error);
      console.error('[AGENT] Error type:', error?.constructor?.name);
      console.error('[AGENT] Error message:', (error as Error)?.message);
      console.error('[AGENT] Error stack:', (error as Error)?.stack);
      throw error;
    }
  }

  // Get the output stream
  async *getOutputStream() {
    if (!this.outputIterator) {
      throw new Error("Session not initialized");
    }
    while (true) {
      const { value, done } = await this.outputIterator.next();
      if (done) break;
      yield value;
    }
  }

  close() {
    this.queue.close();
  }
}
