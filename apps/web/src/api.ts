import type { components } from "@today/contracts";

export type Activity = components["schemas"]["Activity"];
export type ActivityDetail = components["schemas"]["ActivityDetail"];
export type Program = components["schemas"]["Program"];
export type ActivitySearch = {
  region?: string;
  from?: string;
  to?: string;
  activityType?: components["schemas"]["ActivityType"];
  freeOnly?: boolean;
  maxConfirmedPriceKrw?: number;
  query?: string;
  cursor?: string;
  limit?: number;
};

const apiBase = import.meta.env.VITE_API_BASE_URL || "/api/v1";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
  }
}

export async function apiGet<T>(
  path: string,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    headers: { accept: "application/json, application/problem+json" },
    credentials: "include",
    ...(signal ? { signal } : {}),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      title?: string;
      detail?: string;
      code?: string;
    } | null;
    throw new ApiError(
      response.status,
      body?.detail || body?.title || "요청을 처리하지 못했어요.",
      body?.code,
    );
  }
  return (await response.json()) as T;
}

export async function apiPatch(path: string, body: unknown): Promise<void> {
  const csrfCookie = document.cookie
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith("__Host-discovery_csrf="));
  const csrfToken = csrfCookie?.slice("__Host-discovery_csrf=".length);
  if (!csrfToken)
    throw new ApiError(
      403,
      "보안 확인 정보를 찾지 못했어요. 다시 로그인해 주세요.",
    );

  const response = await fetch(`${apiBase}${path}`, {
    method: "PATCH",
    headers: {
      accept: "application/json, application/problem+json",
      "content-type": "application/json",
      "x-csrf-token": csrfToken,
    },
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const result = (await response.json().catch(() => null)) as {
      title?: string;
      detail?: string;
      code?: string;
    } | null;
    throw new ApiError(
      response.status,
      result?.detail || result?.title || "요청을 처리하지 못했어요.",
      result?.code,
    );
  }
}

export function searchActivities(search: ActivitySearch, signal?: AbortSignal) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (value !== undefined && value !== null && value !== "")
      params.set(key, String(value));
  }
  return apiGet<{
    items: Activity[];
    nextCursor: string | null;
    generatedAt: string;
    researchSampleMode?: boolean;
  }>(`/activities${params.size ? `?${params.toString()}` : ""}`, signal);
}

export function formatDateRange(
  start: string | null,
  end: string | null,
): string {
  if (!start && !end) return "일정 확인 필요";
  if (start && end && start !== end)
    return `${start.replaceAll("-", ".")} – ${end.replaceAll("-", ".")}`;
  return (start || end)!.replaceAll("-", ".");
}

export function priceLabel(kind: Activity["priceKind"]): string {
  const labels: Record<Activity["priceKind"], string> = {
    FREE: "무료 확인",
    PAID: "유료 확인",
    MIXED: "일부 유료",
    UNKNOWN: "가격 미확인",
  };
  return labels[kind] ?? "가격 미확인";
}

export function safeHttpsUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    const hostname = url.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local")
    )
      return null;
    if (hostname.startsWith("[") || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname))
      return null;
    return url.toString();
  } catch {
    return null;
  }
}
