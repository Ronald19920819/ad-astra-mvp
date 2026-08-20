// LiveKit ingress provisioning: dev-only, run manually and locally.
//
// Test/POC ingress (unchanged default behavior):
//   node scripts/livekit-provision-test-ingress.mjs
//
// Production per-subject ingress (Stage 3+):
//   node scripts/livekit-provision-test-ingress.mjs --subject-id=<exact AD Astra subject database UUID>
//
// This is deliberately NOT an HTTP endpoint -- the RTMP stream key it
// returns must never be reachable over the network, authenticated or not.
// It lists existing ingresses for the target room first and reuses a
// matching one if already provisioned, so repeated runs never accumulate
// duplicate ingresses on LiveKit Cloud, in either mode.
//
// Keep these four literals in sync with lib/livekit/testRoom.ts.
const LIVEKIT_TEST_ROOM_NAME = "ad-astra-live-test";
const LIVEKIT_TEST_INGRESS_NAME = "AD Astra OBS Test";
const LIVEKIT_TEST_OBS_PARTICIPANT_IDENTITY = "ad-astra-obs";
const LIVEKIT_TEST_OBS_PARTICIPANT_NAME = "AD Astra Teacher";

// Keep this pattern and the two prefixes below in sync with
// lib/livekit/subjectRoom.ts's getLiveKitRoomNameForSubject /
// getLiveKitIngressParticipantIdentity. Deliberately duplicated here
// (rather than imported) so this plain .mjs script stays dependency-light
// and runnable with plain `node`, matching its existing test-room constants
// above.
const SUBJECT_DATABASE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LIVEKIT_SUBJECT_ROOM_PREFIX = "ad-astra-subject-";
const LIVEKIT_OBS_PARTICIPANT_PREFIX = "ad-astra-obs-";

import fs from "node:fs";
import path from "node:path";
import { IngressClient, IngressInput } from "livekit-server-sdk";

function parseCliArgs(argv) {
  const args = {};
  for (const raw of argv) {
    const match = /^--([a-zA-Z-]+)=(.*)$/.exec(raw);
    if (match) {
      args[match[1]] = match[2];
    }
  }
  return args;
}

const cliArgs = parseCliArgs(process.argv.slice(2));

const rootDir = process.cwd();
const envFiles = [".env.local", ".env"];

for (const fileName of envFiles) {
  const filePath = path.join(rootDir, fileName);
  if (!fs.existsSync(filePath)) continue;

  const contents = fs.readFileSync(filePath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith("#")) continue;

    const separatorIndex = trimmedLine.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmedLine.slice(0, separatorIndex).trim();
    const rawValue = trimmedLine.slice(separatorIndex + 1).trim();
    if (!key || process.env[key]) continue;

    const value = rawValue.replace(/^['"]|['"]$/g, "");
    process.env[key] = value;
  }
}

const apiKey = process.env.LIVEKIT_API_KEY?.trim();
const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();
// The Ingress API needs an explicit https:// host. Earlier POC runs passed
// the wss:// value straight through and got a real
// "401 Unauthorized: invalid API key" from LiveKit Cloud, so this script no
// longer relies on the server SDK normalizing the protocol itself -- prefer
// LIVEKIT_API_URL and fall back to LIVEKIT_URL only for local dev. Fails
// loudly (rather than risk a repeat of that same 401) if the resolved host
// isn't explicitly https://.
const apiUrl =
  process.env.LIVEKIT_API_URL?.trim() || process.env.LIVEKIT_URL?.trim();

if (!apiUrl || !apiKey || !apiSecret) {
  throw new Error(
    "LIVEKIT_API_URL (or LIVEKIT_URL as a local-dev fallback), LIVEKIT_API_KEY, and LIVEKIT_API_SECRET are required (set in .env.local).",
  );
}

if (!apiUrl.startsWith("https://")) {
  throw new Error(
    `LiveKit API host must be an explicit https:// URL for ingress provisioning (got a non-https value). Set LIVEKIT_API_URL=https://<project>.livekit.cloud in .env.local.`,
  );
}

let targetRoomName;
let targetIngressName;
let targetParticipantIdentity;
let targetParticipantName;

if (cliArgs["subject-id"]) {
  const rawSubjectId = cliArgs["subject-id"].trim();

  if (!SUBJECT_DATABASE_ID_PATTERN.test(rawSubjectId)) {
    throw new Error(
      `--subject-id must be a valid AD Astra subject database UUID, got: "${rawSubjectId}".`,
    );
  }

  const subjectId = rawSubjectId.toLowerCase();
  targetRoomName = `${LIVEKIT_SUBJECT_ROOM_PREFIX}${subjectId}`;
  targetParticipantIdentity = `${LIVEKIT_OBS_PARTICIPANT_PREFIX}${subjectId}`;
  targetIngressName = cliArgs.name || `AD Astra Subject Ingress (${subjectId})`;
  targetParticipantName = cliArgs["participant-name"] || "AD Astra Teacher";
} else {
  targetRoomName = LIVEKIT_TEST_ROOM_NAME;
  targetIngressName = LIVEKIT_TEST_INGRESS_NAME;
  targetParticipantIdentity = LIVEKIT_TEST_OBS_PARTICIPANT_IDENTITY;
  targetParticipantName = LIVEKIT_TEST_OBS_PARTICIPANT_NAME;
}

const ingressClient = new IngressClient(apiUrl, apiKey, apiSecret);

function describeIngress(ingress) {
  return {
    ingressId: ingress.ingressId,
    name: ingress.name,
    roomName: ingress.roomName,
    participantIdentity: ingress.participantIdentity,
    url: ingress.url,
    streamKey: ingress.streamKey,
  };
}

const existingIngresses = await ingressClient.listIngress({
  roomName: targetRoomName,
});

const existingTargetIngress = existingIngresses.find(
  (ingress) =>
    ingress.name === targetIngressName &&
    ingress.participantIdentity === targetParticipantIdentity,
);

let ingressInfo;
let wasReused;

if (existingTargetIngress) {
  ingressInfo = existingTargetIngress;
  wasReused = true;
  console.info(
    `Reusing existing "${targetIngressName}" ingress (no new ingress created).`,
  );
} else {
  ingressInfo = await ingressClient.createIngress(IngressInput.RTMP_INPUT, {
    name: targetIngressName,
    roomName: targetRoomName,
    participantIdentity: targetParticipantIdentity,
    participantName: targetParticipantName,
    enableTranscoding: true,
  });
  wasReused = false;
  console.info(`Created new "${targetIngressName}" ingress.`);
}

const details = describeIngress(ingressInfo);

console.info("");
console.info("Ingress ready:", {
  ingressId: details.ingressId,
  roomName: details.roomName,
  participantIdentity: details.participantIdentity,
  wasReused,
});
console.info("");
console.info("OBS -> Settings -> Stream:");
console.info("  Service:    Custom");
console.info(`  Server:     ${details.url ?? "(unavailable -- rerun this script)"}`);
console.info(
  `  Stream Key: ${details.streamKey ?? "(unavailable -- LiveKit only returns the stream key from this listing/creation call; if this reads as unavailable, delete and recreate the ingress via the LiveKit Cloud dashboard)"}`,
);
console.info("");
console.info(
  "This output is only ever printed to your local terminal -- do not paste the Server/Stream Key into source control, chat, or any committed file.",
);
