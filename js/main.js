// js/main.js

import { initFirebase, auth } from './core/firebase.js';
import * as dom from './utils/dom.js';
import { showToast, __, getLang, setLang, translatePage } from './utils/ui.js';

// Import module initializers
import { initAdminModule } from './modules/admin.js';
import { initModelsModule, fetchFullModelsData } from './modules/models.js';
import { initNewsModule, listenForArticles, stopListeningForArticles } from './modules/news.js';
import { initNotificationModule, listenForScheduledTasks, stopListeningForScheduledTasks } from './modules/notification.js';
import { initContributorsModule, fetchContributorsData } from './modules/contributors.js';

/**
 * The main application function.
 * This is called by the initializer after all SDKs and the Firebase config are loaded.
 * @param {object} firebaseConfig The secure Firebase configuration object.
 */
export function startApp(firebaseConfig) {
    // --- Step 1: Initialize Firebase ---
    initFirebase(firebaseConfig);
    console.log('[APP] Main application started.');

    // --- Step 2: Initialize All Feature Modules (Bind Static Event Listeners) ---
    // These listeners are safe to add now, as they are attached to elements
    // that are always present in the DOM.
    initAdminModule();
    initModelsModule(); // CORRECTED: Calls the new unified initializer
    initNewsModule();
    initNotificationModule();
    initContributorsModule();

    // --- Step 3: Set up the Core Authentication State Listener ---
    // This is the central control point that reacts to user login/logout.
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            // --- User is LOGGED IN ---
            console.log(`[AUTH] User signed in: ${user.email}`);
            dom.loginContainer.style.display = 'none';
            dom.adminPanel.style.display = 'block';

            try {
                // Verify admin privileges
                const idTokenResult = await user.getIdTokenResult(true);
                if (!idTokenResult.claims.admin) {
                    throw new Error("User does not have admin privileges.");
                }

                console.log("[AUTH] Access Level: Admin. Full panel enabled.");
                dom.adminManagerSection.style.display = 'block';

                // Fetch data and start real-time listeners for the admin session
                fetchFullModelsData();
                listenForArticles();
                listenForScheduledTasks();
                fetchContributorsData();

            } catch (error) {
                console.error("[AUTH] Admin check failed:", error.message);
                showToast("You are not authorized to access this panel.", "error");
                auth.signOut(); // Force sign out if not an admin
            }
        } else {
            // --- User is LOGGED OUT ---
            console.log("[AUTH] No user signed in. Displaying login page.");
            dom.loginContainer.style.display = 'block';
            dom.adminPanel.style.display = 'none';

            // Clean up: Stop all real-time listeners to prevent memory leaks
            // and unnecessary background operations.
            stopListeningForArticles();
            stopListeningForScheduledTasks();
        }
    });

    // --- Step 4: Bind Login/Logout Button Listeners ---
    dom.loginBtn.addEventListener('click', () => {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        if (email && password) {
            auth.signInWithEmailAndPassword(email, password)
                .catch(error => showToast(`Login Failed: ${error.message}`, 'error'));
        } else {
            showToast('Please enter both email and password.', 'info');
        }
    });

    // --- Google Sign-In ---
    const googleLoginBtn = document.getElementById('google-login-btn');
    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (googleLoginBtn.classList.contains('is-loading')) return;
            googleLoginBtn.classList.add('is-loading');
            const provider = new firebase.auth.GoogleAuthProvider();
            auth.signInWithPopup(provider)
                .then(() => {
                    // Success - auth state listener will handle the rest
                })
                .catch(error => {
                    console.error('[AUTH] Google sign-in error:', error);
                    if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
                        showToast(`Google Login Failed: ${error.message}`, 'error');
                    }
                })
                .finally(() => {
                    googleLoginBtn.classList.remove('is-loading');
                });
        });
    }

    // --- Apple Sign-In ---
    const appleLoginBtn = document.getElementById('apple-login-btn');
    if (appleLoginBtn) {
        appleLoginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (appleLoginBtn.classList.contains('is-loading')) return;
            appleLoginBtn.classList.add('is-loading');
            const provider = new firebase.auth.OAuthProvider('apple.com');
            provider.addScope('email');
            provider.addScope('name');
            auth.signInWithPopup(provider)
                .then(() => {
                    // Success - auth state listener will handle the rest
                })
                .catch(error => {
                    console.error('[AUTH] Apple sign-in error:', error);
                    if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
                        showToast(`Apple Login Failed: ${error.message}`, 'error');
                    }
                })
                .finally(() => {
                    appleLoginBtn.classList.remove('is-loading');
                });
        });
    }

    dom.logoutBtn.addEventListener('click', () => auth.signOut());

    // --- Step 5: Bind Theme Toggle Listener ---
    const themeToggleButton = document.getElementById('theme-toggle-btn');
    themeToggleButton.addEventListener('click', () => {
        const htmlElement = document.documentElement;
        // Toggle the 'light' theme
        if (htmlElement.hasAttribute('data-theme')) {
            htmlElement.removeAttribute('data-theme');
            localStorage.setItem('theme', 'dark');
        } else {
            htmlElement.setAttribute('data-theme', 'light');
            localStorage.setItem('theme', 'light');
        }
    });

    // --- Step 6: Bind Language Toggle ---
    const langToggleBtn = document.getElementById('lang-toggle-btn');
    if (langToggleBtn) {
        const langIndicator = document.getElementById('lang-indicator');
        langToggleBtn.addEventListener('click', () => {
            const current = getLang();
            const next = current === 'tr' ? 'en' : 'tr';
            setLang(next);
            if (langIndicator) {
                langIndicator.textContent = __('lang.flag');
            }
            showToast(`Language: ${__('lang.name')}`, 'info');
        });
        // Initialize lang indicator and apply saved language
        translatePage();
        if (langIndicator) {
            langIndicator.textContent = __('lang.flag');
        }
    }

    // --- Step 7: Hide Loader and Show App ---
    // The app is now fully initialized and ready.
    if (dom.appLoader) {
        dom.appLoader.classList.add('hidden');
        // Remove the loader from the DOM after the transition for a cleaner structure
        dom.appLoader.addEventListener('transitionend', () => {
           dom.appLoader.remove();
        }, { once: true });
    }
}