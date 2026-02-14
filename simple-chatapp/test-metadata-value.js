import { eventMetadata } from '@raindrop-ai/claude-agent-sdk';

console.log('Testing eventMetadata output...');

const metadata = eventMetadata({
  userId: 'test-user',
  convoId: 'test-chat',
});

console.log('eventMetadata result:');
console.log(JSON.stringify(metadata, null, 2));
