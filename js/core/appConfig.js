const CONFIG_URL = 'https://getappconfig-o5h7dmtija-ew.a.run.app';

// Infrastructure errors can omit CORS headers and surface as network failures.
// Retry this read only; authentication and configuration errors remain explicit.
export async function fetchFirebaseConfig({ fetchImpl = fetch, wait = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
    for (let attempt = 0; attempt < 3; attempt++) {
        let response;
        try {
            response = await fetchImpl(CONFIG_URL, { signal: AbortSignal.timeout(5000) });
        } catch (error) {
            if (attempt === 2) throw error;
            await wait(500 * (attempt + 1));
            continue;
        }
        if (!response.ok) {
            const error = new Error(`Configuration request failed (${response.status})`);
            if (attempt === 2 || (response.status !== 429 && response.status < 500)) throw error;
            await wait(500 * (attempt + 1));
            continue;
        }
        const config = await response.json();
        if (!config?.apiKey) throw new Error('Invalid application configuration');
        return config;
    }
}
