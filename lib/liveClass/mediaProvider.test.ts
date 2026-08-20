import assert from "node:assert/strict";
import test from "node:test";
import { getMediaProviderForSubject } from "./mediaProvider";

const PROVIDER_VAR = "LIVE_CLASS_MEDIA_PROVIDER";
const ALLOWLIST_VAR = "LIVE_CLASS_LIVEKIT_SUBJECT_KEYS";

function withEnv(
  values: Record<string, string | undefined>,
  run: () => void,
) {
  const previous: Record<string, string | undefined> = {};
  for (const key of Object.keys(values)) {
    previous[key] = process.env[key];
  }

  try {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    run();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test("missing config resolves to cloudflare for every subject", () => {
  withEnv({ [PROVIDER_VAR]: undefined, [ALLOWLIST_VAR]: undefined }, () => {
    assert.equal(getMediaProviderForSubject("business-studies"), "cloudflare");
    assert.equal(getMediaProviderForSubject("english"), "cloudflare");
  });
});

test("explicit cloudflare resolves to cloudflare", () => {
  withEnv({ [PROVIDER_VAR]: "cloudflare", [ALLOWLIST_VAR]: "business-studies" }, () => {
    // Even with an allowlist set, an explicit "cloudflare" provider wins --
    // this is the full-rollback path.
    assert.equal(getMediaProviderForSubject("business-studies"), "cloudflare");
  });
});

test("pilot allowlist subject resolves to livekit", () => {
  withEnv(
    { [PROVIDER_VAR]: "livekit", [ALLOWLIST_VAR]: "business-studies" },
    () => {
      assert.equal(getMediaProviderForSubject("business-studies"), "livekit");
    },
  );
});

test("a subject not in the pilot allowlist stays on cloudflare", () => {
  withEnv(
    { [PROVIDER_VAR]: "livekit", [ALLOWLIST_VAR]: "business-studies" },
    () => {
      assert.equal(getMediaProviderForSubject("history"), "cloudflare");
    },
  );
});

test("English Stage 8 selection does not select Stage 9", () => {
  withEnv(
    { [PROVIDER_VAR]: "livekit", [ALLOWLIST_VAR]: "english-stage-8" },
    () => {
      assert.equal(getMediaProviderForSubject("english-stage-8"), "livekit");
      assert.equal(getMediaProviderForSubject("english"), "cloudflare");
    },
  );
});

test("Afrikaans Grade 8 selection does not select Grade 9", () => {
  withEnv(
    { [PROVIDER_VAR]: "livekit", [ALLOWLIST_VAR]: "afrikaans-stage-8" },
    () => {
      assert.equal(getMediaProviderForSubject("afrikaans-stage-8"), "livekit");
      assert.equal(getMediaProviderForSubject("afrikaans"), "cloudflare");
    },
  );
});

test("Business Studies variants remain independent", () => {
  withEnv(
    { [PROVIDER_VAR]: "livekit", [ALLOWLIST_VAR]: "business-studies" },
    () => {
      assert.equal(getMediaProviderForSubject("business-studies"), "livekit");
      assert.equal(
        getMediaProviderForSubject("business-studies-igcse-1"),
        "cloudflare",
      );
    },
  );
});

test("History variants remain independent", () => {
  withEnv({ [PROVIDER_VAR]: "livekit", [ALLOWLIST_VAR]: "history" }, () => {
    assert.equal(getMediaProviderForSubject("history"), "livekit");
    assert.equal(getMediaProviderForSubject("history-igcse-1"), "cloudflare");
  });
});

test("a comma-separated allowlist can enable more than one subject at once", () => {
  withEnv(
    {
      [PROVIDER_VAR]: "livekit",
      [ALLOWLIST_VAR]: "business-studies, history",
    },
    () => {
      assert.equal(getMediaProviderForSubject("business-studies"), "livekit");
      assert.equal(getMediaProviderForSubject("history"), "livekit");
      assert.equal(getMediaProviderForSubject("english"), "cloudflare");
    },
  );
});

test("livekit with no allowlist set is a full rollout (every subject)", () => {
  withEnv({ [PROVIDER_VAR]: "livekit", [ALLOWLIST_VAR]: undefined }, () => {
    assert.equal(getMediaProviderForSubject("business-studies"), "livekit");
    assert.equal(getMediaProviderForSubject("english-stage-8"), "livekit");
    assert.equal(getMediaProviderForSubject("history-igcse-1"), "livekit");
  });
});

test("malformed provider config fails safe to cloudflare", () => {
  withEnv({ [PROVIDER_VAR]: "banana", [ALLOWLIST_VAR]: "business-studies" }, () => {
    assert.equal(getMediaProviderForSubject("business-studies"), "cloudflare");
  });

  withEnv({ [PROVIDER_VAR]: "", [ALLOWLIST_VAR]: "business-studies" }, () => {
    assert.equal(getMediaProviderForSubject("business-studies"), "cloudflare");
  });
});

test("malformed/unrecognized allowlist entries never accidentally grant livekit", () => {
  withEnv(
    { [PROVIDER_VAR]: "livekit", [ALLOWLIST_VAR]: "not-a-real-subject-key,, " },
    () => {
      assert.equal(getMediaProviderForSubject("business-studies"), "cloudflare");
      assert.equal(getMediaProviderForSubject("history"), "cloudflare");
    },
  );
});
