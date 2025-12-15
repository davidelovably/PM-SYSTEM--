import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatMemoryState {
  [projectId: string]: Message[];
}

interface ChatMemoryContextType {
  getMessages: (projectId: string | null) => Message[];
  addMessage: (projectId: string | null, message: Message) => void;
  setMessages: (projectId: string | null, messages: Message[]) => void;
  clearMessages: (projectId: string | null) => void;
}

const ChatMemoryContext = createContext<ChatMemoryContextType | null>(null);

const GLOBAL_KEY = "__global__";

export function ChatMemoryProvider({ children }: { children: ReactNode }) {
  const [memory, setMemory] = useState<ChatMemoryState>({});

  const getKey = (projectId: string | null) => projectId || GLOBAL_KEY;

  const getMessages = useCallback((projectId: string | null): Message[] => {
    const key = getKey(projectId);
    return memory[key] || [];
  }, [memory]);

  const addMessage = useCallback((projectId: string | null, message: Message) => {
    const key = getKey(projectId);
    setMemory(prev => ({
      ...prev,
      [key]: [...(prev[key] || []), message]
    }));
  }, []);

  const setMessages = useCallback((projectId: string | null, messages: Message[]) => {
    const key = getKey(projectId);
    setMemory(prev => ({
      ...prev,
      [key]: messages
    }));
  }, []);

  const clearMessages = useCallback((projectId: string | null) => {
    const key = getKey(projectId);
    setMemory(prev => ({
      ...prev,
      [key]: []
    }));
  }, []);

  return (
    <ChatMemoryContext.Provider value={{ getMessages, addMessage, setMessages, clearMessages }}>
      {children}
    </ChatMemoryContext.Provider>
  );
}

export function useChatMemory() {
  const context = useContext(ChatMemoryContext);
  if (!context) {
    throw new Error("useChatMemory must be used within a ChatMemoryProvider");
  }
  return context;
}
