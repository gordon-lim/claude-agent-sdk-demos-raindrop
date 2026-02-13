# Simple Chat App

A minimal chat application demonstrating the Claude Agent SDK with persistent storage and user authentication.

## Architecture

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Node.js + Express + WebSocket (ws)
- **Database**: SQLite with better-sqlite3
- **Authentication**: JWT-based auth with bcrypt password hashing
- **Agent**: Claude Agent SDK integrated directly on the server

## Running the App

### First Time Setup

1. Install dependencies:
```bash
cd simple-chatapp
npm install
```

2. Configure environment variables:
```bash
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
```

3. Start the application:
```bash
npm run dev
```

This starts both:
- Backend server on http://localhost:3006
- Vite dev server on http://localhost:5166

4. Visit http://localhost:5166 and create an account to get started!

## Project Structure

```
simple-chatapp/
├── client/                    # React frontend
│   ├── App.tsx               # Main app component
│   ├── index.tsx             # Entry point
│   ├── index.html            # HTML template
│   ├── globals.css           # Tailwind CSS
│   ├── components/
│   │   ├── ChatList.tsx      # Left sidebar with chat list
│   │   ├── ChatWindow.tsx    # Main chat interface
│   │   └── AuthScreen.tsx    # Login/register UI
│   ├── contexts/
│   │   └── AuthContext.tsx   # Auth context provider
│   └── hooks/
│       └── useWebSocket.ts   # WebSocket hook
├── server/
│   ├── server.ts             # Express server (REST + WebSocket)
│   ├── ai-client.ts          # Claude Agent SDK wrapper
│   ├── session.ts            # Chat session management
│   ├── db.ts                 # Database initialization
│   ├── db-chat-store.ts      # Database-backed chat storage
│   ├── auth.ts               # Authentication service
│   ├── run-migrations.ts     # Migration runner
│   ├── types.ts              # TypeScript types
│   ├── middleware/
│   │   └── auth.ts           # Auth middleware
│   └── migrations/
│       └── 001_initial_schema.sql  # Database schema
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
└── postcss.config.js
```

## API Endpoints

### Authentication Endpoints

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (requires auth)

### REST API (All require authentication)

- `GET /api/chats` - List all user's chats
- `POST /api/chats` - Create new chat
- `GET /api/chats/:id` - Get chat details
- `DELETE /api/chats/:id` - Delete chat
- `GET /api/chats/:id/messages` - Get chat messages

### WebSocket (`ws://localhost:3006/ws`)

**Client -> Server:**
- `{ type: "auth", token: string }` - Authenticate WebSocket connection (required first)
- `{ type: "subscribe", chatId: string }` - Subscribe to a chat
- `{ type: "chat", chatId: string, content: string }` - Send message

**Server -> Client:**
- `{ type: "connected" }` - Connection established
- `{ type: "authenticated", userId: string }` - Authentication successful
- `{ type: "history", messages: [...] }` - Chat history
- `{ type: "assistant_message", content: string }` - AI response
- `{ type: "tool_use", toolName: string, toolInput: {...} }` - Tool being used
- `{ type: "result", success: boolean }` - Query complete
- `{ type: "error", error: string }` - Error occurred

## Features

- **Persistent Storage**: SQLite database stores users, chats, and messages
- **User Authentication**: JWT-based authentication with bcrypt password hashing
- **User Isolation**: Each user can only access their own chats
- **Agent Context Restoration**: Conversation history is preserved across server restarts
- **WebSocket Authentication**: Secure WebSocket connections with token validation
- **Agent Tools**: Bash, Read, Write, Edit, Glob, Grep, WebSearch, WebFetch

## Database

The app uses SQLite for persistent storage:
- Database file: `./data/chatapp.db`
- Migrations: Automatically run on server startup
- Tables: `users`, `chats`, `messages`

## Security

- Passwords are hashed using bcrypt (10 rounds by default)
- JWT tokens expire after 7 days (configurable)
- All API endpoints require authentication except `/api/auth/register` and `/api/auth/login`
- WebSocket connections require authentication via token
- Users can only access their own chats and messages

## Known Limitations

1. **Agent Context Restoration**: When the server restarts, the agent can see conversation history in the system prompt but doesn't have full internal state from tool executions. For full context continuity, the user may need to provide additional context in new messages.

2. **Token Expiry**: JWT tokens expire after 7 days. Users must login again after expiry. No refresh token mechanism is implemented.

3. **Concurrent Access**: If a user opens the same chat in multiple tabs, both can send messages. Message order is preserved by timestamp.

## Development

- Uses Vite for frontend development with hot reload
- Uses tsx for TypeScript execution on the backend
- Database migrations are auto-applied on server startup
