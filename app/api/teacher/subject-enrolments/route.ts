import {
  authorizeTeacher,
  teacherAuthorizationResponse,
} from "@/lib/supabase/teacherAuth";

type LearnerEnrolmentRow = {
  id: string;
  learner_profile_id: string;
  status: "pending" | "approved" | "declined";
  is_active: boolean;
  learner:
    | {
        id: string;
        grade: string | null;
        profile:
          | {
              first_name: string | null;
              surname: string | null;
              full_name: string | null;
            }
          | {
              first_name: string | null;
              surname: string | null;
              full_name: string | null;
            }[]
          | null;
      }
    | {
        id: string;
        grade: string | null;
        profile:
          | {
              first_name: string | null;
              surname: string | null;
              full_name: string | null;
            }
          | {
              first_name: string | null;
              surname: string | null;
              full_name: string | null;
            }[]
          | null;
      }[]
    | null;
};

function statusLabel(
  status: "pending" | "approved" | "declined",
  isActive: boolean,
) {
  if (status === "approved") return isActive ? "Active" : "Inactive";
  if (status === "pending") return "Pending";
  return "Declined";
}

function displayNameForEnrolment(
  enrolment: LearnerEnrolmentRow,
) {
  const learner = Array.isArray(enrolment.learner)
    ? enrolment.learner[0]
    : enrolment.learner;
  const profileValue = learner?.profile;
  const profile = Array.isArray(profileValue) ? profileValue[0] : profileValue;

  const firstName = profile?.first_name?.trim() ?? "";
  const surname = profile?.surname?.trim() ?? "";
  const fullName = profile?.full_name?.trim() ?? "";

  return {
    firstName,
    surname,
    fullName:
      [firstName, surname].filter(Boolean).join(" ") || fullName || "Learner",
    grade: learner?.grade?.trim() || null,
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const subjectId = url.searchParams.get("subjectId")?.trim();

  if (!subjectId) {
    return Response.json(
      { error: "A subject is required." },
      { status: 400 },
    );
  }

  const authorization = await authorizeTeacher(subjectId);
  if (!authorization.success) {
    return teacherAuthorizationResponse(authorization);
  }

  const { admin } = authorization.teacher;
  const { data, error } = await admin
    .from("learner_subjects")
    .select(`
      id,
      learner_profile_id,
      status,
      is_active,
      learner:learner_profiles(
        id,
        grade,
        profile:profiles(first_name, surname, full_name)
      )
    `)
    .eq("subject_id", subjectId);

  if (error) {
    console.error("Unable to load teacher subject enrolments:", error);
    return Response.json(
      { error: "Unable to load enrolled learners." },
      { status: 500 },
    );
  }

  const learners = ((data ?? []) as LearnerEnrolmentRow[])
    .map((enrolment) => {
      const learner = displayNameForEnrolment(enrolment);
      return {
        enrolmentId: enrolment.id,
        learnerProfileId: enrolment.learner_profile_id,
        firstName: learner.firstName,
        surname: learner.surname,
        fullName: learner.fullName,
        grade: learner.grade,
        status: enrolment.status,
        isActive: enrolment.is_active,
        statusLabel: statusLabel(enrolment.status, enrolment.is_active),
      };
    })
    .sort((learnerA, learnerB) => {
      const surnameOrder = learnerA.surname.localeCompare(learnerB.surname);
      if (surnameOrder !== 0) return surnameOrder;

      const firstNameOrder = learnerA.firstName.localeCompare(
        learnerB.firstName,
      );
      if (firstNameOrder !== 0) return firstNameOrder;

      return learnerA.fullName.localeCompare(learnerB.fullName);
    });

  return Response.json({ learners });
}

export async function POST(request: Request) {
  let body: {
    learnerProfileId?: string;
    sourceSubjectId?: string;
    targetSubjectId?: string;
    mode?: "move" | "assign";
  };

  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Invalid enrolment update." },
      { status: 400 },
    );
  }

  const learnerProfileId = body.learnerProfileId?.trim();
  const sourceSubjectId = body.sourceSubjectId?.trim();
  const targetSubjectId = body.targetSubjectId?.trim();
  const mode = body.mode;

  if (
    !learnerProfileId ||
    !sourceSubjectId ||
    !targetSubjectId ||
    (mode !== "move" && mode !== "assign")
  ) {
    return Response.json(
      { error: "Learner, source subject, destination subject and action are required." },
      { status: 400 },
    );
  }

  if (sourceSubjectId === targetSubjectId) {
    return Response.json(
      { error: "Choose a different destination subject." },
      { status: 400 },
    );
  }

  const authorization = await authorizeTeacher(sourceSubjectId);
  if (!authorization.success) {
    return teacherAuthorizationResponse(authorization);
  }

  const { admin, teacherProfileId, isAdministrator } = authorization.teacher;

  if (!isAdministrator) {
    const { data: destinationAssignment, error: destinationAssignmentError } =
      await admin
        .from("teacher_subjects")
        .select("id")
        .eq("teacher_profile_id", teacherProfileId)
        .eq("subject_id", targetSubjectId)
        .eq("status", "active")
        .maybeSingle();

    if (destinationAssignmentError) {
      console.error(
        "Unable to verify destination subject assignment:",
        destinationAssignmentError,
      );
      return Response.json(
        { error: "Unable to verify destination subject access." },
        { status: 500 },
      );
    }

    if (!destinationAssignment) {
      return Response.json(
        { error: "Teacher access to the destination subject is required." },
        { status: 403 },
      );
    }
  }

  const [{ data: sourceEnrolment, error: sourceError }, { data: targetSubject, error: targetSubjectError }] =
    await Promise.all([
      admin
        .from("learner_subjects")
        .select("id, learner_profile_id, subject_id, status, is_active")
        .eq("learner_profile_id", learnerProfileId)
        .eq("subject_id", sourceSubjectId)
        .maybeSingle(),
      admin.from("subjects").select("id").eq("id", targetSubjectId).maybeSingle(),
    ]);

  if (sourceError) {
    console.error("Unable to load source learner enrolment:", sourceError);
    return Response.json(
      { error: "Unable to load the learner enrolment." },
      { status: 500 },
    );
  }

  if (targetSubjectError) {
    console.error("Unable to verify destination subject:", targetSubjectError);
    return Response.json(
      { error: "Unable to verify the destination subject." },
      { status: 500 },
    );
  }

  if (!sourceEnrolment) {
    return Response.json(
      { error: "The learner is not enrolled in the selected subject." },
      { status: 404 },
    );
  }

  if (!targetSubject) {
    return Response.json(
      { error: "The destination subject could not be found." },
      { status: 404 },
    );
  }

  if (mode === "move" && !(sourceEnrolment.status === "approved" && sourceEnrolment.is_active)) {
    return Response.json(
      { error: "Only active enrolments can be moved. Use Assign Additional for inactive or pending enrolments." },
      { status: 409 },
    );
  }

  const now = new Date().toISOString();
  const { data: targetEnrolment, error: targetLookupError } = await admin
    .from("learner_subjects")
    .select("id, status, is_active, requested_at, approved_at, approved_by, reviewed_at, reviewed_by")
    .eq("learner_profile_id", learnerProfileId)
    .eq("subject_id", targetSubjectId)
    .maybeSingle();

  if (targetLookupError) {
    console.error("Unable to load destination learner enrolment:", targetLookupError);
    return Response.json(
      { error: "Unable to prepare the destination enrolment." },
      { status: 500 },
    );
  }

  if (targetEnrolment?.status === "approved" && targetEnrolment.is_active) {
    return Response.json(
      { error: "This learner already has an active enrolment in the destination subject." },
      { status: 409 },
    );
  }

  let destinationEnrolmentId: string | null = null;
  let createdDestination = false;

  try {
    if (targetEnrolment) {
      const { data: updatedTarget, error: targetUpdateError } = await admin
        .from("learner_subjects")
        .update({
          status: "approved",
          is_active: true,
          approved_at: targetEnrolment.approved_at ?? now,
          approved_by: targetEnrolment.approved_by ?? teacherProfileId,
          reviewed_at: now,
          reviewed_by: teacherProfileId,
        })
        .eq("id", targetEnrolment.id)
        .select("id")
        .single();

      if (targetUpdateError) throw targetUpdateError;
      destinationEnrolmentId = updatedTarget.id;
    } else {
      const { data: insertedTarget, error: insertError } = await admin
        .from("learner_subjects")
        .insert({
          learner_profile_id: learnerProfileId,
          subject_id: targetSubjectId,
          status: "approved",
          is_active: true,
          requested_at: now,
          approved_at: now,
          approved_by: teacherProfileId,
          reviewed_at: now,
          reviewed_by: teacherProfileId,
        })
        .select("id")
        .single();

      if (insertError) throw insertError;
      destinationEnrolmentId = insertedTarget.id;
      createdDestination = true;
    }

    if (mode === "move") {
      const { error: sourceDeactivateError } = await admin
        .from("learner_subjects")
        .update({
          is_active: false,
          reviewed_at: now,
          reviewed_by: teacherProfileId,
        })
        .eq("id", sourceEnrolment.id)
        .eq("status", "approved")
        .eq("is_active", true);

      if (sourceDeactivateError) throw sourceDeactivateError;
    }
  } catch (error) {
    if (destinationEnrolmentId) {
      if (createdDestination) {
        await admin
          .from("learner_subjects")
          .delete()
          .eq("id", destinationEnrolmentId);
      } else if (targetEnrolment) {
        await admin
          .from("learner_subjects")
          .update({
            status: targetEnrolment.status,
            is_active: targetEnrolment.is_active,
            requested_at: targetEnrolment.requested_at,
            approved_at: targetEnrolment.approved_at,
            approved_by: targetEnrolment.approved_by,
            reviewed_at: targetEnrolment.reviewed_at,
            reviewed_by: targetEnrolment.reviewed_by,
          })
          .eq("id", targetEnrolment.id);
      }
    }

    console.error("Unable to update learner enrolment:", error);
    return Response.json(
      {
        error:
          mode === "move"
            ? "The learner could not be moved to the selected subject."
            : "The learner could not be assigned to the selected subject.",
      },
      { status: 500 },
    );
  }

  return Response.json({
    success: true,
    message:
      mode === "move"
        ? "Learner moved successfully."
        : "Learner assigned successfully.",
  });
}
