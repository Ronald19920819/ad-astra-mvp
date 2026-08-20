import type { LiveKitViewerRole } from "@/lib/livekit/viewerIdentity";

// Pure, framework-free helpers for deriving Live Classroom attendance and
// raised-hand state from LiveKit room participant attributes -- kept
// separate from LiveKitClassroomPlayer.tsx (a "use client" component that
// imports @livekit/components-react/livekit-client, real browser-oriented
// runtime code that can't be loaded under plain node:test) so this decision
// logic stays independently testable and doesn't need to load a "use
// client" component's own dependency graph just to type-check.
//
// LiveKitLearnerPresence is deliberately a plain local type rather than an
// import of LiveClassChatPanel's LearnerPresenceInfo -- the two are
// structurally identical, so TypeScript accepts either wherever the other
// is expected (e.g. passing this module's roster into
// LiveClassroomWorkspace's onPresenceChange, typed against
// LearnerPresenceInfo), with no explicit cast and no cross-module coupling.
export type LiveKitLearnerPresence = {
  profileId: string;
  displayName: string;
  raisedHand: boolean;
};

export const LIVEKIT_ROLE_ATTRIBUTE = "role";
export const LIVEKIT_RAISED_HAND_ATTRIBUTE = "raisedHand";

// The minimal shape this module needs from a LiveKit participant --
// deliberately structural (not livekit-client's actual Participant class)
// so real RemoteParticipant/LocalParticipant/ParticipantInfo instances all
// satisfy it without this module importing any LiveKit runtime code.
export type LiveKitParticipantLike = {
  identity: string;
  name?: string;
  attributes?: Record<string, string>;
};

// Initial attributes set at token-mint time (Stage 1's token route). Every
// viewer's role is encoded explicitly here rather than inferred from the
// identity string alone, and every learner starts with a well-defined
// raisedHand value instead of an undefined one.
export function buildLiveKitViewerAttributes(
  role: LiveKitViewerRole,
): Record<string, string> {
  if (role === "learner") {
    return {
      [LIVEKIT_ROLE_ATTRIBUTE]: "learner",
      [LIVEKIT_RAISED_HAND_ATTRIBUTE]: "false",
    };
  }

  return { [LIVEKIT_ROLE_ATTRIBUTE]: "teacher" };
}

// Excludes the OBS ingress participant (which never receives this
// attribute at all -- it's provisioned via IngressClient, not the viewer
// token route) and the teacher viewer, leaving only genuine learners.
export function isLiveKitLearnerParticipant(
  participant: LiveKitParticipantLike,
): boolean {
  return participant.attributes?.[LIVEKIT_ROLE_ATTRIBUTE] === "learner";
}

export function isLiveKitParticipantHandRaised(
  participant: LiveKitParticipantLike,
): boolean {
  return participant.attributes?.[LIVEKIT_RAISED_HAND_ATTRIBUTE] === "true";
}

export function mapLiveKitParticipantToLearnerPresence(
  participant: LiveKitParticipantLike,
): LiveKitLearnerPresence {
  return {
    profileId: participant.identity,
    displayName: participant.name?.trim() || participant.identity,
    raisedHand: isLiveKitParticipantHandRaised(participant),
  };
}

// A learner's own outer raised-hand React state is pushed one-way onto
// their LiveKit participant via LocalParticipant.setAttributes. When the
// server changes that SAME attribute out from under them -- specifically,
// a teacher's clear-hand action via RoomServiceClient.updateParticipant --
// the local UI must reconcile back down, or the Raise Hand button stays
// stuck showing "raised" and the next push (e.g. after a reconnect) would
// silently re-assert the stale value, undoing the teacher's clear.
//
// LiveKit's `attributesChanged` participant event only reports the
// attributes that actually changed in this update, so this returns null
// (meaning: no reconciliation needed) when raisedHand wasn't part of the
// change, rather than a boolean.
export function resolveHandRaisedFromAttributeChange(
  changedAttributes: Record<string, string>,
): boolean | null {
  if (!(LIVEKIT_RAISED_HAND_ATTRIBUTE in changedAttributes)) return null;
  return changedAttributes[LIVEKIT_RAISED_HAND_ATTRIBUTE] === "true";
}

export function buildLearnerRosterFromLiveKitParticipants(
  participants: LiveKitParticipantLike[],
): LiveKitLearnerPresence[] {
  return participants
    .filter(isLiveKitLearnerParticipant)
    .map(mapLiveKitParticipantToLearnerPresence)
    .sort((left, right) =>
      left.displayName.localeCompare(right.displayName, "en-ZA", {
        sensitivity: "base",
      }),
    );
}
