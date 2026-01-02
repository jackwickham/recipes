import { useState, useEffect, useRef } from "preact/hooks";
import type { ParsedRecipe } from "@recipes/shared";
import {
  getChatHistory,
  sendChatMessage,
  type ChatMessage,
} from "../api/client";

interface Props {
  recipeId: number;
  recipeTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onSaveAsNew: (recipe: ParsedRecipe) => void;
  onSaveAsVariant: (recipe: ParsedRecipe) => void;
  onReplaceRecipe: (recipe: ParsedRecipe) => void;
}

const SUGGESTION_PROMPTS = [
  "What can I substitute for...",
  "Make this vegetarian",
  "Make this vegan",
  "Double the quantities",
  "Halve the quantities",
];

export function ChatModal({
  recipeId,
  recipeTitle,
  isOpen,
  onClose,
  onSaveAsNew,
  onSaveAsVariant,
  onReplaceRecipe,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingRecipe, setPendingRecipe] = useState<ParsedRecipe | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen, recipeId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadHistory() {
    try {
      const history = await getChatHistory(recipeId);
      setMessages(history);
    } catch {
      // Ignore history loading errors
    }
  }

  async function handleSend(message?: string) {
    const text = message || input.trim();
    if (!text || loading) return;

    setInput("");
    setError(null);
    setPendingRecipe(null);
    setLoading(true);

    // Optimistically add user message
    setMessages((prev) => [
      ...prev,
      { role: "user", content: text, createdAt: new Date().toISOString() },
    ]);

    try {
      const response = await sendChatMessage(recipeId, text);

      // Add assistant message
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: response.message,
          createdAt: new Date().toISOString(),
        },
      ]);

      // Store pending recipe if returned
      if (response.updatedRecipe) {
        setPendingRecipe(response.updatedRecipe);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  if (!isOpen) return null;

  return (
    <div class="chat-overlay" onClick={onClose}>
      <div class="chat-modal" onClick={(e) => e.stopPropagation()}>
        <div class="chat-header">
          <h2>Chat about {recipeTitle}</h2>
          <button class="btn btn-small" onClick={onClose}>
            Close
          </button>
        </div>

        <div class="chat-messages">
          {messages.length === 0 && !loading && (
            <div class="chat-empty">
              <p>Ask questions about this recipe or request modifications.</p>
              <div class="chat-suggestions">
                {SUGGESTION_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    class="chat-suggestion"
                    onClick={() => handleSend(prompt)}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div
              key={idx}
              class={`chat-message chat-message-${msg.role}`}
            >
              <div class="chat-message-content">{msg.content}</div>
            </div>
          ))}

          {loading && (
            <div class="chat-message chat-message-assistant">
              <div class="chat-message-content chat-typing">Thinking...</div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {error && <div class="chat-error">{error}</div>}

        {pendingRecipe && (
          <div class="chat-recipe-actions">
            <span>Recipe modifications ready:</span>
            <button
              class="btn btn-small btn-primary"
              onClick={() => {
                onSaveAsNew(pendingRecipe);
                setPendingRecipe(null);
              }}
            >
              Save as New
            </button>
            <button
              class="btn btn-small"
              onClick={() => {
                onSaveAsVariant(pendingRecipe);
                setPendingRecipe(null);
              }}
            >
              Save as Variant
            </button>
            <button
              class="btn btn-small btn-danger"
              onClick={() => {
                onReplaceRecipe(pendingRecipe);
                setPendingRecipe(null);
              }}
            >
              Replace Recipe
            </button>
          </div>
        )}

        <div class="chat-input-container">
          <textarea
            class="chat-input"
            value={input}
            onInput={(e) => setInput(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this recipe..."
            rows={2}
            disabled={loading}
          />
          <button
            class="btn btn-primary"
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
