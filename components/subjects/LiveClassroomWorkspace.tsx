"use client";

import { useRef, useState } from "react";
import { Hand, MonitorPlay } from "lucide-react";
import LiveClassroomPlayer, {
  describeLiveClassroomStatus,
  type WebRTCStatus,
} from "@/components/subjects/LiveClassroomPlayer";
import type { LiveKitClassroomPlayerHandle } from "@/components/subjects/LiveKitClassroomPlayer";
import LiveClassChatPanel, {
  type LearnerPresenceInfo,
  type LiveClassChatPanelHandle,
} from "@/components/subjects/LiveClassChatPanel";
import LiveClassAttendanceCard from "@/components/subjects/LiveClassAttendanceCard";
import type { LiveClassMediaProvider } from "@/lib/liveClass/mediaProvider";
import type { SubjectKey } from "@/lib/subjects/subjectConfig";

type PresenceIdentity = {
  profileId: string;
  displayName: string;
  role: "learner" | "teacher";
};

// Holds the client-only interactive state (presence roster, own raised-hand
// state, live player status) that the Video, Chat, and Attendance cards
// share. Kept as one small client component so the surrounding pages can
// stay server components for auth/data loading.
//
// Attendance/Raise Hand have exactly one active data source at a time,
// chosen by mediaProvider: for "livekit" they come from LiveKitClassroomPlayer
// (LiveKit room participants, see lib/liveClass/livekitAttendance.ts); for
// "cloudflare" they come from LiveClassChatPanel's existing Supabase
// Presence channel, completely unchanged. Only one of the two ever has its
// onPresenceChange/onOwnHandRaisedChange callbacks wired at a time, so there
// is never a duplicate/competing attendance count.
export function LiveClassroomWorkspace({
  subjectKey,
  subjectDatabaseId,
  subjectColour,
  subjectSoftBackground,
  role,
  presenceIdentity,
  requireExplicitAudioJoin = false,
  videoCardSubtitle,
  messagePlaceholder,
  composerVariant = "default",
  mediaProvider = "cloudflare",
}: {
  subjectKey: SubjectKey;
  subjectDatabaseId: string;
  subjectColour: string;
  subjectSoftBackground: string;
  role: "teacher" | "learner";
  presenceIdentity: PresenceIdentity;
  requireExplicitAudioJoin?: boolean;
  videoCardSubtitle: string;
  messagePlaceholder?: string;
  composerVariant?: "default" | "teacher";
  mediaProvider?: LiveClassMediaProvider;
}) {
  const chatPanelRef = useRef<LiveClassChatPanelHandle>(null);
  const liveKitPlayerRef = useRef<LiveKitClassroomPlayerHandle>(null);
  const [presenceLearners, setPresenceLearners] = useState<LearnerPresenceInfo[]>([]);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [liveStatus, setLiveStatus] = useState<WebRTCStatus>("connecting");

  const isLiveKit = mediaProvider === "livekit";

  function toggleRaiseHand() {
    if (isLiveKit) {
      if (isHandRaised) {
        liveKitPlayerRef.current?.lowerHand();
      } else {
        liveKitPlayerRef.current?.raiseHand();
      }
      return;
    }

    if (isHandRaised) {
      chatPanelRef.current?.lowerHand();
    } else {
      chatPanelRef.current?.raiseHand();
    }
  }

  function clearLearnerHand(learnerIdentifier: string) {
    if (isLiveKit) {
      liveKitPlayerRef.current?.clearLearnerHand(learnerIdentifier);
    } else {
      chatPanelRef.current?.clearLearnerHand(learnerIdentifier);
    }
  }

  return (
    <>
      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(22rem,3fr)] lg:items-start">
        <section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div
              className="shrink-0 rounded-2xl p-3"
              style={{ backgroundColor: subjectSoftBackground, color: subjectColour }}
            >
              <MonitorPlay size={20} />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-[#102A43]">Live Classroom</h2>
              <p className="text-sm text-slate-500">{videoCardSubtitle}</p>
            </div>
          </div>

          <LiveClassroomPlayer
            ref={liveKitPlayerRef}
            subjectColour={subjectColour}
            subjectSoftBackground={subjectSoftBackground}
            requireExplicitAudioJoin={requireExplicitAudioJoin}
            logContext={{ role, subjectKey }}
            onStatusChange={setLiveStatus}
            mediaProvider={mediaProvider}
            subjectDatabaseId={subjectDatabaseId}
            role={role}
            onPresenceChange={isLiveKit ? setPresenceLearners : undefined}
            onOwnHandRaisedChange={isLiveKit ? setIsHandRaised : undefined}
          />

          {/* Compact status/control strip directly beneath the video --
              the learner's Raise Hand control lives here, not in a lower
              Attendance card, so it's never necessary to scroll past Chat
              to find it. */}
          <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <span
              aria-live="polite"
              className="text-sm font-bold"
              style={{ color: subjectColour }}
            >
              {describeLiveClassroomStatus(liveStatus)}
            </span>

            {role === "learner" ? (
              <button
                type="button"
                onClick={toggleRaiseHand}
                aria-pressed={isHandRaised}
                className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold shadow-sm transition ${
                  isHandRaised
                    ? "text-white"
                    : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                }`}
                style={isHandRaised ? { backgroundColor: subjectColour } : undefined}
              >
                <Hand size={16} />
                {isHandRaised ? "Hand Raised" : "Raise Hand"}
              </button>
            ) : null}
          </div>
        </section>

        <LiveClassChatPanel
          ref={chatPanelRef}
          subjectId={subjectDatabaseId}
          subjectColour={subjectColour}
          subjectSoftBackground={subjectSoftBackground}
          presenceIdentity={presenceIdentity}
          messagePlaceholder={messagePlaceholder}
          composerVariant={composerVariant}
          onPresenceChange={isLiveKit ? undefined : setPresenceLearners}
          onOwnHandRaisedChange={isLiveKit ? undefined : setIsHandRaised}
        />
      </div>

      {role === "teacher" ? (
        <LiveClassAttendanceCard
          subjectColour={subjectColour}
          subjectSoftBackground={subjectSoftBackground}
          learners={presenceLearners}
          onClearHand={clearLearnerHand}
        />
      ) : null}
    </>
  );
}

export default LiveClassroomWorkspace;
