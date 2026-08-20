"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { MessageCircle, Send } from "lucide-react";
import type { RealtimeChannel } from "@supabase/supabase-js";
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
  raisedHand: boolean;
};

export type LearnerPresenceInfo = {
  profileId: string;
  displayName: string;
  raisedHand: boolean;
};

export type LiveClassChatPanelHandle = {
  raiseHand: () => void;
  lowerHand: () => void;
  clearLearnerHand: (learnerProfileId: string) => void;
};

type TeacherClearHandPayload = {
  learnerProfileId: string;
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

// A learner who disappears from presence and reappears within this window is
// treated as a blip (e.g. a brief realtime reconnect), not a genuine leave/
// rejoin -- keeps the teacher's join/leave sounds restrained.
const LEAVE_SOUND_GRACE_MS = 8000;

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

// --- Lightweight, dependency-free notification sounds ---
//
// Static audio assets were the preferred approach, but generating real
// binary audio files isn't something this tooling can produce -- instead we
// synthesize short, restrained tones via the standard Web Audio API. No
// external file, no library, and any failure (blocked autoplay policy,
// unsupported browser, etc.) is swallowed silently so it can never affect
// chat, presence, video, or Raise Hand.
type WindowWithWebkitAudioContext = Window & {
  webkitAudioContext?: typeof AudioContext;
};

function playTone(frequencies: number[], noteDurationMs: number) {
  if (typeof window === "undefined") return;

  try {
    const AudioContextClass =
      window.AudioContext ?? (window as WindowWithWebkitAudioContext).webkitAudioContext;
    if (!AudioContextClass) return;

    const context = new AudioContextClass();
    const noteDurationSeconds = noteDurationMs / 1000;
    const noteGapSeconds = 0.09;
    const now = context.currentTime;

    frequencies.forEach((frequency, index) => {
      const startTime = now + index * noteGapSeconds;
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();

      oscillator.type = "sine";
      oscillator.frequency.value = frequency;

      gainNode.gain.setValueAtTime(0.0001, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.12, startTime + 0.015);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + noteDurationSeconds);

      oscillator.connect(gainNode);
      gainNode.connect(context.destination);
      oscillator.start(startTime);
      oscillator.stop(startTime + noteDurationSeconds + 0.02);
    });

    const totalDurationMs =
      (frequencies.length - 1) * noteGapSeconds * 1000 + noteDurationMs + 100;

    window.setTimeout(() => {
      void context.close().catch(() => undefined);
    }, totalDurationMs);

    const resumeResult = context.resume();
    if (resumeResult && typeof resumeResult.catch === "function") {
      resumeResult.catch(() => undefined);
    }
  } catch {
    // Notification sounds are best-effort only.
  }
}

function playJoinSound() {
  playTone([523.25, 659.25], 140);
}

function playLeaveSound() {
  playTone([523.25, 392.0], 140);
}

function playMessageSound() {
  playTone([880], 90);
}

export const LiveClassChatPanel = forwardRef<
  LiveClassChatPanelHandle,
  {
    subjectId: string;
    subjectColour: string;
    subjectSoftBackground: string;
    presenceIdentity: PresenceIdentity;
    messagePlaceholder?: string;
    composerVariant?: "default" | "teacher";
    onPresenceChange?: (learners: LearnerPresenceInfo[]) => void;
    onOwnHandRaisedChange?: (raised: boolean) => void;
  }
>(function LiveClassChatPanel(
  {
    subjectId,
    subjectColour,
    subjectSoftBackground,
    presenceIdentity,
    messagePlaceholder = "Ask your teacher...",
    composerVariant = "default",
    onPresenceChange,
    onOwnHandRaisedChange,
  },
  ref,
) {
  const [messages, setMessages] = useState<LiveClassMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [sendError, setSendError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [didInitialLoad, setDidInitialLoad] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>("connected");

  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const shouldStickToBottomRef = useRef(true);
  const supabaseRef = useRef(createClient());
  const bufferedEventsRef = useRef<BufferedRealtimeEvent[]>([]);
  const initialLoadCompleteRef = useRef(false);
  const isMountedRef = useRef(true);
  const reconnectRecoveryInFlightRef = useRef(false);
  const wasEverSubscribedRef = useRef(false);
  const isTrackedRef = useRef(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const joinedAtRef = useRef<string | null>(null);
  const raisedHandRef = useRef(false);
  const presenceSoundsArmedRef = useRef(false);
  const previousLearnerProfileIdsRef = useRef<Set<string>>(new Set());
  const pendingLeaveTimersRef = useRef<Map<string, number>>(new Map());
  const onPresenceChangeRef = useRef(onPresenceChange);
  const onOwnHandRaisedChangeRef = useRef(onOwnHandRaisedChange);

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
  const isTeacherComposer = composerVariant === "teacher";

  useEffect(() => {
    onPresenceChangeRef.current = onPresenceChange;
  }, [onPresenceChange]);

  useEffect(() => {
    onOwnHandRaisedChangeRef.current = onOwnHandRaisedChange;
  }, [onOwnHandRaisedChange]);

  const buildPresenceMeta = useCallback((): PresenceEntry => {
    if (!joinedAtRef.current) {
      joinedAtRef.current = new Date().toISOString();
    }

    return {
      profileId: presenceIdentity.profileId,
      displayName: presenceIdentity.displayName,
      role: presenceIdentity.role,
      joinedAt: joinedAtRef.current,
      raisedHand: raisedHandRef.current,
    };
  }, [presenceIdentity.displayName, presenceIdentity.profileId, presenceIdentity.role]);

  const setRaisedHand = useCallback(
    (nextRaised: boolean) => {
      if (presenceIdentity.role !== "learner") return;
      if (raisedHandRef.current === nextRaised) return;

      raisedHandRef.current = nextRaised;
      onOwnHandRaisedChangeRef.current?.(nextRaised);
      console.info(nextRaised ? "Live Chat hand raised:" : "Live Chat hand lowered:", {
        subjectId,
        profileId: presenceIdentity.profileId,
      });

      const channel = channelRef.current;
      if (!channel || !isTrackedRef.current) return;

      void channel.track(buildPresenceMeta()).catch((error) => {
        console.error("Live Chat raise-hand re-track failed:", {
          subjectId,
          profileId: presenceIdentity.profileId,
          message: error instanceof Error ? error.message : "Unknown error",
        });
      });
    },
    [buildPresenceMeta, presenceIdentity.profileId, presenceIdentity.role, subjectId],
  );

  useImperativeHandle(
    ref,
    () => ({
      raiseHand: () => setRaisedHand(true),
      lowerHand: () => setRaisedHand(false),
      clearLearnerHand: (learnerProfileId: string) => {
        const channel = channelRef.current;
        if (!channel) return;

        void channel
          .send({
            type: "broadcast",
            event: "teacher-clear-hand",
            payload: { learnerProfileId } satisfies TeacherClearHandPayload,
          })
          .catch((error) => {
            console.error("Live Chat teacher-clear-hand broadcast failed:", {
              subjectId,
              message: error instanceof Error ? error.message : "Unknown error",
            });
          });

        console.info("Live Chat teacher cleared a learner's raised hand:", {
          subjectId,
          learnerProfileId,
        });
      },
    }),
    [setRaisedHand, subjectId],
  );

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const container = messagesContainerRef.current;
    if (!container) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior,
    });
  }, []);

  const fetchLatestMessages = useCallback(
    async (options?: { showLoading?: boolean; recovery?: boolean; signal?: AbortSignal }) => {
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
          signal: options?.signal,
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

    // Per-effect-run guard, distinct from isMountedRef: isMountedRef is
    // shared across a component instance's whole lifetime (used elsewhere
    // in this file for realtime/recovery guards), so under React Strict
    // Mode's synthetic mount->cleanup->remount in development, the second
    // (real) invocation flips it back to true before the first (discarded)
    // invocation's request can resolve -- meaning a stale first response
    // could still be applied. `cancelled` and the AbortController below are
    // scoped to THIS run only, so the first run's request is aborted and
    // its result can never be applied, leaving the second invocation as the
    // sole authoritative initial load.
    let cancelled = false;
    const controller = new AbortController();

    async function loadInitialMessages() {
      try {
        await fetchLatestMessages({ showLoading: true, signal: controller.signal });
      } catch (error) {
        // A cleanup-triggered abort is expected teardown (Strict Mode's
        // synthetic first run, or a real unmount/subjectId change
        // mid-fetch), not a chat failure -- never surface it as one.
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        if (cancelled || !isMountedRef.current) return;

        setLoadError(
          error instanceof Error && error.message
            ? error.message
            : "Live Chat is temporarily unavailable.",
        );
      } finally {
        if (!cancelled && isMountedRef.current) {
          setIsLoading(false);
        }
      }
    }

    void loadInitialMessages();

    return () => {
      cancelled = true;
      controller.abort();
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

    channelRef.current = channel;

    initialLoadCompleteRef.current = false;
    bufferedEventsRef.current = [];
    reconnectRecoveryInFlightRef.current = false;
    isTrackedRef.current = false;
    joinedAtRef.current = null;
    raisedHandRef.current = false;
    presenceSoundsArmedRef.current = false;
    previousLearnerProfileIdsRef.current = new Set();
    for (const timer of pendingLeaveTimersRef.current.values()) {
      window.clearTimeout(timer);
    }
    pendingLeaveTimersRef.current = new Map();
    onOwnHandRaisedChangeRef.current?.(false);
    onPresenceChangeRef.current?.([]);

    queueMicrotask(() => {
      if (!isMountedRef.current) return;
      setConnectionState("reconnecting");
    });

    const handlePresenceSync = () => {
      const presenceState = channel.presenceState<PresenceEntry>();
      const learnerEntries = Object.values(presenceState)
        .flat()
        .filter((entry) => entry.role === "learner");
      const learnersByProfileId = new Map<string, LearnerPresenceInfo>();

      for (const learnerEntry of learnerEntries) {
        const existing = learnersByProfileId.get(learnerEntry.profileId);
        if (!existing) {
          learnersByProfileId.set(learnerEntry.profileId, {
            profileId: learnerEntry.profileId,
            displayName: learnerEntry.displayName,
            raisedHand: Boolean(learnerEntry.raisedHand),
          });
        } else if (learnerEntry.raisedHand && !existing.raisedHand) {
          // Multiple tabs/devices for the same learner: reflect a raised
          // hand if ANY of their sessions has one raised.
          learnersByProfileId.set(learnerEntry.profileId, { ...existing, raisedHand: true });
        }
      }

      const roster = [...learnersByProfileId.values()].sort((left, right) =>
        left.displayName.localeCompare(right.displayName, "en-ZA", { sensitivity: "base" }),
      );

      onPresenceChangeRef.current?.(roster);

      // Join/leave sounds: teacher view only, and only for genuine
      // transitions -- never on the initial roster population, and never
      // for a learner who disappears/reappears within the grace window
      // (a realtime reconnect blip, not a real departure).
      if (presenceIdentity.role !== "teacher") {
        return;
      }

      const nextIds = new Set(roster.map((learner) => learner.profileId));

      if (!presenceSoundsArmedRef.current) {
        previousLearnerProfileIdsRef.current = nextIds;
        presenceSoundsArmedRef.current = true;
        return;
      }

      const previousIds = previousLearnerProfileIdsRef.current;

      for (const id of nextIds) {
        if (previousIds.has(id)) continue;

        const pendingLeaveTimer = pendingLeaveTimersRef.current.get(id);
        if (pendingLeaveTimer !== undefined) {
          window.clearTimeout(pendingLeaveTimer);
          pendingLeaveTimersRef.current.delete(id);
          continue;
        }

        console.info("Live Chat learner presence joined:", { subjectId, profileId: id });
        // TEMPORARY DIAGNOSTIC:
        // Notification audio disabled while testing WebRTC jitter.
        // playJoinSound();
      }

      for (const id of previousIds) {
        if (nextIds.has(id) || pendingLeaveTimersRef.current.has(id)) continue;

        const timer = window.setTimeout(() => {
          pendingLeaveTimersRef.current.delete(id);
          console.info("Live Chat learner presence left:", { subjectId, profileId: id });
          // TEMPORARY DIAGNOSTIC:
          // Notification audio disabled while testing WebRTC jitter.
          // playLeaveSound();
        }, LEAVE_SOUND_GRACE_MS);
        pendingLeaveTimersRef.current.set(id, timer);
      }

      previousLearnerProfileIdsRef.current = nextIds;
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

          // New-message sound: never for the sender's own message, never
          // during initial load/recovery (both handled above/elsewhere),
          // and for the teacher only when a learner sent it.
          const isOwnMessage = row.sender_profile_id === presenceIdentity.profileId;
          const shouldNotify =
            !isOwnMessage &&
            (presenceIdentity.role === "teacher" ? row.sender_role === "learner" : true);

          if (shouldNotify) {
            // TEMPORARY DIAGNOSTIC:
            // Notification audio disabled while testing WebRTC jitter.
            // playMessageSound();
          }
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
      .on("presence", { event: "sync" }, handlePresenceSync)
      .on(
        "broadcast",
        { event: "teacher-clear-hand" },
        (payload) => {
          const targetProfileId = (
            payload?.payload as TeacherClearHandPayload | undefined
          )?.learnerProfileId;

          if (!targetProfileId || targetProfileId !== presenceIdentity.profileId) {
            return;
          }

          if (!raisedHandRef.current) return;

          raisedHandRef.current = false;
          onOwnHandRaisedChangeRef.current?.(false);
          console.info("Live Chat hand cleared by teacher:", {
            subjectId,
            profileId: presenceIdentity.profileId,
          });

          if (!isTrackedRef.current) return;

          void channel.track(buildPresenceMeta()).catch((error) => {
            console.error("Live Chat re-track after teacher hand clear failed:", {
              subjectId,
              profileId: presenceIdentity.profileId,
              message: error instanceof Error ? error.message : "Unknown error",
            });
          });
        },
      );

    // The server-side presence entry is tied to the underlying realtime
    // connection: once that connection drops (TIMED_OUT/CHANNEL_ERROR/
    // CLOSED), the server forgets it, even though the SAME RealtimeChannel
    // object typically survives and gets resubscribed automatically on
    // reconnect (this is exactly what lets the chat recovery fetch below
    // re-run on every reconnect). Presence must be re-announced the same
    // way, so isTrackedRef is reset on every disconnect-class status and
    // re-checked on every SUBSCRIBED -- not just the very first one.
    const resetTrackedStateOnDisconnect = (reason: string) => {
      if (isTrackedRef.current) {
        console.info("Live Chat presence tracking reset:", {
          subjectId,
          profileId: presenceIdentity.profileId,
          role: presenceIdentity.role,
          reason,
        });
      }
      isTrackedRef.current = false;
    };

    void channel.subscribe(async (status) => {
      if (!isMountedRef.current) return;

      if (status === "SUBSCRIBED") {
        setConnectionState("connected");

        if (!isTrackedRef.current) {
          const isRetrackAfterReconnect = wasEverSubscribedRef.current;

          try {
            // buildPresenceMeta() reads raisedHandRef/joinedAtRef, both
            // stable component-level refs untouched by reconnects, so a
            // re-track after reconnect reproduces whatever raised-hand
            // state the learner actually had -- it is never silently reset
            // to false just because the connection dropped and came back.
            await channel.track(buildPresenceMeta());

            // Only mark tracking as successful once channel.track(...) has
            // actually resolved -- if it throws, isTrackedRef.current stays
            // false so the next SUBSCRIBED event (e.g. another reconnect)
            // gets a fresh chance instead of being permanently skipped.
            isTrackedRef.current = true;

            console.info(
              isRetrackAfterReconnect
                ? "Live Chat presence re-tracked after reconnect:"
                : "Live Chat presence tracking succeeded:",
              {
                subjectId,
                profileId: presenceIdentity.profileId,
                role: presenceIdentity.role,
              },
            );
          } catch (error) {
            console.error("Live Chat presence tracking failed:", {
              subjectId,
              profileId: presenceIdentity.profileId,
              role: presenceIdentity.role,
              message: error instanceof Error ? error.message : "Unknown error",
            });
          }
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
        resetTrackedStateOnDisconnect("TIMED_OUT");
        setConnectionState("reconnecting");
        return;
      }

      if (status === "CHANNEL_ERROR") {
        resetTrackedStateOnDisconnect("CHANNEL_ERROR");
        setConnectionState("unavailable");
        return;
      }

      if (status === "CLOSED") {
        resetTrackedStateOnDisconnect("CLOSED");
        setConnectionState("reconnecting");
      }
    });

    return () => {
      bufferedEventsRef.current = [];
      initialLoadCompleteRef.current = false;
      reconnectRecoveryInFlightRef.current = false;
      for (const timer of pendingLeaveTimersRef.current.values()) {
        window.clearTimeout(timer);
      }
      pendingLeaveTimersRef.current = new Map();
      channelRef.current = null;
      onPresenceChangeRef.current?.([]);
      void supabase.removeChannel(channel);
    };
  }, [
    buildPresenceMeta,
    fetchLatestMessages,
    presenceIdentity.displayName,
    presenceIdentity.profileId,
    presenceIdentity.role,
    subjectId,
  ]);

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
      <div className="mb-4 flex shrink-0 items-center gap-3">
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
});

export default LiveClassChatPanel;
