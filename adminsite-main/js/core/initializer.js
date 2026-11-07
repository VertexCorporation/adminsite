// js/core/initializer.js

import { startApp } from '../main.js';

/**
 * Vertex Admin Panel - Secure Initializer v4.0 (Modular)
 *
 * This script implements a robust, asynchronous startup sequence:
 * 1. Dynamically loads all required Firebase SDKs from the CDN.
 * 2. Fetches the Firebase configuration from a secure Cloud Function (`getConfig`).
 * 3. Initializes the main, default Firebase application only *after* receiving
 *    the secure configuration.
 * 4. Hides the loading spinner and starts the main application logic.
 *
 * This pattern prevents API key exposure, ensures all dependencies are loaded
 * before use, and provides a clean, fault-tolerant user experience on startup.
 */
(async () => {
    // Wait for the DOM to be fully loaded before doing anything.
    await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
    const appLoader = document.getElementById('app-loader');

    const loadScript = (url) => {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            script.async = true;
            script.onload = resolve;
            script.onerror = () => reject(new Error(`Failed to load script: ${url}`));
            document.head.appendChild(script);
        });
    };

    try {
        // --- DEBUG TOKEN SETUP (Must be before SDK load) ---
        if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
            self.FIREBASE_APPCHECK_DEBUG_TOKEN = "90187b16-44ba-4efb-a887-50c14cb24e1d";
        }

        console.log('[INIT] Stage 1: Loading Core Firebase SDK...');
        await loadScript("https://www.gstatic.com/firebasejs/11.0.0/firebase-app-compat.js");

        if (typeof firebase === 'undefined') {
            throw new Error("Firebase core SDK (app-compat) failed to load.");
        }
        console.log('[INIT] Stage 1a complete: Core Firebase SDK loaded.');

        console.log('[INIT] Stage 1b: Loading dependent Firebase service SDKs...');

        await Promise.all([
            loadScript("https://www.gstatic.com/firebasejs/11.0.0/firebase-auth-compat.js"),
            loadScript("https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore-compat.js"),
            loadScript("https://www.gstatic.com/firebasejs/11.0.0/firebase-storage-compat.js"),
            loadScript("https://www.gstatic.com/firebasejs/11.0.0/firebase-functions-compat.js"),
            loadScript("https://www.gstatic.com/firebasejs/11.0.0/firebase-app-check-compat.js")
        ]);
        console.log('[INIT] Stage 1b complete: All dependent Firebase SDKs loaded.');

        // --- Caching Logic ---
        console.log('[INIT] Stage 2: Retrieving server configuration...');
        let firebaseConfig;
        const cachedConfig = sessionStorage.getItem('firebaseConfig');

        if (cachedConfig) {
            console.log('[INIT] Configuration loaded from session cache.');
            firebaseConfig = JSON.parse(cachedConfig);
        } else {
            console.log('[INIT] No cache found. Fetching configuration from server...');
            const configUrl = "https://getappconfig-o5h7dmtija-ew.a.run.app";
            const response = await fetch(configUrl);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to fetch config. Server responded with ${response.status}. Body: ${errorText}`);
            }

            firebaseConfig = await response.json();

            sessionStorage.setItem('firebaseConfig', JSON.stringify(firebaseConfig));
            console.log('[INIT] Configuration fetched and cached for the session.');
        }

        if (!firebaseConfig || !firebaseConfig.apiKey) {
            sessionStorage.removeItem('firebaseConfig');
            throw new Error("Invalid or missing configuration received.");
        }
        console.log('[INIT] Stage 2 complete: Configuration successfully retrieved.');

        console.log('[INIT] Stage 3: Initializing main application...');

        if (typeof firebase.functions !== 'function') {
            throw new Error("Firebase Functions SDK did not attach to the firebase object correctly.");
        }

        // Pass the config to the main app function
        startApp(firebaseConfig);

    } catch (error) {
        console.error("CRITICAL [INIT]: Application failed to initialize.", error);
        if (appLoader) {
            appLoader.innerHTML = `<div style="color: #ff4d4d; font-family: 'Segoe UI', sans-serif; text-align: center; padding: 2rem;">
                <strong>Application Error</strong><br>
                A critical error occurred during startup. Please check the console for details and refresh the page.<br>
                <small style="color: #ffa5a5;">${error.message}</small>
            </div>`;
        }
    }
})();