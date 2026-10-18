const CONFIG_URL = 'https://getappconfig-o5h7dmtija-ew.a.run.app';

// Infrastructure errors can omit CORS headers and surface as network failures.
// Retry this read only; authentication and configuration errors remain explicit.
export async function fetchFirebaseConfig({ fetchImpl = fetch, wait = ms => new Promise(resolve => setTimeout(resolve, ms)), fallbackUrl } = {}) {
    let lastError;
    for (let attempt = 0; attempt < 3; attempt++) {
        let response;
        try {
            response = await fetchImpl(CONFIG_URL, { signal: AbortSignal.timeout(5000) });
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
    const fallback = await fetchImpl(fallbackUrl || new URL('../../firebase-config.json', import.meta.url), { signal: AbortSignal.timeout(5000) });
    if (!fallback.ok) throw lastError;
    const config = await fallback.json();
    if (!config?.apiKey || config.projectId !== 'vertex-ai-1618' || !config.appId) throw new Error('Invalid application configuration');
    return config;
}
