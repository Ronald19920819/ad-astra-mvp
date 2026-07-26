export type ProfileIdentity = {
  firstName: string;
  surname: string;
  displayName: string;
  profileImageUrl: string | null;
};

type ProfileIdentitySource = {
  databaseFirstName?: string | null;
  databaseSurname?: string | null;
  databaseDisplayName?: string | null;
  metadataFirstName?: string | null;
  metadataSurname?: string | null;
  metadataDisplayName?: string | null;
  email?: string | null;
  roleFallback: "Learner" | "Teacher";
};

function clean(value: string | null | undefined) {
  return value?.trim() || "";
}

export function resolveProfileIdentity(source: ProfileIdentitySource) {
  const databaseFirstName = clean(source.databaseFirstName);
  const databaseSurname = clean(source.databaseSurname);
  const metadataFirstName = clean(source.metadataFirstName);
  const metadataSurname = clean(source.metadataSurname);
  const databaseName = [databaseFirstName, databaseSurname]
    .filter(Boolean)
    .join(" ");
  const metadataName = [metadataFirstName, metadataSurname]
    .filter(Boolean)
    .join(" ");
  const displayName =
    databaseName ||
    clean(source.databaseDisplayName) ||
    metadataName ||
    clean(source.metadataDisplayName) ||
    clean(source.email) ||
    source.roleFallback;
  const parts = displayName.split(/\s+/).filter(Boolean);

  return {
    firstName: databaseFirstName || metadataFirstName || parts[0] || "",
    surname:
      databaseSurname ||
      metadataSurname ||
      (parts.length > 1 ? parts.slice(1).join(" ") : ""),
    displayName,
  };
}

export function getProfileInitials(
  profile: Pick<ProfileIdentity, "firstName" | "surname" | "displayName"> | null,
  fallback: string,
) {
  if (!profile) return fallback;

  const initials =
    `${profile.firstName.trim().charAt(0)}${profile.surname.trim().charAt(0)}`
      .toUpperCase();

  return (
    initials ||
    profile.displayName.trim().charAt(0).toUpperCase() ||
    fallback
  );
}
