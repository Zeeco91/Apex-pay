const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface ApiFetchOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  accessToken?: string | null;
}

/**
 * Every request carries credentials so the httpOnly refresh-token cookie rides along —
 * the access token stays in memory only and is attached explicitly per-call.
 */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const isFormData = options.body instanceof FormData;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    credentials: "include",
    headers: {
      // Omit Content-Type for FormData — the browser sets its own multipart boundary.
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}),
    },
    body: isFormData
      ? (options.body as FormData)
      : options.body !== undefined
        ? JSON.stringify(options.body)
        : undefined,
  });

  const payload = await parseJsonSafely(response);

  if (!response.ok) {
    throw new ApiError(extractErrorMessage(payload), response.status);
  }

  if (isFailureEnvelope(payload)) {
    throw new ApiError(extractErrorMessage(payload), response.status);
  }

  return payload as T;
}

async function parseJsonSafely(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function isFailureEnvelope(payload: unknown): boolean {
  return (
    !!payload &&
    typeof payload === "object" &&
    "success" in payload &&
    (payload as { success: unknown }).success === false
  );
}

function extractErrorMessage(payload: unknown): string {
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (typeof record.message === "string") return record.message;
    if (Array.isArray(record.message)) return record.message.join(" ");
  }
  return "Something went wrong. Please try again.";
}
