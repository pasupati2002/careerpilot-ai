
"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";

type ChatSummary = {
  _id: string;
  title: string;
  updatedAt?: string;
  createdAt?: string;
};

type ChatMessage = {
  _id?: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt?: string;
};

type ChatDetails = {
  _id: string;
  title: string;
  messages?: ChatMessage[];
};

type ChatListResponse = {
  chats?: ChatSummary[];
  data?: ChatSummary[] | { chats?: ChatSummary[] };
};

type ChatDetailsResponse = {
  chat?: ChatDetails;
  data?: ChatDetails;
  messages?: ChatMessage[];
};

type SendMessageResponse = {
  message?: ChatMessage;
  reply?: string | ChatMessage;
  chat?: ChatDetails;
  data?: {
    message?: ChatMessage;
    reply?: string | ChatMessage;
    chat?: ChatDetails;
  };
};

const SUGGESTIONS = [
  "How do I prepare for a job interview?",
  "Help me choose a career path",
  "How can I improve my resume?",
  "Create a roadmap to learn programming",
];

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Something went wrong. Please try again.";
}

function normalizeMarkdown(content: string): string {
  // Convert escaped Markdown markers such as \*\*bold\*\*
  // into Markdown syntax so they render correctly.
  return content.replace(/\\([\\`*_[\]{}()#+\-.!>|~])/g, "$1");
}

export default function ChatPage() {
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [creatingChat, setCreatingChat] = useState(false);
  const [error, setError] = useState("");
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const getToken = useCallback(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("careerpilot_token");
  }, []);

  const request = useCallback(
    async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
      const token = getToken();

      if (!token) {
        router.replace("/login");
        throw new Error("Your session has expired. Please log in again.");
      }

      return apiRequest<T>(path, {
        ...options,
        headers: {
          ...(options.headers || {}),
          Authorization: `Bearer ${token}`,
          ...(options.body ? { "Content-Type": "application/json" } : {}),
        },
      });
    },
    [getToken, router]
  );

  const loadChats = useCallback(async () => {
    setLoadingChats(true);
    setError("");

    try {
      const result = await request<ChatListResponse | ChatSummary[]>(
        "/api/chats"
      );

      let chatList: ChatSummary[] = [];

      if (Array.isArray(result)) {
        chatList = result;
      } else if (Array.isArray(result.chats)) {
        chatList = result.chats;
      } else if (Array.isArray(result.data)) {
        chatList = result.data;
      } else if (
        result.data &&
        !Array.isArray(result.data) &&
        Array.isArray(result.data.chats)
      ) {
        chatList = result.data.chats;
      }

      setChats(chatList);

      if (chatList.length === 0) {
        setActiveChatId(null);
        setMessages([]);
      } else {
        setActiveChatId((currentId) => {
          if (currentId && chatList.some((chat) => chat._id === currentId)) {
            return currentId;
          }
          return chatList[0]._id;
        });
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoadingChats(false);
    }
  }, [request]);

  const loadChat = useCallback(
    async (chatId: string) => {
      setLoadingMessages(true);
      setError("");

      try {
        const result = await request<ChatDetailsResponse | ChatDetails>(
          `/api/chats/${chatId}`
        );

        const wrapped = result as ChatDetailsResponse;
        const chat =
          wrapped.chat ||
          wrapped.data ||
          (result as ChatDetails);

        const chatMessages =
          chat.messages ||
          wrapped.messages ||
          [];

        setMessages(
          chatMessages.filter(
            (message) =>
              message.role === "user" || message.role === "assistant"
          )
        );

        if (chat.title) {
          setChats((current) =>
            current.map((item) =>
              item._id === chatId ? { ...item, title: chat.title } : item
            )
          );
        }
      } catch (err) {
        setError(getErrorMessage(err));
        setMessages([]);
      } finally {
        setLoadingMessages(false);
      }
    },
    [request]
  );

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }

    void loadChats();
  }, [getToken, loadChats, router]);

  useEffect(() => {
    if (activeChatId) {
      void loadChat(activeChatId);
    } else {
      setMessages([]);
      setLoadingMessages(false);
    }
  }, [activeChatId, loadChat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function createNewChat() {
    if (creatingChat) return;

    setCreatingChat(true);
    setError("");

    try {
      const result = await request<
        { chat?: ChatSummary; data?: { chat?: ChatSummary } } | ChatSummary
      >("/api/chats", {
        method: "POST",
        body: JSON.stringify({ title: "New Career Chat" }),
      });

      const wrapped = result as {
        chat?: ChatSummary;
        data?: { chat?: ChatSummary };
      };

      const newChat =
        wrapped.chat ||
        wrapped.data?.chat ||
        (result as ChatSummary);

      if (!newChat?._id) {
        await loadChats();
        setError("The chat was created, but its ID was not returned.");
        return;
      }

      setChats((current) => [
        newChat,
        ...current.filter((chat) => chat._id !== newChat._id),
      ]);
      setActiveChatId(newChat._id);
      setMessages([]);
      setInput("");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setCreatingChat(false);
    }
  }

  async function sendMessage(
    event?: FormEvent<HTMLFormElement>,
    suggestedMessage?: string
  ) {
    event?.preventDefault();

    const content = (suggestedMessage ?? input).trim();

    if (!content || sending) return;

    setError("");
    setInput("");

    let chatId = activeChatId;

    // Automatically create a conversation if none is selected.
    if (!chatId) {
      setCreatingChat(true);

      try {
        const result = await request<
          { chat?: ChatSummary; data?: { chat?: ChatSummary } } | ChatSummary
        >("/api/chats", {
          method: "POST",
          body: JSON.stringify({ title: content.slice(0, 45) }),
        });

        const wrapped = result as {
          chat?: ChatSummary;
          data?: { chat?: ChatSummary };
        };

        const newChat =
          wrapped.chat ||
          wrapped.data?.chat ||
          (result as ChatSummary);

        if (!newChat?._id) {
          throw new Error("Could not create a conversation.");
        }

        chatId = newChat._id;
        setChats((current) => [newChat, ...current]);
        setActiveChatId(newChat._id);
      } catch (err) {
        setError(getErrorMessage(err));
        setInput(content);
        setCreatingChat(false);
        return;
      } finally {
        setCreatingChat(false);
      }
    }

    const userMessage: ChatMessage = {
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };

    setMessages((current) => [...current, userMessage]);
    setSending(true);

    try {
      const result = await request<SendMessageResponse>(
        `/api/chats/${chatId}/messages`,
        {
          method: "POST",
          body: JSON.stringify({ content }),
        }
      );

      const wrapped = result as SendMessageResponse;
      const payload = wrapped.data || wrapped;

      let reply: ChatMessage | null = null;

      if (typeof payload.reply === "string") {
        reply = {
          role: "assistant",
          content: payload.reply,
          createdAt: new Date().toISOString(),
        };
      } else if (payload.reply && typeof payload.reply === "object") {
        reply = payload.reply;
      } else if (payload.message?.role === "assistant") {
        reply = payload.message;
      }

      if (reply) {
        setMessages((current) => [...current, reply!]);
      } else {
        // If the response format differs, reload the saved conversation.
        await loadChat(chatId);
      }

      if (payload.chat) {
        setChats((current) =>
          current.map((chat) =>
            chat._id === chatId
              ? { ...chat, title: payload.chat!.title || chat.title }
              : chat
          )
        );
      } else {
        setChats((current) => {
          const updated = current.map((chat) =>
            chat._id === chatId
              ? { ...chat, title: chat.title === "New Career Chat" ? content.slice(0, 45) : chat.title }
              : chat
          );
          return updated;
        });
      }

      // Refresh the chat list so server-generated titles/order stay current.
      void loadChats();
    } catch (err) {
      setError(getErrorMessage(err));
      // Keep the user's message visible; they can retry.
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  async function renameChat(chatId: string) {
    const title = editingTitle.trim();

    if (!title) {
      setEditingChatId(null);
      return;
    }

    try {
      const result = await request<{
        chat?: ChatSummary;
        data?: { chat?: ChatSummary };
      }>(`/api/chats/${chatId}`, {
        method: "PATCH",
        body: JSON.stringify({ title }),
      });

      const updatedChat =
        result.chat ||
        result.data?.chat;

      setChats((current) =>
        current.map((chat) =>
          chat._id === chatId
            ? { ...chat, title: updatedChat?.title || title }
            : chat
        )
      );

      setEditingChatId(null);
      setEditingTitle("");
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function deleteChat(chatId: string) {
    const confirmed = window.confirm(
      "Delete this conversation? This action cannot be undone."
    );

    if (!confirmed) return;

    try {
      await request(`/api/chats/${chatId}`, {
        method: "DELETE",
      });

      const remaining = chats.filter((chat) => chat._id !== chatId);
      setChats(remaining);

      if (activeChatId === chatId) {
        setActiveChatId(remaining[0]?._id || null);
        setMessages([]);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  function signOut() {
    localStorage.removeItem("careerpilot_token");
    router.replace("/login");
  }

  return (
    <main className="flex h-[100dvh] overflow-hidden bg-slate-950 text-slate-100">
      {/* Sidebar */}
      <aside className="flex w-72 shrink-0 flex-col border-r border-slate-800 bg-slate-900 max-md:w-20">
        <div className="border-b border-slate-800 p-4">
          <button
            onClick={() => router.push("/dashboard")}
            className="mb-5 flex items-center gap-2 text-left"
            title="Back to dashboard"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500 text-xl font-black text-slate-950">
              C
            </span>
            <span className="max-md:hidden">
              <span className="block text-lg font-bold">CareerPilot</span>
              <span className="block text-xs text-slate-400">AI Career Assistant</span>
            </span>
          </button>

          <button
            onClick={() => void createNewChat()}
            disabled={creatingChat}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-3 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50"
          >
            <span className="text-xl">+</span>
            <span className="max-md:hidden">
              {creatingChat ? "Creating..." : "New chat"}
            </span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <p className="mb-3 px-2 text-xs font-semibold uppercase tracking-wider text-slate-500 max-md:hidden">
            Recent conversations
          </p>

          {loadingChats ? (
            <p className="px-2 py-4 text-sm text-slate-400 max-md:hidden">
              Loading chats...
            </p>
          ) : chats.length === 0 ? (
            <p className="px-2 py-4 text-sm text-slate-400 max-md:hidden">
              No conversations yet. Start a new chat!
            </p>
          ) : (
            <div className="space-y-1">
              {chats.map((chat) => (
                <div
                  key={chat._id}
                  className={`group rounded-xl ${
                    activeChatId === chat._id
                      ? "bg-slate-800"
                      : "hover:bg-slate-800/70"
                  }`}
                >
                  {editingChatId === chat._id ? (
                    <form
                      className="p-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void renameChat(chat._id);
                      }}
                    >
                      <input
                        autoFocus
                        value={editingTitle}
                        onChange={(event) => setEditingTitle(event.target.value)}
                        className="w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-2 text-sm outline-none focus:border-cyan-400"
                      />
                      <div className="mt-2 flex gap-2">
                        <button
                          type="submit"
                          className="text-xs font-semibold text-cyan-400"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingChatId(null)}
                          className="text-xs text-slate-400"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex items-center gap-1 p-1">
                      <button
                        onClick={() => setActiveChatId(chat._id)}
                        title={chat.title}
                        className="min-w-0 flex-1 rounded-lg px-2 py-3 text-left text-sm"
                      >
                        <span className="mr-2">💬</span>
                        <span className="max-md:hidden">
                          {chat.title || "New Career Chat"}
                        </span>
                      </button>

                      <div className="flex opacity-0 transition group-hover:opacity-100 max-md:hidden">
                        <button
                          title="Rename conversation"
                          onClick={() => {
                            setEditingChatId(chat._id);
                            setEditingTitle(chat.title || "");
                          }}
                          className="rounded-lg p-2 text-xs text-slate-400 hover:text-cyan-400"
                        >
                          ✎
                        </button>
                        <button
                          title="Delete conversation"
                          onClick={() => void deleteChat(chat._id)}
                          className="rounded-lg p-2 text-xs text-slate-400 hover:text-red-400"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-slate-800 p-3">
          <button
            onClick={() => router.push("/dashboard")}
            className="w-full rounded-xl px-3 py-3 text-left text-sm text-slate-300 hover:bg-slate-800"
          >
            <span className="mr-2">⌂</span>
            <span className="max-md:hidden">Dashboard</span>
          </button>
          <button
            onClick={signOut}
            className="w-full rounded-xl px-3 py-3 text-left text-sm text-slate-300 hover:bg-slate-800"
          >
            <span className="mr-2">↪</span>
            <span className="max-md:hidden">Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main chat */}
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-800 bg-slate-950/90 px-5 py-4">
          <div>
            <h1 className="text-lg font-bold">AI Career Chat</h1>
            <p className="text-xs text-slate-400">
              Ask questions and plan your next career move
            </p>
          </div>
          <span className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            AI assistant
          </span>
        </header>

        {error && (
          <div
            role="alert"
            className="mx-auto mt-4 flex w-full max-w-4xl items-start justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
          >
            <span>{error}</span>
            <button
              onClick={() => setError("")}
              className="shrink-0 text-red-300 hover:text-white"
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 py-6">
          {loadingMessages ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-cyan-400" />
                <p className="text-sm text-slate-400">Loading conversation...</p>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="mx-auto flex min-h-full max-w-3xl flex-col items-center justify-center py-10 text-center">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-500/10 text-3xl">
                ✨
              </div>
              <h2 className="text-3xl font-bold tracking-tight">
                Your career journey starts here
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400 sm:text-base">
                I can help you explore career options, prepare for interviews,
                improve your resume, and build a learning roadmap.
              </p>

              <div className="mt-8 grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => void sendMessage(undefined, suggestion)}
                    disabled={sending || creatingChat}
                    className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-left text-sm text-slate-200 transition hover:border-cyan-500/50 hover:bg-slate-900/80 disabled:opacity-50"
                  >
                    <span className="mb-2 block text-lg">↗</span>
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-6">
              {messages.map((message, index) => (
                <div
                  key={`${message._id || message.createdAt || "message"}-${index}`}
                  className={`flex gap-3 ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {message.role === "assistant" && (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-500 font-bold text-slate-950">
                      C
                    </div>
                  )}

                  <div
                    className={`min-w-0 max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-7 sm:max-w-[80%] ${
                      message.role === "user"
                        ? "rounded-br-md bg-cyan-500 text-slate-950"
                        : "rounded-bl-md border border-slate-800 bg-slate-900 text-slate-200"
                    }`}
                  >
                    {message.role === "assistant" ? (
                      <div className="markdown-content break-words">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            p: ({ children }) => (
                              <p className="mb-3 last:mb-0">{children}</p>
                            ),
                            h1: ({ children }) => (
                              <h1 className="mb-3 mt-4 text-xl font-bold text-white first:mt-0">
                                {children}
                              </h1>
                            ),
                            h2: ({ children }) => (
                              <h2 className="mb-2 mt-4 text-lg font-bold text-white first:mt-0">
                                {children}
                              </h2>
                            ),
                            h3: ({ children }) => (
                              <h3 className="mb-2 mt-3 text-base font-bold text-white first:mt-0">
                                {children}
                              </h3>
                            ),
                            strong: ({ children }) => (
                              <strong className="font-bold text-white">
                                {children}
                              </strong>
                            ),
                            ul: ({ children }) => (
                              <ul className="mb-3 list-disc space-y-1 pl-6 last:mb-0">
                                {children}
                              </ul>
                            ),
                            ol: ({ children }) => (
                              <ol className="mb-3 list-decimal space-y-1 pl-6 last:mb-0">
                                {children}
                              </ol>
                            ),
                            li: ({ children }) => (
                              <li className="pl-1">{children}</li>
                            ),
                            blockquote: ({ children }) => (
                              <blockquote className="my-3 border-l-2 border-cyan-500 pl-4 text-slate-300">
                                {children}
                              </blockquote>
                            ),
                            a: ({ children, href }) => (
                              <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-cyan-400 underline underline-offset-2 hover:text-cyan-300"
                              >
                                {children}
                              </a>
                            ),
                            code: ({ children, className }) => (
                              <code
                                className={`rounded bg-slate-800 px-1.5 py-0.5 font-mono text-cyan-300 ${
                                  className || ""
                                }`}
                              >
                                {children}
                              </code>
                            ),
                            pre: ({ children }) => (
                              <pre className="my-3 overflow-x-auto rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs leading-5">
                                {children}
                              </pre>
                            ),
                            hr: () => (
                              <hr className="my-4 border-slate-700" />
                            ),
                            table: ({ children }) => (
                              <div className="my-3 overflow-x-auto">
                                <table className="w-full border-collapse text-left text-sm">
                                  {children}
                                </table>
                              </div>
                            ),
                            th: ({ children }) => (
                              <th className="border border-slate-700 bg-slate-800 px-3 py-2 font-semibold">
                                {children}
                              </th>
                            ),
                            td: ({ children }) => (
                              <td className="border border-slate-700 px-3 py-2">
                                {children}
                              </td>
                            ),
                          }}
                        >
                          {normalizeMarkdown(message.content)}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap break-words">
                        {message.content}
                      </p>
                    )}
                  </div>

                  {message.role === "user" && (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-700 text-sm font-bold">
                      You
                    </div>
                  )}
                </div>
              ))}

              {sending && (
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-500 font-bold text-slate-950">
                    C
                  </div>
                  <div className="rounded-2xl rounded-bl-md border border-slate-800 bg-slate-900 px-4 py-4">
                    <div className="flex gap-1.5">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-400 [animation-delay:-0.3s]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-400 [animation-delay:-0.15s]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-400" />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Message input */}
        <div className="border-t border-slate-800 bg-slate-950 px-4 py-4">
          <form
            onSubmit={(event) => void sendMessage(event)}
            className="mx-auto max-w-3xl"
          >
            <div className="flex items-end gap-3 rounded-2xl border border-slate-700 bg-slate-900 p-2 transition focus-within:border-cyan-500/70">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
                placeholder="Ask anything about your career..."
                rows={1}
                disabled={sending || creatingChat}
                className="max-h-40 min-h-11 flex-1 resize-y bg-transparent px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!input.trim() || sending || creatingChat}
                className="flex h-11 shrink-0 items-center justify-center rounded-xl bg-cyan-500 px-4 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {sending ? (
                  <span className="animate-pulse">...</span>
                ) : (
                  <>
                    <span className="mr-2 hidden sm:inline">Send</span>
                    <span aria-hidden="true">↑</span>
                  </>
                )}
              </button>
            </div>
            <p className="mt-2 text-center text-xs text-slate-500">
              AI can make mistakes. Verify important career and job-related information.
              Press Enter to send, Shift + Enter for a new line.
            </p>
          </form>
        </div>
      </section>
    </main>
  );
}
