import OpenAI, { toFile } from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  hasPdfSignature,
  isLessonReadingPdfPath,
  LESSON_READING_PDF_BUCKET,
} from "@/lib/lessons/pdfReading";
import { readingContentToPlainText } from "@/lib/readings/structuredReading";
import {
  getSubjectConfiguration,
  type SubjectKey,
} from "@/lib/subjects/subjectConfig";

type LessonStatusMode = "draft-or-published" | "published-only";
type PdfDetailLevel = "auto" | "high";

type ResolvedLessonReading = {
  lesson: {
    id: string;
    title: string;
    subjectId: string;
    status: "draft" | "published";
  };
  reading: {
    id: string;
    title: string;
    sourceType: "pasted_text" | "pdf";
    contentText: string | null;
    contentUrl: string | null;
    plainText: string | null;
  };
};

export type OpenAIReadingInput = {
  content: Array<
    | { type: "input_text"; text: string }
    | {
        type: "input_file";
        file_id: string;
        detail: PdfDetailLevel;
      }
  >;
  cleanup: () => Promise<void>;
};

export type OpenAIReadingInputContent = OpenAIReadingInput["content"];

// Lets a second, independent Kingdom call (PDF question verification) reuse
// the same already-uploaded OpenAI file instead of uploading the PDF again.
export function extractPdfFileId(
  content: OpenAIReadingInputContent,
): string | null {
  const fileEntry = content.find(
    (item): item is Extract<OpenAIReadingInputContent[number], { type: "input_file" }> =>
      item.type === "input_file",
  );
  return fileEntry?.file_id ?? null;
}

function cleanTitleForFilename(title: string) {
  const normalized = title
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9._ -]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized ? normalized.slice(0, 80) : "lesson-reading";
}

export async function resolveAuthoritativeLessonReading(args: {
  admin: SupabaseClient;
  subjectKey: SubjectKey;
  lessonId: string;
  lessonStatusMode: LessonStatusMode;
}) {
  const subject = getSubjectConfiguration(args.subjectKey);

  const { data: lesson, error: lessonError } = await args.admin
    .from("lessons")
    .select("id, title, subject_id, status")
    .eq("id", args.lessonId)
    .maybeSingle();

  if (lessonError) {
    throw new Error("The selected lesson could not be loaded.");
  }

  if (!lesson) {
    throw new Error("The selected lesson does not exist.");
  }

  if (lesson.subject_id !== subject.databaseId) {
    throw new Error(
      `The selected lesson is not a ${subject.displayName} lesson.`,
    );
  }

  if (
    args.lessonStatusMode === "published-only" &&
    lesson.status !== "published"
  ) {
    throw new Error("Only published lessons can be used by Kingdom.");
  }

  const { data: readingMaterial, error: readingError } = await args.admin
    .from("lesson_materials")
    .select("id, title, content_text, content_url, source_type")
    .eq("lesson_id", args.lessonId)
    .eq("material_type", "reading")
    .order("display_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (readingError) {
    throw new Error("The selected lesson reading could not be loaded.");
  }

  if (!readingMaterial) {
    throw new Error(
      "The selected lesson has no reading content for Kingdom to use.",
    );
  }

  const sourceType =
    readingMaterial.source_type === "pdf" ? "pdf" : "pasted_text";
  const plainText =
    sourceType === "pdf"
      ? null
      : readingContentToPlainText(readingMaterial.content_text ?? null).trim();

  if (sourceType === "pasted_text" && !plainText) {
    throw new Error(
      "The selected lesson has no reading content for Kingdom to use.",
    );
  }

  if (
    sourceType === "pdf" &&
    (!readingMaterial.content_url ||
      !isLessonReadingPdfPath(
        readingMaterial.content_url,
        lesson.subject_id,
        lesson.id,
      ))
  ) {
    throw new Error("The saved PDF reading could not be resolved securely.");
  }

  return {
    lesson: {
      id: lesson.id,
      title: lesson.title,
      subjectId: lesson.subject_id,
      status: lesson.status,
    },
    reading: {
      id: readingMaterial.id,
      title: readingMaterial.title ?? lesson.title,
      sourceType,
      contentText: readingMaterial.content_text,
      contentUrl: readingMaterial.content_url,
      plainText,
    },
  } satisfies ResolvedLessonReading;
}

export async function buildOpenAIStoredPdfInput(args: {
  admin: SupabaseClient;
  openai: OpenAI;
  storagePath: string;
  title: string;
  pdfDetail: PdfDetailLevel;
  introText?: string;
}) {
  const { data: pdfBlob, error: downloadError } = await args.admin.storage
    .from(LESSON_READING_PDF_BUCKET)
    .download(args.storagePath);

  if (downloadError || !pdfBlob) {
    throw new Error(
      "The saved PDF reading could not be downloaded from secure storage.",
    );
  }

  const bytes = new Uint8Array(await pdfBlob.arrayBuffer());
  if (!hasPdfSignature(bytes)) {
    throw new Error("The saved PDF reading is missing or invalid.");
  }

  const filename = `${cleanTitleForFilename(args.title)}.pdf`;
  const uploadedFile = await args.openai.files.create({
    file: await toFile(bytes, filename, { type: "application/pdf" }),
    purpose: "user_data",
    expires_after: {
      anchor: "created_at",
      seconds: 60 * 60,
    },
  });

  return {
    content: [
      {
        type: "input_text" as const,
        text: [
          `Authoritative lesson reading title: ${args.title}`,
          args.introText ??
            "Use the attached PDF as the authoritative saved lesson reading.",
          "The PDF may contain both text and visual source material. Do not invent evidence outside the attached PDF.",
        ].join("\n\n"),
      },
      {
        type: "input_file" as const,
        file_id: uploadedFile.id,
        detail: args.pdfDetail,
      },
    ],
    cleanup: async () => {
      try {
        await args.openai.files.delete(uploadedFile.id);
      } catch (error) {
        console.warn("Temporary OpenAI PDF cleanup failed:", {
          fileId: uploadedFile.id,
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  } satisfies OpenAIReadingInput;
}

export async function buildOpenAIReadingInput(args: {
  admin: SupabaseClient;
  openai: OpenAI;
  resolvedReading: ResolvedLessonReading;
  pdfDetail: PdfDetailLevel;
}) {
  if (args.resolvedReading.reading.sourceType === "pasted_text") {
    return {
      content: [
        {
          type: "input_text" as const,
          text: [
            `Authoritative lesson reading title: ${args.resolvedReading.reading.title}`,
            "Authoritative saved lesson reading:",
            args.resolvedReading.reading.plainText ?? "",
          ].join("\n\n"),
        },
      ],
      cleanup: async () => {},
    } satisfies OpenAIReadingInput;
  }

  const storagePath = args.resolvedReading.reading.contentUrl;
  if (!storagePath) {
    throw new Error("The saved PDF reading could not be resolved securely.");
  }

  return buildOpenAIStoredPdfInput({
    admin: args.admin,
    openai: args.openai,
    storagePath,
    title: args.resolvedReading.reading.title,
    pdfDetail: args.pdfDetail,
  });
}


