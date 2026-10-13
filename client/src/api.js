export const API_BASE_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:5000"
).replace(/\/+$/, "");

export async function parseApiResponse(response) {
  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error(
      response.ok
        ? "The server returned an invalid response."
        : "The server returned an unexpected error."
    );
  }

  if (!response.ok) {
    const message = data && typeof data.message === "string" ? data.message : "";
    throw new Error(message || `Request failed with status ${response.status}.`);
  }

  return data;
}
