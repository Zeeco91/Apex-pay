import { notifySessionExpired, refreshAccessToken } from "./session-bridge";

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

function doFetch(path: string, options: ApiFetchOptions, accessToken?: string | null): Promise<Response> {
  const isFormData = options.body instanceof FormData;
  return fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    credentials: "include",
    headers: {
      // Omit Content-Type for FormData — the browser sets its own multipart boundary.
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: isFormData
      ? (options.body as FormData)
      : options.body !== undefined
        ? JSON.stringify(options.body)
        : undefined,
  });
}

/**
 * Every request carries credentials so the httpOnly refresh-token cookie rides along —
 * the access token stays in memory only and is attached explicitly per-call.
 *
 * The in-memory access token is short-lived (15 minutes) and, before this, was only ever
 * refreshed once on page load — leaving any page open longer than that turned every
 * subsequent call into a bare "Unauthorized" with no recovery short of a manual reload. A 401
 * on a call that carried a token now triggers exactly one silent refresh-and-retry; only if
 * the refresh itself fails (refresh token also dead) does the session actually end.
 */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  let response = await doFetch(path, options, options.accessToken);

  if (response.status === 401 && options.accessToken) {
    try {
      const freshToken = await refreshAccessToken();
      response = await doFetch(path, options, freshToken);
    } catch {
      notifySessionExpired();
      // Fall through — response is still the original 401 and is thrown below as usual.
    }
  }

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
