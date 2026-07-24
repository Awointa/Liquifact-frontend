import { loadEnv } from "../config/env";

/**
 * Returns the backend API base URL, resolved from the environment.
 *
 * Resolution order:
 *  1. NEXT_PUBLIC_API_URL environment variable (validated to be a parseable URL).
 *  2. http://localhost:3001 as the development fallback.
 *
 * The returned string always has its trailing slash stripped so callers can
 * safely concatenate paths with a leading slash.
 *
 * @returns {string} Validated base URL without trailing slash.
 * @throws {Error} If NEXT_PUBLIC_API_URL is set but cannot be parsed as a URL.
 */
export function getApiBaseUrl() {
  // loadEnv().apiUrl is already validated with a default fallback,
  // so the parse should never throw.  The URL is still normalised through
  // new URL() so callers get a canonical origin+pathname (trailing slashes
  // stripped) regardless of the raw value in the environment.
  const parsed = new URL(loadEnv().apiUrl);
  return parsed.origin + parsed.pathname.replace(/\/$/, "");
}
