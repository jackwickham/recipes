import { useState, useEffect, useRef } from "preact/hooks";
import type { ParsedRecipe } from "@recipes/shared";
import {
  getChatHistory,
  sendChatMessage,
  clearChatHistory,
  type ChatMessage,
} from "../api/client";
import { renderStepText } from "../utils/scaling";

interface Props {
  recipeId: number;
  recipeTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onSaveAsNew: (recipe: ParsedRecipe) => void;
  onSaveAsVariant: (recipe: ParsedRecipe) => void;
  onReplaceRecipe: (recipe: ParsedRecipe) => void;
  initialMessage?: string; // Pre-fill input with this message
  autoSendInitial?: boolean; // Auto-send the initial message
  autoSavePortionVariants?: boolean; // Auto-save portion variants when received
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
  initialMessage,
  autoSendInitial,
  autoSavePortionVariants,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingRecipes, setPendingRecipes] = useState<ParsedRecipe[]>([]);
  const [showPreviewIdx, setShowPreviewIdx] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasAutoSentRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      loadHistory();
      // Set initial message when opening
      if (initialMessage) {
        setInput(initialMessage);
        // Auto-send if requested (only once)
        if (autoSendInitial && !hasAutoSentRef.current) {
          hasAutoSentRef.current = true;
          // Small delay to ensure UI is ready
          setTimeout(() => handleSend(initialMessage), 100);
        }
      }
    } else {
      // Reset when closing
      hasAutoSentRef.current = false;
    }
  }, [isOpen, recipeId, initialMessage]);

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

  async function handleClearChat() {
    if (!confirm("Are you sure you want to clear the chat history?")) return;
    try {
      await clearChatHistory(recipeId);
      setMessages([]);
      setPendingRecipes([]);
      setShowPreviewIdx(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear chat");
    }
  }

  async function handleSend(message?: string) {
    const text = message || input.trim();
    if (!text || loading) return;

    setInput("");
    setError(null);
    setPendingRecipes([]);
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
          metadata:
            response.updatedRecipes.length > 0
              ? JSON.stringify(response.updatedRecipes)
              : null,
          createdAt: new Date().toISOString(),
        },
      ]);

      // Store pending recipes if returned
      if (response.updatedRecipes.length > 0) {
        setPendingRecipes(response.updatedRecipes);

        // Auto-save portion variants if requested
        if (autoSavePortionVariants) {
          response.updatedRecipes.forEach((recipe) => {
            if (recipe.variantType === "portion") {
              onSaveAsVariant(recipe);
            }
          });
        }
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
      <div
        class={`chat-modal ${pendingRecipes.length > 0 ? "has-pending" : ""} ${
          showPreviewIdx !== null ? "has-preview" : ""
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div class="chat-header">
          <h2>Chat about {recipeTitle}</h2>
          <div class="header-actions">
            {messages.length > 0 && (
              <button
                class="btn btn-small"
                onClick={handleClearChat}
                title="Start a fresh conversation"
              >
                New Chat
              </button>
            )}
            <button class="btn btn-small" onClick={onClose}>
              Close
            </button>
          </div>
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
                    onClick={() => setInput(prompt)}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, idx) => {
            let suggestedRecipes: ParsedRecipe[] = [];
            if (msg.role === "assistant" && msg.metadata) {
              try {
                const parsed = JSON.parse(msg.metadata);
                suggestedRecipes = Array.isArray(parsed) ? parsed : [parsed];
              } catch {
                // Ignore parse errors
              }
            }

            return (
              <div key={idx} class={`chat-message chat-message-${msg.role}`}>
                <div class="chat-message-content">
                  {msg.content}
                  {suggestedRecipes.length > 0 && (
                    <div class="chat-message-recipes">
                      {suggestedRecipes.map((recipe, rIdx) => (
                        <div key={rIdx} class="chat-message-recipe-badge">
                          <span class="recipe-icon">🍳</span>
                          <span class="recipe-title">{recipe.title}</span>
                          <button
                            class="btn btn-small"
                            onClick={() => setPendingRecipes([recipe])}
                          >
                            View
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {loading && (
            <div class="chat-message chat-message-assistant">
              <div class="chat-message-content chat-typing">Thinking...</div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {error && <div class="chat-error">{error}</div>}

        {pendingRecipes.length > 0 && (
          <div class="chat-recipes-pending">
            {pendingRecipes.map((recipe, idx) => (
              <div key={idx} class="chat-recipe-pending">
                <div class="chat-recipe-header">
                  <span class="chat-recipe-title">{recipe.title}</span>
                  <button
                    class={`btn btn-small ${showPreviewIdx === idx ? "active" : ""}`}
                    onClick={() =>
                      setShowPreviewIdx(showPreviewIdx === idx ? null : idx)
                    }
                  >
                    {showPreviewIdx === idx ? "Hide Preview" : "Preview"}
                  </button>
                </div>

                {showPreviewIdx === idx && (
                  <div class="chat-recipe-preview">
                    {recipe.description && (
                      <p class="chat-recipe-description">{recipe.description}</p>
                    )}

                    <div class="chat-recipe-meta">
                      {recipe.servings && <span>Serves {recipe.servings}</span>}
                      {recipe.prepTimeMinutes && (
                        <span>Prep: {recipe.prepTimeMinutes}m</span>
                      )}
                      {recipe.cookTimeMinutes && (
                        <span>Cook: {recipe.cookTimeMinutes}m</span>
                      )}
                    </div>

                    {recipe.ingredients.length > 0 && (
                      <div class="chat-recipe-section">
                        <h4>Ingredients</h4>
                        <ul>
                          {recipe.ingredients.map((ing, i) => (
                            <li key={i}>
                              {ing.quantity && `${ing.quantity} `}
                              {ing.unit && `${ing.unit} `}
                              {ing.name}
                              {ing.notes && ` (${ing.notes})`}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {recipe.steps.length > 0 && (
                      <div class="chat-recipe-section">
                        <h4>Method</h4>
                        <ol>
                          {recipe.steps.map((step, i) => {
                            // Handle both string format and object format
                            const instruction = typeof step === 'string' ? step : step.instruction;
                            return <li key={i}>{renderStepText(instruction)}</li>;
                          })}
                        </ol>
                      </div>
                    )}

                    {recipe.suggestedTags.length > 0 && (
                      <div class="chat-recipe-tags">
                        {recipe.suggestedTags.map((tag) => (
                          <span key={tag} class="tag-chip">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div class="chat-recipe-actions">
                  <button
                    class="btn btn-small btn-primary"
                    onClick={() => {
                      onSaveAsNew(recipe);
                      setPendingRecipes((prev) =>
                        prev.filter((_, i) => i !== idx)
                      );
                      setShowPreviewIdx(null);
                    }}
                  >
                    Save as New
                  </button>
                  <button
                    class="btn btn-small"
                    onClick={() => {
                      onSaveAsVariant(recipe);
                      setPendingRecipes((prev) =>
                        prev.filter((_, i) => i !== idx)
                      );
                      setShowPreviewIdx(null);
                    }}
                  >
                    Save as Variant
                  </button>
                  <button
                    class="btn btn-small btn-danger"
                    onClick={() => {
                      onReplaceRecipe(recipe);
                      setPendingRecipes((prev) =>
                        prev.filter((_, i) => i !== idx)
                      );
                      setShowPreviewIdx(null);
                    }}
                  >
                    Replace
                  </button>
                  <button
                    class="btn btn-small"
                    onClick={() => {
                      setPendingRecipes((prev) =>
                        prev.filter((_, i) => i !== idx)
                      );
                      setShowPreviewIdx(null);
                    }}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
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
