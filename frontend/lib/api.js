const BASE = process.env.NEXT_PUBLIC_API ?? "http://localhost:8000";

export async function api(path, body) {
  let res;
  try {
    res = await fetch(BASE + path, {
      method: body === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error("Can't reach the API. Start the backend on port 8000 and try again.");
  }
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(typeof e.detail === "string" ? e.detail : res.statusText);
  }
  return res.json();
}
