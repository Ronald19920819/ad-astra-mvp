"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type LiveClassMessage = {
  id: string;
  subjectId: string;
  senderProfileId: string;
  senderRole: "learner" | "teacher";
  senderDisplayName: string;
  message: string;
  createdAt: string;
};

type PresenceIdentity = {
  profileId: string;
  displayName: string;
  role: "learner" | "teacher";
};

type PresenceEntry = PresenceIdentity & {
  joinedAt: string;
};

type ConnectionState = "connected" | "reconnecting" | "unavailable";

type RealtimeMessageRow = {
  id: string;
  subject_id: string;
  sender_profile_id: string;
  sender_role: "learner" | "teacher";
  sender_display_name: string;
  message: string;
  created_at: string;
  deleted_at?: string | null;
};

type BufferedRealtimeEvent =
  | { kind: "insert"; row: RealtimeMessageRow }
  | { kind: "update"; row: RealtimeMessageRow };

function formatTimestamp(createdAt: string) {
  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-ZA", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  }).format(date);
}

function isNearBottom(element: HTMLElement) {
  return element.scrollHeight - element.scrollTop - element.clientHeight < 80;
}

function sortMessagesChronologically(messages: LiveClassMessage[]) {
  return [...messages].sort(
    (left, right) =>
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
  );
}

function mapRealtimeRow(row: RealtimeMessageRow): LiveClassMessage {
  return {
    id: row.id,
    subjectId: row.subject_id,
    senderProfileId: row.sender_profile_id,
    senderRole: row.sender_role,
    senderDisplayName: row.sender_display_name,
    message: row.message,
    createdAt: row.created_at,
  };
}

function applyRealtimeEvent(
  current: LiveClassMessage[],
  event: BufferedRealtimeEvent,
  subjectId: string,
) {
  if (event.row.subject_id !== subjectId) {
    return current;
  }

  if (event.kind === "insert") {
    if (event.row.deleted_at) return current;

    const nextMessage = mapRealtimeRow(event.row);
    if (current.some((message) => message.id === nextMessage.id)) {
      return current;
    }

    return sortMessagesChronologically([...current, nextMessage]);
  }

  if (event.row.deleted_at) {
    return current.filter((message) => message.id !== event.row.id);
  }

  const nextMessage = mapRealtimeRow(event.row);
  let found = false;

  const nextMessages = current.map((message) => {
    if (message.id !== nextMessage.id) return message;
    found = true;
    return nextMessage;
  });

  if (!found) {
    nextMessages.push(nextMessage);
  }

  return sortMessagesChronologically(nextMessages);
}

function mergeFetchedMessages(
  fetchedMessages: LiveClassMessage[],
  bufferedEvents: BufferedRealtimeEvent[],
  subjectId: string,
) {
  return bufferedEvents.reduce(
    (current, event) => applyRealtimeEvent(current, event, subjectId),
    sortMessagesChronologically(fetchedMessages),
  );
}

function countUniqueLearners(entries: PresenceEntry[][]) {
  const learnerIds = new Set<string>();

  for (const group of entries) {
    for (const presence of group) {
      if (presence.role === "learner") {
        learnerIds.add(presence.profileId);
      }
    }
  }

  return learnerIds.size;
}

export function LiveClassChatPanel({
  subjectId,
  subjectColour,
  subjectSoftBackground,
  presenceIdentity,
  messagePlaceholder = "Ask your teacher...",
  showLearnerPresenceList = false,
  composerVariant = "default",
}: {
  subjectId: string;
  subjectColour: string;
  subjectSoftBackground: string;
  presenceIdentity: PresenceIdentity;
  messagePlaceholder?: string;
  showLearnerPresenceList?: boolean;
  composerVariant?: "default" | "teacher";
}) {
  const [messages, setMessages] = useState<LiveClassMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [sendError, setSendError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [didInitialLoad, setDidInitialLoad] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>("connected");
  const [learnerPresenceCount, setLearnerPresenceCount] = useState(0);
  const [learnerPresenceNames, setLearnerPresenceNames] = useState<string[]>([]);

  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const shouldStickToBottomRef = useRef(true);
  const supabaseRef = useRef(createClient());
  const bufferedEventsRef = useRef<BufferedRealtimeEvent[]>([]);
  const initialLoadCompleteRef = useRef(false);
  const isMountedRef = useRef(true);
  const reconnectRecoveryInFlightRef = useRef(false);
  const wasEverSubscribedRef = useRef(false);
  const isTrackedRef = useRef(false);

  const remainingCharacters = useMemo(() => 500 - draft.length, [draft.length]);
  const connectionNotice = useMemo(() => {
    if (connectionState === "reconnecting") {
      return "Reconnecting to Live Chat...";
    }

    if (connectionState === "unavailable") {
      return "Live updates are temporarily unavailable. Messages can still be sent.";
    }

    return "";
  }, [connectionState]);
  const presenceLabel = useMemo(() => {
    if (learnerPresenceCount === 0) return "No learners currently present";
    if (learnerPresenceCount === 1) return "1 learner present";
    return `${learnerPresenceCount} learners present`;
  }, [learnerPresenceCount]);
  const isTeacherComposer = composerVariant === "teacher";

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const container = messagesContainerRef.current;
    if (!container) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior,
    });
  }, []);

  const fetchLatestMessages = useCallback(
    async (options?: { showLoading?: boolean; recovery?: boolean }) => {
      const showLoading = options?.showLoading ?? false;
      const recovery = options?.recovery ?? false;

      if (showLoading) {
        setIsLoading(true);
        setLoadError("");
      }

      const response = await fetch(
        `/api/live-class/messages?subjectId=${encodeURIComponent(subjectId)}`,
        {
          method: "GET",
          credentials: "same-origin",
        },
      );

      const result = (await response.json()) as
        | { messages?: LiveClassMessage[]; error?: string }
        | null;

      if (!response.ok) {
        throw new Error(result?.error || "Live Chat is temporarily unavailable.");
      }

      const fetchedMessages = Array.isArray(result?.messages) ? result.messages : [];
      const bufferedEvents = bufferedEventsRef.current;
      bufferedEventsRef.current = [];

      const nextMessages = mergeFetchedMessages(
        fetchedMessages,
        bufferedEvents,
        subjectId,
      );

      if (!isMountedRef.current) return;

      setMessages(nextMessages);
      setDidInitialLoad(true);
      initialLoadCompleteRef.current = true;
      shouldStickToBottomRef.current = true;
      if (showLoading || recovery) {
        setLoadError("");
      }
    },
    [subjectId],
  );

  useEffect(() => {
    isMountedRef.current = true;

    async function loadInitialMessages() {
      try {
        await fetchLatestMessages({ showLoading: true });
      } catch (error) {
        if (!isMountedRef.current) return;

        setLoadError(
          error instanceof Error && error.message
            ? error.message
            : "Live Chat is temporarily unavailable.",
        );
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    }

    void loadInitialMessages();

    return () => {
      isMountedRef.current = false;
    };
  }, [fetchLatestMessages, subjectId]);

  useEffect(() => {
    if (!didInitialLoad) return;
    scrollToBottom("auto");
  }, [didInitialLoad, scrollToBottom]);

  useEffect(() => {
    if (!shouldStickToBottomRef.current) return;
    scrollToBottom(messages.length > 0 ? "smooth" : "auto");
  }, [messages, scrollToBottom]);

  useEffect(() => {
    const supabase = supabaseRef.current;
    const channel = supabase.channel(`live-class:${subjectId}`, {
      config: {
        presence: {
          key: presenceIdentity.profileId,
        },
      },
    });

    initialLoadCompleteRef.current = false;
    bufferedEventsRef.current = [];
    reconnectRecoveryInFlightRef.current = false;
    isTrackedRef.current = false;
    queueMicrotask(() => {
      if (!isMountedRef.current) return;
      setConnectionState("reconnecting");
      setLearnerPresenceCount(0);
      setLearnerPresenceNames([]);
    });

    const handlePresenceSync = () => {
      const presenceState = channel.presenceState<PresenceEntry>();
      const learnerEntries = Object.values(presenceState)
        .flat()
        .filter((entry) => entry.role === "learner");
      const learnersByProfileId = new Map<string, string>();

      for (const learnerEntry of learnerEntries) {
        if (!learnersByProfileId.has(learnerEntry.profileId)) {
          learnersByProfileId.set(learnerEntry.profileId, learnerEntry.displayName);
        }
      }

      const learnerCount = countUniqueLearners(Object.values(presenceState));
      const learnerNames = [...learnersByProfileId.values()].sort((left, right) =>
        left.localeCompare(right, "en-ZA", { sensitivity: "base" }),
      );

      setLearnerPresenceCount(learnerCount);
      setLearnerPresenceNames(learnerNames);
    };

    channel
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "live_class_messages",
          filter: `subject_id=eq.${subjectId}`,
        },
        (payload) => {
          const row = payload.new as RealtimeMessageRow;
          if (!row?.id || row.subject_id !== subjectId || row.deleted_at) return;

          const event: BufferedRealtimeEvent = { kind: "insert", row };

          if (!initialLoadCompleteRef.current) {
            bufferedEventsRef.current.push(event);
            return;
          }

          setMessages((current) => applyRealtimeEvent(current, event, subjectId));
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "live_class_messages",
          filter: `subject_id=eq.${subjectId}`,
        },
        (payload) => {
          const row = payload.new as RealtimeMessageRow;
          if (!row?.id || row.subject_id !== subjectId) return;

          const event: BufferedRealtimeEvent = { kind: "update", row };

          if (!initialLoadCompleteRef.current) {
            bufferedEventsRef.current.push(event);
            return;
          }

          setMessages((current) => applyRealtimeEvent(current, event, subjectId));
        },
      )
      .on("presence", { event: "sync" }, handlePresenceSync);

    void channel.subscribe(async (status) => {
      if (!isMountedRef.current) return;

      if (status === "SUBSCRIBED") {
        setConnectionState("connected");

        if (!isTrackedRef.current) {
          isTrackedRef.current = true;
          await channel.track({
            profileId: presenceIdentity.profileId,
            displayName: presenceIdentity.displayName,
            role: presenceIdentity.role,
            joinedAt: new Date().toISOString(),
          } satisfies PresenceEntry);
        }

        if (wasEverSubscribedRef.current && !reconnectRecoveryInFlightRef.current) {
          reconnectRecoveryInFlightRef.current = true;

          try {
            await fetchLatestMessages({ recovery: true });
          } catch (error) {
            if (isMountedRef.current) {
              console.error("Live Chat recovery fetch failed:", {
                subjectId,
                message:
                  error instanceof Error ? error.message : "Unknown error",
              });
              setConnectionState("unavailable");
            }
          } finally {
            reconnectRecoveryInFlightRef.current = false;
          }
        }

        wasEverSubscribedRef.current = true;
        return;
      }

      if (status === "TIMED_OUT") {
        setConnectionState("reconnecting");
        return;
      }

      if (status === "CHANNEL_ERROR") {
        setConnectionState("unavailable");
        return;
      }

      if (status === "CLOSED") {
        setConnectionState("reconnecting");
      }
    });

    return () => {
      bufferedEventsRef.current = [];
      initialLoadCompleteRef.current = false;
      reconnectRecoveryInFlightRef.current = false;
      setLearnerPresenceCount(0);
      setLearnerPresenceNames([]);
      void supabase.removeChannel(channel);
    };
  }, [fetchLatestMessages, presenceIdentity.displayName, presenceIdentity.profileId, presenceIdentity.role, subjectId]);

  async function handleSubmit() {
    if (isSending) return;

    const trimmed = draft.trim();
    if (!trimmed) {
      setSendError("Please enter a message before sending.");
      return;
    }

    if (trimmed.length > 500) {
      setSendError("Messages must be 500 characters or fewer.");
      return;
    }

    setIsSending(true);
    setSendError("");
    shouldStickToBottomRef.current = true;

    try {
      const response = await fetch("/api/live-class/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          subjectId,
          message: trimmed,
        }),
      });

      const result = (await response.json()) as
        | { message?: LiveClassMessage; error?: string }
        | null;

      if (!response.ok) {
        throw new Error(result?.error || "Unable to send message. Please try again.");
      }

      const savedMessage = result?.message;
      if (savedMessage) {
        setMessages((current) => {
          if (current.some((message) => message.id === savedMessage.id)) {
            return current;
          }

          return [...current, savedMessage];
        });
      }

      setDraft("");
    } catch (error) {
      setSendError(
        error instanceof Error && error.message
          ? error.message
          : "Unable to send message. Please try again.",
      );
    } finally {
      setIsSending(false);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSubmit();
    }
  }

  return (
    <section
      aria-label="Live Chat"
      className="flex min-h-[26rem] min-w-0 flex-col rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm lg:h-[32rem]"
    >
      <div className="mb-4 flex shrink-0 items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
        <div
          className="rounded-2xl p-3"
          style={{
            backgroundColor: subjectSoftBackground,
            color: subjectColour,
          }}
        >
          <MessageCircle size={20} />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-[#102A43]">Live Chat</h2>
          <p className="text-sm text-slate-500">
            Ask questions and follow the lesson conversation.
          </p>
        </div>
        </div>
        <p
          aria-live="polite"
          className="shrink-0 text-right text-xs font-semibold text-slate-500"
        >
          {presenceLabel}
        </p>
      </div>

      {showLearnerPresenceList && learnerPresenceNames.length > 0 ? (
        <div className="mb-4 shrink-0 rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Learners in room
          </p>
          <ul className="mt-2 space-y-1">
            {learnerPresenceNames.map((learnerName) => (
              <li key={learnerName} className="text-sm font-medium text-slate-700">
                {learnerName}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {connectionNotice ? (
        <p
          aria-live="polite"
          className="mb-4 shrink-0 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-600"
        >
          {connectionNotice}
        </p>
      ) : null}

      <div
        ref={messagesContainerRef}
        onScroll={(event) => {
          shouldStickToBottomRef.current = isNearBottom(event.currentTarget);
        }}
        className="min-h-0 flex-1 overflow-y-auto rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-3"
      >
        {isLoading ? (
          <p aria-live="polite" className="text-sm font-medium text-slate-500">
            Loading chat...
          </p>
        ) : loadError ? (
          <div className="space-y-3">
            <p
              aria-live="polite"
              className="text-sm font-semibold text-red-600"
            >
              Live Chat is temporarily unavailable.
            </p>
            <button
              type="button"
              onClick={() => {
                void (async () => {
                  try {
                    await fetchLatestMessages({ showLoading: true });
                  } catch (error) {
                    setLoadError(
                      error instanceof Error && error.message
                        ? error.message
                        : "Live Chat is temporarily unavailable.",
                    );
                  } finally {
                    setIsLoading(false);
                  }
                })();
              }}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Retry
            </button>
          </div>
        ) : messages.length === 0 ? (
          <p className="text-sm font-medium text-slate-500">
            No messages yet. Be the first to say hello.
          </p>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => {
              const isTeacher = message.senderRole === "teacher";

              return (
                <article
                  key={message.id}
                  className="rounded-[1.25rem] border border-slate-200 bg-white p-3 shadow-sm"
                  style={
                    isTeacher
                      ? {
                          borderColor: `${subjectColour}33`,
                          backgroundColor: `${subjectSoftBackground}66`,
                        }
                      : undefined
                  }
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold text-[#102A43]">
                      {message.senderDisplayName}
                    </p>
                    {isTeacher ? (
                      <span
                        className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                        style={{
                          backgroundColor: subjectSoftBackground,
                          color: subjectColour,
                        }}
                        aria-label="Teacher"
                      >
                        Teacher
                      </span>
                    ) : null}
                    <span className="text-xs font-medium text-slate-400">
                      {formatTimestamp(message.createdAt)}
                    </span>
                  </div>

                  <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">
                    {message.message}
                  </p>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <form
        className="mt-4 max-w-full shrink-0 space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        <label htmlFor={`live-chat-input-${subjectId}`} className="sr-only">
          Live Chat message
        </label>

        <div
          className={`flex max-w-full flex-col gap-3 sm:flex-row ${
            isTeacherComposer ? "items-end sm:items-end" : "sm:items-end"
          }`}
        >
          <div className="min-w-0 flex-1">
            <textarea
              id={`live-chat-input-${subjectId}`}
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                if (sendError) setSendError("");
              }}
              onKeyDown={handleKeyDown}
              placeholder={messagePlaceholder}
              maxLength={500}
              rows={isTeacherComposer ? 4 : 3}
              className={`block w-full max-w-full rounded-[1.5rem] border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-slate-400 ${
                isTeacherComposer
                  ? "min-h-[104px] resize-y"
                  : "resize-none"
              }`}
            />
          </div>

          <div className={`flex shrink-0 ${isTeacherComposer ? "self-end" : "sm:self-end"}`}>
            <button
              type="submit"
              disabled={isSending}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60"
              style={{ backgroundColor: subjectColour }}
            >
              <Send size={16} />
              Send
            </button>
          </div>
        </div>

        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="min-h-[1.25rem] min-w-0">
            {sendError ? (
              <p aria-live="polite" className="text-sm font-medium text-red-600">
                {sendError}
              </p>
            ) : isSending ? (
              <p aria-live="polite" className="text-sm font-medium text-slate-500">
                Sending...
              </p>
            ) : remainingCharacters <= 80 ? (
              <p className="text-xs font-medium text-slate-400">
                {remainingCharacters} characters remaining
              </p>
            ) : null}
          </div>
        </div>
      </form>
    </section>
  );
}

export default LiveClassChatPanel;
