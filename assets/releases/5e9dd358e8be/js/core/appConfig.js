// Public SDK config is served by the same origin. Override only for reviewed deployments.
const DEFAULT_CONFIG_URL = '/firebase-config.json';

// Infrastructure errors can omit CORS headers and surface as network failures.
// Retry this read only; authentication and configuration errors remain explicit.
export async function fetchFirebaseConfig({ fetchImpl = fetch, wait = ms => new Promise(resolve => setTimeout(resolve, ms)), fallbackUrl, configUrl = DEFAULT_CONFIG_URL } = {}) {
    let lastError;
    for (let attempt = 0; attempt < 3; attempt++) {
        let response;
        try {
            response = await fetchImpl(configUrl, { signal: AbortSignal.timeout(5000) });
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
    const fallback = await fetchImpl(fallbackUrl, { signal: AbortSignal.timeout(5000) });
    if (!fallback.ok) throw lastError;
    const config = await fallback.json();
    if (!config?.apiKey || config.projectId !== 'vertex-ai-1618' || !config.appId) throw new Error('Invalid application configuration');
    return config;
}
