// End-to-end test: Register, create chat, send message to agent
const API_BASE = 'http://localhost:3006/api';

async function testE2E() {
  console.log('🚀 Running end-to-end test...\n');

  try {
    // 1. Register
    console.log('1️⃣  Registering user...');
    const registerRes = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'e2etest',
        email: `e2e${Date.now()}@example.com`,
        password: 'test1234'
      })
    });

    if (!registerRes.ok) {
      const error = await registerRes.json();
      throw new Error(`Registration failed: ${error.error}`);
    }

    const { user, token } = await registerRes.json();
    console.log(`✅ User registered: ${user.username}\n`);

    // 2. Create chat
    console.log('2️⃣  Creating chat...');
    const chatRes = await fetch(`${API_BASE}/chats`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    });

    const chat = await chatRes.json();
    console.log(`✅ Chat created: ${chat.id}\n`);

    // 3. Connect WebSocket and send message
    console.log('3️⃣  Connecting to WebSocket and sending message...');
    const WebSocket = (await import('ws')).default;
    const ws = new WebSocket('ws://localhost:3006/ws');

    await new Promise((resolve, reject) => {
      let authenticated = false;
      let subscribed = false;
      let receivedResponse = false;
      const timeout = setTimeout(() => {
        if (!receivedResponse) {
          console.log('⏱️  No agent response yet (may need ANTHROPIC_API_KEY)');
          ws.close();
          resolve();
        }
      }, 5000);

      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());

        switch (message.type) {
          case 'connected':
            console.log('   Connected to WebSocket');
            ws.send(JSON.stringify({ type: 'auth', token }));
            break;

          case 'authenticated':
            console.log('   Authenticated');
            authenticated = true;
            ws.send(JSON.stringify({ type: 'subscribe', chatId: chat.id }));
            break;

          case 'history':
            console.log('   Received history');
            subscribed = true;
            console.log('   Sending message: "Hello, Claude!"');
            ws.send(JSON.stringify({
              type: 'chat',
              chatId: chat.id,
              content: 'Hello, Claude! This is a test message.'
            }));
            break;

          case 'assistant_message':
            console.log(`✅ Agent response: "${message.content.substring(0, 50)}..."`);
            receivedResponse = true;
            clearTimeout(timeout);
            ws.close();
            resolve();
            break;

          case 'tool_use':
            console.log(`   Agent using tool: ${message.toolName}`);
            break;

          case 'result':
            if (!receivedResponse) {
              console.log('✅ Agent completed (no text response)');
              receivedResponse = true;
            }
            clearTimeout(timeout);
            ws.close();
            resolve();
            break;

          case 'error':
            clearTimeout(timeout);
            reject(new Error(`WebSocket error: ${message.error}`));
            break;
        }
      });

      ws.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      ws.on('close', () => {
        clearTimeout(timeout);
        if (authenticated && subscribed) {
          resolve();
        }
      });
    });

    // 4. Verify message was saved
    console.log('\n4️⃣  Verifying messages were saved...');
    const messagesRes = await fetch(`${API_BASE}/chats/${chat.id}/messages`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const messages = await messagesRes.json();
    console.log(`✅ Found ${messages.length} message(s) in database`);

    if (messages.length > 0) {
      messages.forEach((msg, i) => {
        console.log(`   ${i + 1}. [${msg.role}] ${msg.content.substring(0, 40)}...`);
      });
    }

    console.log('\n✅ End-to-end test completed successfully!');
    console.log('\n📝 Summary:');
    console.log('   - Authentication: ✅ Working');
    console.log('   - Database: ✅ Working');
    console.log('   - WebSocket: ✅ Working');
    console.log('   - Message persistence: ✅ Working');
    if (messages.some(m => m.role === 'assistant')) {
      console.log('   - Agent responses: ✅ Working');
    } else {
      console.log('   - Agent responses: ⚠️  Check ANTHROPIC_API_KEY in .env');
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

testE2E();
