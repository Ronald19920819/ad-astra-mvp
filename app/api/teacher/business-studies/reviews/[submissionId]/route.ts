// AD ASTRA -- REVIEW-RETURN EMAIL RELIABILITY REPAIR: this business-studies-
// specific URL was never actually business-studies-specific -- it always
// resolved authorization/subject validation from the request body's own
// subjectId, so English/History/Afrikaans reviews were already silently
// routed through here too. That coupling was misleading, so the real
// implementation now lives at the canonical, honestly-named
// app/api/teacher/reviews/[submissionId]/route.ts, used by every subject's
// review form. This file is kept ONLY as a thin compatibility re-export --
// never a second copy of the logic -- in case anything still requests the
// old URL.
export { POST } from "@/app/api/teacher/reviews/[submissionId]/route";
