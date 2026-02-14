import WebSocket from 'ws';

const WS_URL = 'ws://localhost:3006/ws';

// Test credentials - use unique email each time
const TEST_EMAIL = `test${Date.now()}@example.com`;
const TEST_PASSWORD = 'testpass123';
const API_URL = 'http://localhost:3006/api';

async function registerOrLogin() {
  const timestamp = Date.now();
  try {
    // Try to register
    const registerRes = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: `testuser${timestamp}`,
        email: TEST_EMAIL,
        password: TEST_PASSWORD
      })
    });

    if (registerRes.ok) {
      const data = await registerRes.json();
      console.log('✓ Registered new user');
      return data.token;
    }
  } catch (e) {
    // User might already exist, try login
  }

  // Try to login
  const loginRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    })
  });

  if (!loginRes.ok) {
    throw new Error('Failed to login: ' + await loginRes.text());
  }

  const data = await loginRes.json();
  console.log('✓ Logged in existing user');
  return data.token;
}

async function createChat(token) {
  const res = await fetch(`${API_URL}/chats`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ title: 'Test Chat' })
  });

  if (!res.ok) {
    throw new Error('Failed to create chat: ' + await res.text());
  }

  const chat = await res.json();
  console.log('✓ Created chat:', chat.id);
  return chat.id;
}

function testAgent(token, chatId) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    let receivedResponse = false;

    const timeout = setTimeout(() => {
      if (!receivedResponse) {
        reject(new Error('Timeout: No response from agent after 30 seconds'));
        ws.close();
      }
    }, 30000);

    ws.on('open', () => {
      console.log('✓ WebSocket connected');

      // Authenticate
      ws.send(JSON.stringify({
        type: 'auth',
        token: token
      }));
    });

    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      console.log('← Received:', message.type);

      if (message.type === 'authenticated') {
        console.log('✓ WebSocket authenticated');

        // Subscribe to chat
        ws.send(JSON.stringify({
          type: 'subscribe',
          chatId: chatId
        }));
      }

      if (message.type === 'history') {
        console.log('✓ Received chat history');

        // Send test message
        console.log('→ Sending test message...');
        ws.send(JSON.stringify({
          type: 'chat',
          chatId: chatId,
          content: 'Hello! Can you confirm you received this message? Just reply with a simple "yes".'
        }));
      }

      if (message.type === 'assistant_message') {
        console.log('✓ Received assistant response:', message.content);
        receivedResponse = true;
      }

      if (message.type === 'result') {
        clearTimeout(timeout);
        console.log('✓ Query completed successfully!');
        console.log('  Cost: $' + (message.cost || 0).toFixed(4));
        console.log('  Duration: ' + (message.duration || 0) + 'ms');
        ws.close();
        resolve();
      }

      if (message.type === 'error') {
        clearTimeout(timeout);
        console.error('✗ Error from server:', message.error);
        ws.close();
        reject(new Error(message.error));
      }
    });

    ws.on('error', (error) => {
      clearTimeout(timeout);
      console.error('✗ WebSocket error:', error.message);
      reject(error);
    });

    ws.on('close', () => {
      console.log('WebSocket closed');
    });
  });
}

async function main() {
  try {
    console.log('Testing Claude Agent SDK integration...\n');

    const token = await registerOrLogin();
    const chatId = await createChat(token);
    await testAgent(token, chatId);

    console.log('\n✅ All tests passed! Agent is working correctly.');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

main();
