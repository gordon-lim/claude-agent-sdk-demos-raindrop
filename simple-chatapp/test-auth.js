// Quick test script to verify authentication and chat functionality
const API_BASE = 'http://localhost:3006/api';

async function test() {
  console.log('🧪 Testing authentication and chat...\n');

  try {
    // 1. Register a test user
    console.log('1️⃣  Registering test user...');
    const registerRes = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'testuser',
        email: `test${Date.now()}@example.com`,
        password: 'password123'
      })
    });

    if (!registerRes.ok) {
      const error = await registerRes.json();
      throw new Error(`Registration failed: ${error.error}`);
    }

    const { user, token } = await registerRes.json();
    console.log(`✅ Registered user: ${user.username} (${user.email})`);
    console.log(`   Token: ${token.substring(0, 20)}...\n`);

    // 2. Verify token works
    console.log('2️⃣  Verifying token...');
    const meRes = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!meRes.ok) {
      throw new Error('Token verification failed');
    }

    const currentUser = await meRes.json();
    console.log(`✅ Token valid for user: ${currentUser.username}\n`);

    // 3. Create a chat
    console.log('3️⃣  Creating a new chat...');
    const chatRes = await fetch(`${API_BASE}/chats`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    });

    if (!chatRes.ok) {
      throw new Error('Failed to create chat');
    }

    const chat = await chatRes.json();
    console.log(`✅ Created chat: ${chat.id}\n`);

    // 4. Get all chats
    console.log('4️⃣  Fetching all chats...');
    const chatsRes = await fetch(`${API_BASE}/chats`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!chatsRes.ok) {
      throw new Error('Failed to fetch chats');
    }

    const chats = await chatsRes.json();
    console.log(`✅ Found ${chats.length} chat(s)\n`);

    // 5. Test WebSocket connection
    console.log('5️⃣  Testing WebSocket connection...');
    const WebSocket = (await import('ws')).default;
    const ws = new WebSocket('ws://localhost:3006/ws');

    await new Promise((resolve, reject) => {
      let authenticated = false;

      ws.on('open', () => {
        console.log('   WebSocket connected');
      });

      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        console.log(`   Received: ${message.type}`);

        if (message.type === 'connected') {
          // Send auth
          ws.send(JSON.stringify({ type: 'auth', token }));
        } else if (message.type === 'authenticated') {
          console.log(`✅ WebSocket authenticated`);
          authenticated = true;
          ws.close();
          resolve();
        } else if (message.type === 'error') {
          reject(new Error(message.error));
        }
      });

      ws.on('error', (error) => {
        reject(error);
      });

      ws.on('close', () => {
        if (authenticated) {
          resolve();
        }
      });

      setTimeout(() => reject(new Error('WebSocket timeout')), 5000);
    });

    console.log('\n✅ All tests passed! Authentication and chat system working correctly.');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

test();
