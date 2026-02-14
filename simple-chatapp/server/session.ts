import type { WSClient } from "./types.js";
import { AgentSession } from "./ai-client.js";
import { chatStore } from "./db-chat-store.js";

// Session manages a single chat conversation with a long-lived agent
export class Session {
  public readonly chatId: string;
  private subscribers: Set<WSClient> = new Set();
  private agentSession: AgentSession;
  private isListening = false;

  constructor(chatId: string, userId: string) {
    this.chatId = chatId;
    console.log('[DEBUG] Session constructor', { chatId, userId });

    // Create agent session with conversation history for context
    const messages = chatStore.getMessages(this.chatId);
    this.agentSession = new AgentSession(messages, userId, chatId);

    console.log(`Created session for chat ${this.chatId} with ${messages.length} previous messages`);
  }

  // Start listening to agent output (call once)
  private async startListening() {
    if (this.isListening) return;
    this.isListening = true;
    console.log('[DEBUG] Starting to listen for messages');

    try {
      for await (const message of this.agentSession.getOutputStream()) {
        console.log('[DEBUG] Received message from SDK:', message.type, JSON.stringify(message).substring(0, 200));
        this.handleSDKMessage(message);
      }
      console.log('[DEBUG] Stream completed - no more messages');
    } catch (error) {
      console.error(`[DEBUG] Error in session ${this.chatId}:`, error);
      console.error(`[DEBUG] Error stack:`, (error as Error).stack);
      this.broadcastError((error as Error).message);
    }
  }

  // Send a user message to the agent
  sendMessage(content: string) {
    // Store user message
    chatStore.addMessage(this.chatId, {
      role: "user",
      content,
    });

    // Broadcast user message to subscribers
    this.broadcast({
      type: "user_message",
      content,
      chatId: this.chatId,
    });

    // Send to agent first (this starts the session if needed)
    this.agentSession.sendMessage(content);

    // Start listening if not already
    if (!this.isListening) {
      this.startListening();
    }
  }

  // Interrupt the current query
  async interrupt() {
    console.log(`[SESSION] interrupt() called for chat ${this.chatId}`);
    console.log(`[SESSION] isListening: ${this.isListening}, hasSubscribers: ${this.hasSubscribers()}`);
    try {
      console.log(`[SESSION] Calling agentSession.interrupt() for chat ${this.chatId}`);
      await this.agentSession.interrupt();
      console.log(`[SESSION] agentSession.interrupt() returned successfully for chat ${this.chatId}`);

      this.broadcast({
        type: "interrupted",
        chatId: this.chatId,
        message: "Query interrupted by user"
      });
      console.log(`[SESSION] Broadcasted interrupted message for chat ${this.chatId}`);
    } catch (error) {
      console.error(`[SESSION] interrupt() error for chat ${this.chatId}:`, error);
      console.error(`[SESSION] Error stack:`, (error as Error).stack);
      this.broadcastError(`Failed to interrupt: ${(error as Error).message}`);
    }
  }

  private handleSDKMessage(message: any) {
    if (message.type === "assistant") {
      const content = message.message.content;

      if (typeof content === "string") {
        chatStore.addMessage(this.chatId, {
          role: "assistant",
          content,
        });
        this.broadcast({
          type: "assistant_message",
          content,
          chatId: this.chatId,
        });
      } else if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === "text") {
            chatStore.addMessage(this.chatId, {
              role: "assistant",
              content: block.text,
            });
            this.broadcast({
              type: "assistant_message",
              content: block.text,
              chatId: this.chatId,
            });
          } else if (block.type === "tool_use") {
            this.broadcast({
              type: "tool_use",
              toolName: block.name,
              toolId: block.id,
              toolInput: block.input,
              chatId: this.chatId,
            });
          }
        }
      }
    } else if (message.type === "result") {
      this.broadcast({
        type: "result",
        success: message.subtype === "success",
        chatId: this.chatId,
        cost: message.total_cost_usd,
        duration: message.duration_ms,
      });
    }
  }

  subscribe(client: WSClient) {
    this.subscribers.add(client);
    client.sessionId = this.chatId;
  }

  unsubscribe(client: WSClient) {
    this.subscribers.delete(client);
  }

  hasSubscribers(): boolean {
    return this.subscribers.size > 0;
  }

  private broadcast(message: any) {
    const messageStr = JSON.stringify(message);
    for (const client of this.subscribers) {
      try {
        if (client.readyState === client.OPEN) {
          client.send(messageStr);
        }
      } catch (error) {
        console.error("Error broadcasting to client:", error);
        this.subscribers.delete(client);
      }
    }
  }

  private broadcastError(error: string) {
    this.broadcast({
      type: "error",
      error,
      chatId: this.chatId,
    });
  }

  // Close the session
  close() {
    this.agentSession.close();
  }
}
