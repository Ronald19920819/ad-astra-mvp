import assert from "node:assert/strict";
import test from "node:test";
import type OpenAI from "openai";
import { verifyQuestionsAgainstPdf } from "./pdfQuestionVerification";

function mockOpenAI(outputText: string | undefined) {
  return {
    responses: {
      create: async () => ({ output_text: outputText }),
    },
  } as unknown as OpenAI;
}

function throwingOpenAI(error: Error) {
  return {
    responses: {
      create: async () => {
        throw error;
      },
    },
  } as unknown as OpenAI;
}

function resultsJson(
  results: Array<{ questionId: number; supported: boolean; reason: string }>,
) {
  return JSON.stringify({ results });
}

test("verifyQuestionsAgainstPdf makes no OpenAI call when there are no candidate questions", async () => {
  let called = false;
  const openai = {
    responses: {
      create: async () => {
        called = true;
        throw new Error("should not be called");
      },
    },
  } as unknown as OpenAI;

  const results = await verifyQuestionsAgainstPdf({
    openai,
    subjectKey: "history",
    fileId: "file_abc",
    detail: "auto",
    questions: [],
  });

  assert.deepEqual(results, []);
  assert.equal(called, false);
});

// --- History ---

test("History: PDF has only one source, question demands comparing Source A and B -> rejected", async () => {
  const openai = mockOpenAI(
    resultsJson([
      {
        questionId: 1,
        supported: false,
        reason: "The PDF only contains Source A; no Source B exists for comparison.",
      },
    ]),
  );

  const results = await verifyQuestionsAgainstPdf({
    openai,
    subjectKey: "history",
    fileId: "file_abc",
    detail: "auto",
    questions: [
      {
        id: 1,
        questionText: "Compare Sources A and B and explain which is more useful.",
        requirementLabel: "two suitable sources",
      },
    ],
  });

  assert.equal(results.length, 1);
  assert.equal(results[0].supported, false);
});

test("History: PDF contains both Source A and Source B -> supported", async () => {
  const openai = mockOpenAI(
    resultsJson([
      {
        questionId: 1,
        supported: true,
        reason: "Both Source A and Source B appear with enough content to compare.",
      },
    ]),
  );

  const results = await verifyQuestionsAgainstPdf({
    openai,
    subjectKey: "history",
    fileId: "file_abc",
    detail: "auto",
    questions: [
      {
        id: 1,
        questionText: "Compare Sources A and B and explain which is more useful.",
      },
    ],
  });

  assert.equal(results[0].supported, true);
});

test("History: PDF has no map, question says 'Study the map' -> rejected", async () => {
  const openai = mockOpenAI(
    resultsJson([
      { questionId: 5, supported: false, reason: "No map is present in the attached PDF." },
    ]),
  );

  const results = await verifyQuestionsAgainstPdf({
    openai,
    subjectKey: "history",
    fileId: "file_abc",
    detail: "high",
    questions: [
      {
        id: 5,
        questionText:
          "Study the map and explain why the location was strategically important.",
      },
    ],
  });

  assert.equal(results[0].supported, false);
});

test("History: PDF contains a map and the question is grounded in it -> supported", async () => {
  const openai = mockOpenAI(
    resultsJson([
      {
        questionId: 5,
        supported: true,
        reason: "A labelled map on page 2 shows the relevant location.",
      },
    ]),
  );

  const results = await verifyQuestionsAgainstPdf({
    openai,
    subjectKey: "history",
    fileId: "file_abc",
    detail: "high",
    questions: [
      {
        id: 5,
        questionText:
          "Study the map and explain why the location was strategically important.",
      },
    ],
  });

  assert.equal(results[0].supported, true);
});

// --- Business Studies ---

test("Business Studies: 'using the case study' with no case study in the PDF -> rejected", async () => {
  const openai = mockOpenAI(
    resultsJson([
      {
        questionId: 3,
        supported: false,
        reason: "No case study or named business appears in the PDF.",
      },
    ]),
  );

  const results = await verifyQuestionsAgainstPdf({
    openai,
    subjectKey: "business-studies",
    fileId: "file_abc",
    detail: "auto",
    questions: [
      {
        id: 3,
        questionText:
          "Using the case study, explain why Cape Harvest Foods may use wholesalers.",
        requirementLabel: "business context or case-study information",
      },
    ],
  });

  assert.equal(results[0].supported, false);
});

test("Business Studies: the relevant case study genuinely exists in the PDF -> supported", async () => {
  const openai = mockOpenAI(
    resultsJson([
      {
        questionId: 3,
        supported: true,
        reason: "The PDF describes Cape Harvest Foods and its distribution challenges.",
      },
    ]),
  );

  const results = await verifyQuestionsAgainstPdf({
    openai,
    subjectKey: "business-studies",
    fileId: "file_abc",
    detail: "auto",
    questions: [
      {
        id: 3,
        questionText:
          "Using the case study, explain why Cape Harvest Foods may use wholesalers.",
      },
    ],
  });

  assert.equal(results[0].supported, true);
});

// --- English / Afrikaans ---

test("English: extract-dependent question with a genuine text source in the PDF -> supported", async () => {
  const openai = mockOpenAI(
    resultsJson([
      {
        questionId: 2,
        supported: true,
        reason: "The PDF contains a labelled Extract with suspense-creating language.",
      },
    ]),
  );

  const results = await verifyQuestionsAgainstPdf({
    openai,
    subjectKey: "english",
    fileId: "file_abc",
    detail: "auto",
    questions: [
      {
        id: 2,
        questionText:
          "Identify two examples from the extract where the writer uses language to create suspense.",
      },
    ],
  });

  assert.equal(results[0].supported, true);
});

test("English: extract-dependent question with only explanatory teaching prose in the PDF -> rejected", async () => {
  const openai = mockOpenAI(
    resultsJson([
      {
        questionId: 2,
        supported: false,
        reason:
          "The PDF only contains teaching prose explaining narrative structure, not a genuine extract.",
      },
    ]),
  );

  const results = await verifyQuestionsAgainstPdf({
    openai,
    subjectKey: "english",
    fileId: "file_abc",
    detail: "auto",
    questions: [
      {
        id: 2,
        questionText:
          "Identify two examples from the extract where the writer uses language to create suspense in a non-linear narrative, and explain how these examples affect the reader.",
      },
    ],
  });

  assert.equal(results[0].supported, false);
});

test("Afrikaans: text-dependent question with a genuine source in the PDF -> supported", async () => {
  const openai = mockOpenAI(
    resultsJson([
      {
        questionId: 4,
        supported: true,
        reason: "The PDF contains a labelled Uittreksel with enough usable evidence.",
      },
    ]),
  );

  const results = await verifyQuestionsAgainstPdf({
    openai,
    subjectKey: "afrikaans",
    fileId: "file_abc",
    detail: "auto",
    questions: [
      {
        id: 4,
        questionText: "Haal twee voorbeelde uit die uittreksel aan wat spanning skep.",
      },
    ],
  });

  assert.equal(results[0].supported, true);
});

test("Afrikaans: text-dependent question with only teaching prose in the PDF -> rejected", async () => {
  const openai = mockOpenAI(
    resultsJson([
      {
        questionId: 4,
        supported: false,
        reason: "Only explanatory teaching prose is present; no genuine uittreksel exists.",
      },
    ]),
  );

  const results = await verifyQuestionsAgainstPdf({
    openai,
    subjectKey: "afrikaans",
    fileId: "file_abc",
    detail: "auto",
    questions: [
      {
        id: 4,
        questionText: "Haal twee voorbeelde uit die uittreksel aan wat spanning skep.",
      },
    ],
  });

  assert.equal(results[0].supported, false);
});

// --- Fail-safe behaviour ---

test("fail-safe: malformed (non-JSON) verifier response is treated as unsupported", async () => {
  const openai = mockOpenAI("not valid json {{{");

  const results = await verifyQuestionsAgainstPdf({
    openai,
    subjectKey: "history",
    fileId: "file_abc",
    detail: "auto",
    questions: [{ id: 9, questionText: "Compare Sources A and B." }],
  });

  assert.equal(results[0].supported, false);
  assert.match(results[0].reason, /could not verify/i);
});

test("fail-safe: empty verifier response is treated as unsupported", async () => {
  const openai = mockOpenAI(undefined);

  const results = await verifyQuestionsAgainstPdf({
    openai,
    subjectKey: "history",
    fileId: "file_abc",
    detail: "auto",
    questions: [{ id: 9, questionText: "Compare Sources A and B." }],
  });

  assert.equal(results[0].supported, false);
});

test("fail-safe: a question missing from the verifier's results is treated as unsupported", async () => {
  const openai = mockOpenAI(resultsJson([]));

  const results = await verifyQuestionsAgainstPdf({
    openai,
    subjectKey: "history",
    fileId: "file_abc",
    detail: "auto",
    questions: [{ id: 9, questionText: "Compare Sources A and B." }],
  });

  assert.equal(results[0].supported, false);
});

test("fail-safe: a non-boolean supported field is treated as unsupported", async () => {
  const openai = mockOpenAI(
    JSON.stringify({
      results: [{ questionId: 9, supported: "yes", reason: "Looks fine." }],
    }),
  );

  const results = await verifyQuestionsAgainstPdf({
    openai,
    subjectKey: "history",
    fileId: "file_abc",
    detail: "auto",
    questions: [{ id: 9, questionText: "Compare Sources A and B." }],
  });

  assert.equal(results[0].supported, false);
});

test("fail-safe: an OpenAI request failure is treated as unsupported", async () => {
  const openai = throwingOpenAI(new Error("network error"));

  const results = await verifyQuestionsAgainstPdf({
    openai,
    subjectKey: "history",
    fileId: "file_abc",
    detail: "auto",
    questions: [{ id: 9, questionText: "Compare Sources A and B." }],
  });

  assert.equal(results[0].supported, false);
  assert.match(results[0].reason, /could not verify/i);
});

test("batched verification returns one result per requested question", async () => {
  const openai = mockOpenAI(
    resultsJson([
      { questionId: 1, supported: true, reason: "Supported by Source A." },
      { questionId: 2, supported: false, reason: "No map exists." },
    ]),
  );

  const results = await verifyQuestionsAgainstPdf({
    openai,
    subjectKey: "history",
    fileId: "file_abc",
    detail: "high",
    questions: [
      { id: 1, questionText: "According to Source A, why did prices rise?" },
      { id: 2, questionText: "Study the map and explain its significance." },
    ],
  });

  assert.equal(results.length, 2);
  assert.equal(results.find((r) => r.questionId === 1)?.supported, true);
  assert.equal(results.find((r) => r.questionId === 2)?.supported, false);
});
