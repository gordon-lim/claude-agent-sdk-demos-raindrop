import 'dotenv/config';
import { query, eventMetadata } from './server/raindrop.ts';

console.log('Testing Raindrop-wrapped SDK query...');
console.log('ANTHROPIC_API_KEY:', process.env.ANTHROPIC_API_KEY?.substring(0, 20) + '...');
console.log('RAINDROP_WRITE_KEY:', process.env.RAINDROP_WRITE_KEY ? 'Set' : 'Not set');

async function test() {
  try {
    console.log('Starting query...');

    const options = {
      model: 'sonnet',
      maxTurns: 1,
      allowedTools: [],
    };

    // Test with eventMetadata like the app does
    if (process.env.RAINDROP_WRITE_KEY) {
      options.extraArgs = eventMetadata({
        userId: 'test-user',
        convoId: 'test-chat',
      });
    }

    const result = query({
      prompt: 'Say "Hello from Raindrop test!" and nothing else.',
      options
    });

    console.log('Query started, waiting for responses...');

    for await (const message of result) {
      console.log('Message type:', message.type);
      if (message.type === 'assistant') {
        console.log('Assistant response received');
      }
      if (message.type === 'result') {
        console.log('Result:', message.subtype);
        console.log('Cost: $' + (message.total_cost_usd || 0).toFixed(4));
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
