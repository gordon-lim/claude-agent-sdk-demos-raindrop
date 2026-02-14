import 'dotenv/config';
import { query, eventMetadata } from './server/raindrop.ts';

console.log('Testing async queue with delay (simulating chat app flow)...');

// Simple async queue - same as in ai-client.ts
class MessageQueue {
  messages = [];
  waiting = null;
  closed = false;

  push(content) {
    const msg = {
      type: "user",
      message: {
        role: "user",
        content,
      },
    };

    if (this.waiting) {
      this.waiting(msg);
      this.waiting = null;
    } else {
      this.messages.push(msg);
    }
  }

  async *[Symbol.asyncIterator]() {
    while (!this.closed) {
      if (this.messages.length > 0) {
        yield this.messages.shift();
      } else {
        yield await new Promise((resolve) => {
          this.waiting = resolve;
        });
      }
    }
  }

  close() {
    this.closed = true;
  }
}

async function test() {
  try {
    console.log('Creating queue...');
    const queue = new MessageQueue();

    console.log('Starting query with queue (WITH eventMetadata and conversation history)...');

    // Simulate conversation history like the app does
    const conversationHistory = [];
    let systemPrompt = 'You are a helpful AI assistant.';

    if (conversationHistory.length > 0) {
      systemPrompt += '\n\n## Previous Conversation Context\n\n';
      for (const msg of conversationHistory) {
        systemPrompt += `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}\n\n`;
      }
    }

    const options = {
      model: 'opus',
      maxTurns: 100,
      allowedTools: ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'WebSearch', 'WebFetch'],
      systemPrompt,
      extraArgs: eventMetadata({
        userId: 'test-user-id',
        convoId: 'test-chat-id',
      }),
    };

    const outputIterator = query({
      prompt: queue,
      options
    })[Symbol.asyncIterator]();

    console.log('Query started...');
    console.log('Simulating delay before first message (like when user subscribes to chat)...');

    // Start listening in background (like startListening())
    let isListening = true;
    const responses = [];

    const listeningPromise = (async () => {
      try {
        while (isListening) {
          const { value, done } = await outputIterator.next();
          if (done) break;

          responses.push(value);
          console.log(`← Received: ${value.type}`);

          if (value.type === 'result') {
            console.log('Result:', value.subtype);
            console.log('Cost: $' + (value.total_cost_usd || 0).toFixed(4));
            isListening = false;
            queue.close();
            break;
          }
        }
      } catch (error) {
        console.error('Error in listening loop:', error.message);
        throw error;
      }
    })();

    // Wait 2 seconds before sending message (simulates user delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('Now sending first message (after 2 second delay)...');
    queue.push('Say "Hello after delay!" and nothing else.');

    // Wait for responses
    await listeningPromise;

    console.log('✅ Test completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

test();
