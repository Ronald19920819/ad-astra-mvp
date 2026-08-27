// Temporary local test-runner shim: node:test's CLI glob-expands any path
// argument, and this route's real path contains a bracketed dynamic-segment
// directory ([learnerId]), which node:test's glob matcher misinterprets as
// a character class rather than a literal folder name. Importing the file
// directly (a plain ESM specifier, never glob-expanded) sidesteps that
// entirely while still registering its node:test test() calls normally.
// Not part of the app; safe to delete.
await import(
  "../app/api/administrator/learners/[learnerId]/accessibility/route.test.ts"
);
await import(
  "../app/api/lessons/[lessonId]/accessibility-audio/route.test.ts"
);
await import(
  "../app/api/lessons/[lessonId]/quiz-question-audio/route.test.ts"
);
await import(
  "../app/api/activities/[activityId]/question-audio/route.test.ts"
);
