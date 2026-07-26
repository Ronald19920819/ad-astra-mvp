export function getSupabaseErrorDetails(error: unknown) {
  if (error instanceof Error) {
    const databaseError = error as Error & {
      code?: unknown;
      details?: unknown;
      hint?: unknown;
    };

    return {
      name: error.name,
      message: error.message,
      code: typeof databaseError.code === "string" ? databaseError.code : null,
      details:
        typeof databaseError.details === "string"
          ? databaseError.details
          : null,
      hint: typeof databaseError.hint === "string" ? databaseError.hint : null,
      stack:
        process.env.NODE_ENV === "development" ? error.stack ?? null : null,
    };
  }

  if (error && typeof error === "object") {
    const databaseError = error as Record<string, unknown>;
    return {
      name: "SupabaseError",
      message:
        typeof databaseError.message === "string"
          ? databaseError.message
          : "Unknown Supabase error",
      code:
        typeof databaseError.code === "string" ? databaseError.code : null,
      details:
        typeof databaseError.details === "string"
          ? databaseError.details
          : null,
      hint:
        typeof databaseError.hint === "string" ? databaseError.hint : null,
      stack:
        process.env.NODE_ENV === "development" &&
        typeof databaseError.stack === "string"
          ? databaseError.stack
          : null,
    };
  }

  return {
    name: "UnknownError",
    message: typeof error === "string" ? error : "Unknown server error",
    code: null,
    details: null,
    hint: null,
    stack: null,
  };
}

export function logSupabaseError(context: string, error: unknown) {
  console.error(context, getSupabaseErrorDetails(error));
}
