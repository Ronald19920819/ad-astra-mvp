import assert from "node:assert/strict";
import test from "node:test";
import {
  buildQuestionSpeechCacheInput,
  buildQuestionSpeechScript,
} from "./questionSpeech";

test("C: MCQ audio script contains the question followed by options A-D in order", () => {
  const script = buildQuestionSpeechScript({
    questionText: "Which of the following is an example of primary research?",
    options: {
      A: "Government statistics",
      B: "A questionnaire completed by customers",
      C: "A newspaper article",
      D: "A textbook",
    },
    marks: 1,
    language: "english",
  });

  const questionIndex = script.indexOf("Which of the following is an example of primary research?");
  const aIndex = script.indexOf("Option A. Government statistics.");
  const bIndex = script.indexOf("Option B. A questionnaire completed by customers.");
  const cIndex = script.indexOf("Option C. A newspaper article.");
  const dIndex = script.indexOf("Option D. A textbook.");

  assert.ok(questionIndex >= 0 && aIndex > questionIndex);
  assert.ok(aIndex < bIndex && bIndex < cIndex && cIndex < dIndex);
});

test("D: a missing option (not present, not just present-and-empty) is never spoken -- gaps in the middle are skipped without breaking the remaining order", () => {
  const script = buildQuestionSpeechScript({
    questionText: "Which option is missing?",
    options: { A: "First", C: "Third", D: "Fourth" }, // B genuinely absent
    marks: 1,
    language: "english",
  });

  assert.doesNotMatch(script, /Option B/);
  assert.match(script, /Option A\. First\./);
  assert.match(script, /Option C\. Third\./);
  assert.match(script, /Option D\. Fourth\./);

  const aIndex = script.indexOf("Option A");
  const cIndex = script.indexOf("Option C");
  const dIndex = script.indexOf("Option D");
  assert.ok(aIndex < cIndex && cIndex < dIndex);
});

test("an empty-string option is treated the same as a missing one -- never spoken as a blank option", () => {
  const script = buildQuestionSpeechScript({
    questionText: "Q",
    options: { A: "First", B: "", C: "   ", D: "Fourth" },
    marks: 1,
    language: "english",
  });
  assert.doesNotMatch(script, /Option B/);
  assert.doesNotMatch(script, /Option C/);
});

test("E: correct_option is never part of the input type at all -- there is no field the script builder could accidentally read to reveal the answer", () => {
  const script = buildQuestionSpeechScript({
    questionText: "Which of these is an example of primary research?",
    options: { A: "Right one", B: "Wrong one", C: "Also wrong", D: "Also wrong" },
    marks: 1,
    language: "english",
  });
  // No emphasis marker, no "correct", no asterisk, no special casing of
  // any particular option -- every option is spoken identically.
  assert.doesNotMatch(script, /correct/i);
  assert.match(script, /Option A\. Right one\./);
  assert.match(script, /Option B\. Wrong one\./);
});

test("F: a free-response activity question's audio contains the question only, when marks are not supplied", () => {
  const script = buildQuestionSpeechScript({
    questionText: "Discuss the impact of social media marketing on small businesses.",
    options: null,
    marks: null,
    language: "english",
  });
  assert.equal(script, "Discuss the impact of social media marketing on small businesses.");
});

test("a free-response question WITH known marks speaks a natural marks line, never the mechanical bracket form", () => {
  const script = buildQuestionSpeechScript({
    questionText: "Explain two benefits of primary research.",
    options: null,
    marks: 4,
    language: "english",
  });
  assert.match(script, /This question is worth 4 marks\./);
  assert.doesNotMatch(script, /\(4\)/);
  assert.doesNotMatch(script, /open bracket/i);
});

test("a free-response question worth exactly 1 mark uses the natural singular", () => {
  const script = buildQuestionSpeechScript({
    questionText: "Name one source of primary research.",
    options: null,
    marks: 1,
    language: "english",
  });
  assert.match(script, /This question is worth 1 mark\./);
  assert.doesNotMatch(script, /1 marks/);
});

test("MCQ questions never speak a marks line, even when marks are supplied -- matches the spec's own worked MCQ example", () => {
  const script = buildQuestionSpeechScript({
    questionText: "Pick one.",
    options: { A: "a", B: "b", C: "c", D: "d" },
    marks: 1,
    language: "english",
  });
  assert.doesNotMatch(script, /mark/i);
});

test("I: Afrikaans uses natural 'Opsie' labels, never the English 'Option' word forced onto an Afrikaans question", () => {
  const script = buildQuestionSpeechScript({
    questionText: "Watter van die volgende is 'n voorbeeld van primêre navorsing?",
    options: {
      A: "Regeringstatistieke",
      B: "'n Vraelys wat deur kliënte voltooi is",
      C: "'n Koerantartikel",
      D: "'n Handboek",
    },
    marks: 1,
    language: "afrikaans",
  });
  assert.match(script, /Opsie A\. Regeringstatistieke\./);
  assert.match(script, /Opsie B\./);
  assert.match(script, /Opsie C\./);
  assert.match(script, /Opsie D\. 'n Handboek\./);
  assert.doesNotMatch(script, /Option [A-D]/);
});

test("Afrikaans marks wording uses 'punt'/'punte', not the English 'mark(s)'", () => {
  const script4 = buildQuestionSpeechScript({
    questionText: "Verduidelik twee voordele van primêre navorsing.",
    options: null,
    marks: 4,
    language: "afrikaans",
  });
  assert.match(script4, /Hierdie vraag tel 4 punte\./);
  assert.doesNotMatch(script4, /marks?/i);

  const script1 = buildQuestionSpeechScript({
    questionText: "Noem een bron van primêre navorsing.",
    options: null,
    marks: 1,
    language: "afrikaans",
  });
  assert.match(script1, /Hierdie vraag tel 1 punt\./);
  assert.doesNotMatch(script1, /1 punte/);
});

test("J: the script contains no hidden marking metadata -- no question ID, no assessment objective code, no guidance text, no paper label, ever, given only question-content inputs", () => {
  const script = buildQuestionSpeechScript({
    questionText: "Study Source A. What impression does the source give of trench conditions?",
    options: null,
    marks: 6,
    language: "english",
  });
  assert.doesNotMatch(script, /AO\d/);
  assert.doesNotMatch(script, /guidance/i);
  assert.doesNotMatch(script, /paper/i);
  assert.doesNotMatch(script, /[0-9a-f]{8}-[0-9a-f]{4}/i); // no UUID-shaped fragment
});

test("visual/source-referring questions are read faithfully, verbatim, with no invented description of the source", () => {
  const script = buildQuestionSpeechScript({
    questionText: "Study Source A. What impression does the source give of trench conditions?",
    options: null,
    marks: 6,
    language: "english",
  });
  assert.equal(script, "Study Source A. What impression does the source give of trench conditions?\n\nThis question is worth 6 marks.");
});

test("whitespace in the question text and option text is trimmed, never spoken with leading/trailing padding", () => {
  const script = buildQuestionSpeechScript({
    questionText: "  Padded question?  ",
    options: { A: "  Padded option  ", B: null, C: null, D: null },
    marks: 1,
    language: "english",
  });
  assert.match(script, /^Padded question\?/);
  assert.match(script, /Option A\. Padded option\./);
});

test("K: buildQuestionSpeechCacheInput binds the script to both language and voice -- an identical script spoken in a different voice or language produces a different cache identity", () => {
  const script = "Some question.";
  const englishCedar = buildQuestionSpeechCacheInput({ script, language: "english", voice: "cedar" });
  const afrikaansMarin = buildQuestionSpeechCacheInput({ script, language: "afrikaans", voice: "marin" });
  const englishMarin = buildQuestionSpeechCacheInput({ script, language: "english", voice: "marin" });

  assert.notEqual(englishCedar, afrikaansMarin);
  assert.notEqual(englishCedar, englishMarin);
  assert.notEqual(afrikaansMarin, englishMarin);
});

test("K: changing the question text (or any option) changes the script, and therefore changes the cache input -- a question edit invalidates old cached audio", () => {
  const original = buildQuestionSpeechScript({
    questionText: "Which of the following is an example of primary research?",
    options: { A: "Government statistics", B: null, C: null, D: null },
    marks: 1,
    language: "english",
  });
  const edited = buildQuestionSpeechScript({
    questionText: "Which of the following is an example of primary research methods?",
    options: { A: "Government statistics", B: null, C: null, D: null },
    marks: 1,
    language: "english",
  });

  assert.notEqual(original, edited);
  assert.notEqual(
    buildQuestionSpeechCacheInput({ script: original, language: "english", voice: "cedar" }),
    buildQuestionSpeechCacheInput({ script: edited, language: "english", voice: "cedar" }),
  );
});
