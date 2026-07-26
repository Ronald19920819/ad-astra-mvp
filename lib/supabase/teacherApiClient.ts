export class TeacherApiError extends Error {
  constructor(
    message: string,
    readonly code: string | null,
    readonly status: number,
  ) {
    super(message);
    this.name = "TeacherApiError";
  }
}

export async function teacherApiRequest<T>(
  url: string,
  init: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  const result = (await response.json().catch(() => null)) as {
    data?: T;
    error?: string;
    code?: string;
  } | null;

  if (!response.ok || !result?.data) {
    throw new TeacherApiError(
      result?.error || "The teacher action could not be completed.",
      result?.code ?? null,
      response.status,
    );
  }

  return result.data;
}
