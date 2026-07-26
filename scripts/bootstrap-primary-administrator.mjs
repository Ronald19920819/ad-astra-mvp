import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const administratorEmail = process.env.BOOTSTRAP_ADMIN_EMAIL
  ?.trim()
  .toLowerCase();

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.",
  );
}

if (!administratorEmail) {
  throw new Error("BOOTSTRAP_ADMIN_EMAIL is required.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function findAuthUserByEmail(email) {
  const pageSize = 1000;

  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: pageSize,
    });

    if (error) throw error;

    const user = data.users.find(
      (candidate) => candidate.email?.trim().toLowerCase() === email,
    );
    if (user) return user;
    if (data.users.length < pageSize) return null;
  }
}

const authUser = await findAuthUserByEmail(administratorEmail);

if (!authUser) {
  throw new Error(
    "No existing Supabase Auth account matches BOOTSTRAP_ADMIN_EMAIL.",
  );
}

if (!authUser.email_confirmed_at) {
  throw new Error(
    "The Supabase Auth account must be email-verified before bootstrap.",
  );
}

const { data: teacherProfileId, error: bootstrapError } = await supabase.rpc(
  "bootstrap_primary_administrator",
  { p_auth_user_id: authUser.id },
);

if (bootstrapError) {
  if (bootstrapError.message.includes("AD_ASTRA_ADMINISTRATOR_ALREADY_EXISTS")) {
    throw new Error(
      "An AD Astra administrator already exists. The bootstrap refused to create another.",
    );
  }
  if (bootstrapError.message.includes("REQUIRED_SUBJECTS_NOT_FOUND")) {
    throw new Error(
      "One or more required AD Astra subjects are missing from Supabase.",
    );
  }
  throw bootstrapError;
}

const { data: profile, error: verificationError } = await supabase
  .from("profiles")
  .select(`
    first_name,
    surname,
    full_name,
    role,
    teacher_profile:teacher_profiles!inner(
      id,
      is_administrator,
      status,
      assignments:teacher_subjects(
        status,
        subject:subjects(name)
      )
    )
  `)
  .eq("auth_user_id", authUser.id)
  .single();

if (verificationError) throw verificationError;

const teacherProfile = Array.isArray(profile.teacher_profile)
  ? profile.teacher_profile[0]
  : profile.teacher_profile;
const assignedSubjects = (teacherProfile?.assignments ?? [])
  .flatMap((assignment) => {
    const subject = Array.isArray(assignment.subject)
      ? assignment.subject[0]
      : assignment.subject;
    return assignment.status === "active" && subject ? [subject.name] : [];
  })
  .sort();

if (
  profile.first_name !== "Ronald" ||
  profile.surname !== "Petersen" ||
  profile.full_name !== "Ronald Petersen" ||
  profile.role !== "teacher" ||
  teacherProfile?.id !== teacherProfileId ||
  teacherProfile?.is_administrator !== true ||
  teacherProfile?.status !== "active" ||
  assignedSubjects.join("|") !==
    ["Afrikaans", "Business Studies", "English", "History"].join("|")
) {
  throw new Error("Administrator bootstrap verification failed.");
}

console.info("Primary Teacher/Administrator bootstrap completed.", {
  teacherProfileId,
  displayName: profile.full_name,
  assignedSubjects,
});
