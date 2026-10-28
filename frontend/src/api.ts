// Empty selects same-origin routing. Separate deployments supply a public API
// origin; normalize copied URLs so a trailing slash cannot create //api redirects.
// Runtime-only service binding URLs must never be embedded in a static build.
export const apiBase = (
  (import.meta as unknown as { env: Record<string, string> }).env
    .VITE_API_BASE_URL || ""
).trim().replace(/\/+$/, "");

export async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, options);
  if (!response.ok) {
    let detail = `Request failed (${response.status}). Please try again.`;
    try {
      const body = await response.json();
      if (typeof body.detail === "string") detail = body.detail;
      else if (Array.isArray(body.detail))
        detail = body.detail.map((d: { msg: string }) => d.msg).join("; ");
    } catch {
      /* A proxy can return a non-JSON error page. */
    }
    throw new Error(detail);
  }
  return response.json();
}
