import 'dotenv/config';
import { query } from './server/raindrop.ts';

console.log('Testing async queue pattern...');

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

    console.log('Starting query with queue...');
    const outputIterator = query({
      prompt: queue,
      options: {
        model: 'sonnet',
        maxTurns: 10,
        allowedTools: ['Bash', 'Read', 'Write'],
      }
    })[Symbol.asyncIterator]();

    console.log('Query started, sending first message...');

    // Send a message immediately
    queue.push('Say "Hello from queue test!" and nothing else.');

    console.log('Waiting for responses...');
    let responseCount = 0;

    while (true) {
      const { value, done } = await outputIterator.next();
      if (done) break;

      responseCount++;
      console.log(`[${responseCount}] Message type:`, value.type);

      if (value.type === 'assistant') {
        console.log('Assistant response received');
      }
      if (value.type === 'result') {
        console.log('Result:', value.subtype);
        console.log('Cost: $' + (value.total_cost_usd || 0).toFixed(4));
        queue.close();
        break;
      }
    }

    console.log('✅ Test completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

test();
