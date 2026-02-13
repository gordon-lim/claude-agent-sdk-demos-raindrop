import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import path from "path";
import { fileURLToPath } from "url";
import type { WSClient, IncomingWSMessage } from "./types.js";
import { chatStore } from "./db-chat-store.js";
import { Session } from "./session.js";
import { runMigrations } from "./run-migrations.js";
import { createUser, authenticateUser, getUserById, verifyToken } from "./auth.js";
import { requireAuth } from "./middleware/auth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3001;

// Run database migrations on startup
runMigrations();

// Express app
const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from client directory
app.use("/client", express.static(path.join(__dirname, "../client")));

// Serve index.html at root
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/index.html"));
});

// ========================================
// Authentication Endpoints
// ========================================

// Register new user
app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Basic validation
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const user = await createUser(username, email, password);
    const { generateToken } = await import("./auth.js");
    const token = generateToken(user.id, user.username);

    res.status(201).json({ user, token });
  } catch (error: any) {
    console.error("Registration error:", error);
    res.status(400).json({ error: error.message || "Registration failed" });
  }
});

// Login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Missing email or password" });
    }

    const result = await authenticateUser(email, password);

    if (!result) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    res.json(result);
  } catch (error: any) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

// Get current user
app.get("/api/auth/me", requireAuth, (req, res) => {
  const user = getUserById(req.userId!);

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  res.json(user);
});

// ========================================
// Chat Endpoints (Protected)
// ========================================

// Session management
const sessions: Map<string, Session> = new Map();

function getOrCreateSession(chatId: string): Session {
  let session = sessions.get(chatId);
  if (!session) {
    session = new Session(chatId);
    sessions.set(chatId, session);
  }
  return session;
}

// REST API: Get all chats
app.get("/api/chats", requireAuth, (req, res) => {
  const chats = chatStore.getAllChats(req.userId!);
  res.json(chats);
});

// REST API: Create new chat
app.post("/api/chats", requireAuth, (req, res) => {
  const chat = chatStore.createChat(req.userId!, req.body?.title);
  res.status(201).json(chat);
});

// REST API: Get single chat
app.get("/api/chats/:id", requireAuth, (req, res) => {
  const chat = chatStore.getChat(req.params.id, req.userId!);
  if (!chat) {
    return res.status(404).json({ error: "Chat not found" });
  }
  res.json(chat);
});

// REST API: Delete chat
app.delete("/api/chats/:id", requireAuth, (req, res) => {
  const deleted = chatStore.deleteChat(req.params.id, req.userId!);
  if (!deleted) {
    return res.status(404).json({ error: "Chat not found" });
  }
  const session = sessions.get(req.params.id);
  if (session) {
    session.close();
    sessions.delete(req.params.id);
  }
  res.json({ success: true });
});

// REST API: Get chat messages
app.get("/api/chats/:id/messages", requireAuth, (req, res) => {
  // Verify the chat belongs to the user
  const chat = chatStore.getChat(req.params.id, req.userId!);
  if (!chat) {
    return res.status(404).json({ error: "Chat not found" });
  }
  const messages = chatStore.getMessages(req.params.id);
  res.json(messages);
});

// Create HTTP server
const server = createServer(app);

// WebSocket server
const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws: WSClient) => {
  console.log("WebSocket client connected (unauthenticated)");
  ws.isAlive = true;
  ws.isAuthenticated = false;

  ws.send(JSON.stringify({ type: "connected", message: "Connected to chat server. Please authenticate." }));

  ws.on("pong", () => {
    ws.isAlive = true;
  });

  ws.on("message", (data) => {
    try {
      const message: IncomingWSMessage = JSON.parse(data.toString());

      // Handle authentication first
      if (message.type === "auth") {
        const payload = verifyToken(message.token);
        if (!payload) {
          ws.send(JSON.stringify({ type: "error", error: "Invalid token" }));
          ws.close();
          return;
        }

        ws.userId = payload.userId;
        ws.isAuthenticated = true;
        console.log(`WebSocket client authenticated as user ${payload.userId}`);
        ws.send(JSON.stringify({ type: "authenticated", userId: payload.userId }));
        return;
      }

      // All other messages require authentication
      if (!ws.isAuthenticated || !ws.userId) {
        ws.send(JSON.stringify({ type: "error", error: "Not authenticated" }));
        return;
      }

      switch (message.type) {
        case "subscribe": {
          // Verify the chat belongs to the user
          const chat = chatStore.getChat(message.chatId, ws.userId);
          if (!chat) {
            ws.send(JSON.stringify({ type: "error", error: "Chat not found or access denied" }));
            break;
          }

          const session = getOrCreateSession(message.chatId);
          session.subscribe(ws);
          console.log(`Client subscribed to chat ${message.chatId}`);

          // Send existing messages
          const messages = chatStore.getMessages(message.chatId);
          ws.send(JSON.stringify({
            type: "history",
            messages,
            chatId: message.chatId,
          }));
          break;
        }

        case "chat": {
          // Verify the chat belongs to the user
          const chat = chatStore.getChat(message.chatId, ws.userId);
          if (!chat) {
            ws.send(JSON.stringify({ type: "error", error: "Chat not found or access denied" }));
            break;
          }

          const session = getOrCreateSession(message.chatId);
          session.subscribe(ws);
          session.sendMessage(message.content);
          break;
        }

        default:
          console.warn("Unknown message type:", (message as any).type);
      }
    } catch (error) {
      console.error("Error handling WebSocket message:", error);
      ws.send(JSON.stringify({ type: "error", error: "Invalid message format" }));
    }
  });

  ws.on("close", () => {
    console.log("WebSocket client disconnected");
    // Unsubscribe from all sessions
    for (const session of sessions.values()) {
      session.unsubscribe(ws);
    }
  });
});

// Heartbeat to detect dead connections
const heartbeat = setInterval(() => {
  wss.clients.forEach((ws) => {
    const client = ws as WSClient;
    if (client.isAlive === false) {
      return client.terminate();
    }
    client.isAlive = false;
    client.ping();
  });
}, 30000);

wss.on("close", () => {
  clearInterval(heartbeat);
});

// Start server
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`WebSocket endpoint available at ws://localhost:${PORT}/ws`);
  console.log(`Visit http://localhost:${PORT} to view the chat interface`);
});
