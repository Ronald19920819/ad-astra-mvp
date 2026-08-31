// Builds absolute application URLs for email templates. Deliberately not
// tied to a live Request (unlike the request.url-based pattern used for
// the password-reset redirectTo in
// app/api/auth/request-password-reset/route.ts) -- future operational
// emails such as outstanding-work or inactivity reminders will be
// triggered from contexts with no incoming request at all (a scheduled
// job), so every email template should go through this helper instead of
// each independently reinventing a base URL.

const LOCAL_DEVELOPMENT_URL = "http://localhost:3000";

function resolveConfiguredBaseUrl(): string {
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configuredSiteUrl) return configuredSiteUrl.replace(/\/+$/, "");

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) return `https://${vercelUrl}`;

  return LOCAL_DEVELOPMENT_URL;
}

// getAbsoluteAppUrl("/your-work/abc") -> "https://app.ad-astra.example/your-work/abc"
export function getAbsoluteAppUrl(path: string): string {
  const base = resolveConfiguredBaseUrl();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}
