import 'dotenv/config';
import { query } from '@anthropic-ai/claude-agent-sdk';

console.log('Testing Claude Agent SDK query...');
console.log('ANTHROPIC_API_KEY:', process.env.ANTHROPIC_API_KEY?.substring(0, 20) + '...');

async function test() {
  try {
    console.log('Starting query...');

    const result = query({
      prompt: 'Say "Hello from SDK test!" and nothing else.',
      options: {
        model: 'sonnet',
        maxTurns: 1,
        allowedTools: []
      }
    });

    console.log('Query started, waiting for responses...');

    for await (const message of result) {
      console.log('Message type:', message.type);
      if (message.type === 'assistant') {
        console.log('Assistant:', JSON.stringify(message.message));
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
