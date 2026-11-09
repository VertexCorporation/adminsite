// Public SDK config is served by the same origin. Override only for reviewed deployments.
const DEFAULT_CONFIG_URL = '/firebase-config.json';

// AbortSignal.timeout is unavailable in older Samsung Internet releases.
// AbortController has much broader support and keeps the same per-request bound.
async function fetchWithTimeout(fetchImpl, url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Infrastructure errors can omit CORS headers and surface as network failures.
// Retry this read only; authentication and configuration errors remain explicit.
export async function fetchFirebaseConfig({
  fetchImpl = fetch,
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  fallbackUrl,
  configUrl = DEFAULT_CONFIG_URL,
  timeoutMs = 5000,
} = {}) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    let response;
    try {
      response = await fetchWithTimeout(fetchImpl, configUrl, timeoutMs);
    } catch (error) {
      lastError = error;
      if (attempt === 2) break;
      await wait(500 * (attempt + 1));
      continue;
    }
    if (!response.ok) {
      const error = new Error(`Configuration request failed (${response.status})`);
      if (response.status !== 429 && response.status < 500) throw error;
      lastError = error;
      if (attempt === 2) break;
      await wait(500 * (attempt + 1));
      continue;
    }
    const config = await response.json();
    if (!config?.apiKey) throw new Error('Invalid application configuration');
    return config;
  }
  // This contains Firebase's public web SDK settings, never server secrets.
  // Authentication and all backend authorization still run as usual.
  if (!fallbackUrl || fallbackUrl === configUrl) throw lastError || new Error('Configuration unavailable');
  const fallback = await fetchWithTimeout(fetchImpl, fallbackUrl, timeoutMs);
  if (!fallback.ok) throw lastError;
  const config = await fallback.json();
  if (!config?.apiKey || config.projectId !== 'vertex-ai-1618' || !config.appId)
    throw new Error('Invalid application configuration');
  return config;
}
