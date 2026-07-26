import { getPendingLearnerApprovals } from "@/lib/supabase/learnerApprovals";

export async function GET() {
  try {
    return Response.json({
      requests: await getPendingLearnerApprovals(),
    });
  } catch (error) {
    console.error("Unable to load learner approval requests:", error);
    const status =
      error && typeof error === "object" && "status" in error
        ? Number(error.status)
        : 500;
    return Response.json(
      {
        error:
          status === 500
            ? "Unable to load learner approval requests."
            : error instanceof Error
              ? error.message
              : "Unable to load learner approval requests.",
      },
      { status },
    );
  }
}
