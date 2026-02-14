import { useState, useEffect, useCallback } from "react";
import useWebSocket, { ReadyState } from "react-use-websocket";
import { ChatList } from "./components/ChatList";
import { ChatWindow } from "./components/ChatWindow";
import { AuthScreen } from "./components/AuthScreen";
import { useAuth } from "./contexts/AuthContext";

interface Chat {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface Message {
  id: string;
  role: "user" | "assistant" | "tool_use";
  content: string;
  timestamp: string;
  toolName?: string;
  toolInput?: Record<string, any>;
}

// Use relative URLs - Vite will proxy to the backend
const API_BASE = "/api";
const WS_URL = `ws://${window.location.hostname}:3006/ws`;

export default function App() {
  const { user, token, isLoading: authLoading, logout } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [wsAuthenticated, setWsAuthenticated] = useState(false);

  // Setup WebSocket - only connect when user is authenticated
  const { sendJsonMessage, readyState, lastJsonMessage } = useWebSocket(
    user && token ? WS_URL : null,
    {
      shouldReconnect: () => !!(user && token),
      reconnectAttempts: 10,
      reconnectInterval: 3000,
    }
  );

  const isConnected = readyState === ReadyState.OPEN;

  // Fetch all chats
  const fetchChats = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/chats`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      setChats(data);
    } catch (error) {
      console.error("Failed to fetch chats:", error);
    }
  }, [token]);

  // Handle WebSocket messages
  const handleWSMessage = useCallback((message: any) => {
    switch (message.type) {
      case "connected":
        console.log("Connected to server");
        // Send authentication
        if (token) {
          sendJsonMessage({ type: "auth", token });
        }
        break;

      case "authenticated":
        console.log("WebSocket authenticated");
        setWsAuthenticated(true);
        // If there's a selected chat, resubscribe to it
        if (selectedChatId) {
          sendJsonMessage({ type: "subscribe", chatId: selectedChatId });
        }
        break;

      case "history":
        setMessages(message.messages || []);
        break;

      case "user_message":
        // User message already added locally
        break;

      case "assistant_message":
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: message.content,
            timestamp: new Date().toISOString(),
          },
        ]);
        setIsLoading(false);
        break;

      case "tool_use":
        // Add tool use to messages array so it persists
        // Alternative: To show tool uses only while pending, store them in a
        // separate `pendingToolUses` state and clear it on "assistant_message" or "result"
        setMessages((prev) => [
          ...prev,
          {
            id: message.toolId,
            role: "tool_use",
            content: "",
            timestamp: new Date().toISOString(),
            toolName: message.toolName,
            toolInput: message.toolInput,
          },
        ]);
        break;

      case "result":
        setIsLoading(false);
        // Refresh chat list to get updated titles
        fetchChats();
        break;

      case "interrupted":
        console.log("[FRONTEND] Received interrupted message:", message.message);
        setIsLoading(false);
        // Optionally add a system message to show the query was stopped
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: "⚠️ Query interrupted by user",
            timestamp: new Date().toISOString(),
          },
        ]);
        break;

      case "error":
        console.error("Server error:", message.error);
        setIsLoading(false);
        // Clear selected chat if access denied
        if (message.error?.includes("Chat not found") || message.error?.includes("access denied")) {
          setSelectedChatId(null);
          setMessages([]);
        }
        break;
    }
  }, [token, sendJsonMessage, fetchChats, selectedChatId]);

  // Handle incoming WebSocket messages
  useEffect(() => {
    if (lastJsonMessage) {
      handleWSMessage(lastJsonMessage);
    }
  }, [lastJsonMessage, handleWSMessage]);

  // Create new chat
  const createChat = async () => {
    try {
      const res = await fetch(`${API_BASE}/chats`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const chat = await res.json();
      setChats((prev) => [chat, ...prev]);
      selectChat(chat.id);
    } catch (error) {
      console.error("Failed to create chat:", error);
    }
  };

  // Delete chat
  const deleteChat = async (chatId: string) => {
    try {
      await fetch(`${API_BASE}/chats/${chatId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setChats((prev) => prev.filter((c) => c.id !== chatId));
      if (selectedChatId === chatId) {
        setSelectedChatId(null);
        setMessages([]);
      }
    } catch (error) {
      console.error("Failed to delete chat:", error);
    }
  };

  // Select a chat
  const selectChat = (chatId: string) => {
    // Verify chat exists in user's chat list
    const chatExists = chats.some(c => c.id === chatId);
    if (!chatExists) {
      console.warn(`Chat ${chatId} not found in user's chats`);
      return;
    }

    setSelectedChatId(chatId);
    setMessages([]);
    setIsLoading(false);

    // Subscribe to chat via WebSocket if connected and authenticated
    if (isConnected && wsAuthenticated) {
      sendJsonMessage({ type: "subscribe", chatId });
    }
  };

  // Send a message
  const handleSendMessage = (content: string) => {
    if (!selectedChatId || !isConnected || !wsAuthenticated) return;

    // Add message optimistically
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "user",
        content,
        timestamp: new Date().toISOString(),
      },
    ]);

    setIsLoading(true);

    // Send via WebSocket
    sendJsonMessage({
      type: "chat",
      content,
      chatId: selectedChatId,
    });
  };

  // Interrupt current query
  const handleInterrupt = () => {
    console.log('[FRONTEND] handleInterrupt called', {
      selectedChatId,
      isConnected,
      wsAuthenticated
    });

    if (!selectedChatId || !isConnected || !wsAuthenticated) {
      console.log('[FRONTEND] Not sending interrupt - conditions not met');
      return;
    }

    console.log("[FRONTEND] Sending interrupt message via WebSocket for chat:", selectedChatId);

    // Send interrupt message via WebSocket
    sendJsonMessage({
      type: "interrupt",
      chatId: selectedChatId,
    });

    console.log('[FRONTEND] Interrupt message sent');
  };

  // Clear state when user changes
  useEffect(() => {
    setChats([]);
    setSelectedChatId(null);
    setMessages([]);
    setWsAuthenticated(false);
  }, [user?.id]);

  // Initial fetch
  useEffect(() => {
    if (user && token) {
      fetchChats();
    }
  }, [user, token, fetchChats]);

  // Show loading screen
  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show auth screen if not logged in
  if (!user || !token) {
    return <AuthScreen />;
  }

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className="w-64 shrink-0">
        <ChatList
          chats={chats}
          selectedChatId={selectedChatId}
          onSelectChat={selectChat}
          onNewChat={createChat}
          onDeleteChat={deleteChat}
        />
      </div>

      {/* Main chat area */}
      <ChatWindow
        chatId={selectedChatId}
        messages={messages}
        isConnected={isConnected && wsAuthenticated}
        isLoading={isLoading}
        onSendMessage={handleSendMessage}
        onInterrupt={handleInterrupt}
      />

      {/* User menu */}
      <div className="absolute top-4 right-4 flex items-center gap-3 bg-white px-4 py-2 rounded-lg shadow-md">
        <span className="text-sm text-gray-700">
          {user.username}
        </span>
        <button
          onClick={logout}
          className="text-sm text-red-600 hover:text-red-700 font-medium"
        >
          Logout
        </button>
      </div>
    </div>
  );
}
