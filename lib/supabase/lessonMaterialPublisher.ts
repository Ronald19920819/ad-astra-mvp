import { createClient } from "@/lib/supabase/client";

type PublishLessonMaterialInput = {
  lessonId: string;
  materialType: "reading" | "video" | "quiz";
  sourceType: "pasted_text" | "pdf" | "youtube";
  title: string;
  required: boolean;
  contentUrl?: string | null;
  contentText?: string | null;
  displayOrder?: number;
};

export async function publishLessonMaterial({
  lessonId,
  materialType,
  sourceType,
  title,
  required,
  contentUrl = null,
  contentText = null,
  displayOrder = 0,
}: PublishLessonMaterialInput) {
  const supabase = createClient();

  // Check whether this lesson already has this material type.
const { data: existingMaterial } = await supabase
  .from("lesson_materials")
  .select("id")
  .eq("lesson_id", lessonId)
  .eq("material_type", materialType)
  .maybeSingle();

let data;
let error;

if (existingMaterial) {
  ({ data, error } = await supabase
    .from("lesson_materials")
    .update({
      source_type: sourceType,
      title,
      required,
      content_url: contentUrl,
      content_text: contentText,
      display_order: displayOrder,
    })
    .eq("id", existingMaterial.id)
    .select()
    .single());
} else {
  ({ data, error } = await supabase
    .from("lesson_materials")
    .insert({
      lesson_id: lessonId,
      material_type: materialType,
      source_type: sourceType,
      title,
      required,
      content_url: contentUrl,
      content_text: contentText,
      display_order: displayOrder,
    })
    .select()
    .single());
}

  if (error) {
    console.error("Supabase lesson material publish error:", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });

    throw new Error(error.message);
  }

  return data;
}