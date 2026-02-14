import 'dotenv/config';
import { query } from '@anthropic-ai/claude-agent-sdk';

console.log('Testing without eventMetadata...');

class MessageQueue {
  messages = [];
  waiting = null;
  closed = false;

  push(content) {
    const msg = {
      type: "user",
      message: { role: "user", content },
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
        yield await new Promise((resolve) => { this.waiting = resolve; });
      }
    }
  }

  close() { this.closed = true; }
}

async function test() {
  try {
    const queue = new MessageQueue();

    const options = {
      model: 'opus',
      maxTurns: 100,
      allowedTools: ['Bash', 'Read', 'Write'],
      systemPrompt: 'You are a helpful AI assistant.',
      // NO extraArgs / eventMetadata
    };

    const outputIterator = query({ prompt: queue, options })[Symbol.asyncIterator]();
    console.log('Query started, waiting 2 seconds...');

    let isListening = true;
    const listeningPromise = (async () => {
      try {
        while (isListening) {
          const { value, done } = await outputIterator.next();
          if (done) break;
          console.log(`← ${value.type}`);
          if (value.type === 'result') {
            isListening = false;
            queue.close();
            break;
          }
        }
      } catch (error) {
        console.error('Error:', error.message);
        throw error;
      }
    })();

    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('Sending message after delay...');
    queue.push('Say "Hello!" and nothing else.');

    await listeningPromise;
    console.log('✅ SUCCESS!');
    process.exit(0);
  } catch (error) {
    console.error('❌ FAILED:', error.message);
    process.exit(1);
  }
}

test();
