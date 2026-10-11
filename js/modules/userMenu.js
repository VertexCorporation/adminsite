// js/modules/userMenu.js

/**
 * Navbar kullanıcı menüsü (React Bits UserMenu uyarlaması — vanilla JS):
 * avatar (baş harfler) + isim + chevron; açılınca kimlik başlığı (isim, mail,
 * rank rozetleri), ayraç, Profil ve Çıkış öğeleri. Panelden yumuşak açılır.
 */

import { showToast, __ } from '../utils/ui.js';
import { auth } from '../core/firebase.js';
import { isPanelAdmin } from './roles.js';

const el = (id) => document.getElementById(id);

function initialsOf(name) {
    const parts = String(name || '').trim().split(/\s+/).slice(0, 2);
    return parts.map(p => p[0]?.toUpperCase() || '').join('') || '?';
}

function renderIdentity(user, departments) {
    const root = el('user-menu-root');
    if (!root) return;
    const rankBadges = isPanelAdmin()
        ? `<span class="user-menu-plan">${__('user_menu.admin')}</span>`
        : (departments?.length
            ? departments.map(d => `<span class="user-menu-plan">${d}</span>`).join('')
            : '');
    root.innerHTML = `
        <button type="button" id="user-menu-trigger" class="user-menu-trigger" aria-haspopup="menu" aria-expanded="false">
            <span class="user-menu-face">${initialsOf(user.displayName || user.email)}</span>
            <span class="user-menu-name">${user.displayName || user.email || '—'}</span>
            <span class="material-symbols-rounded user-menu-chevron">keyboard_arrow_down</span>
        </button>
        <div id="user-menu-pop" class="user-menu-pop" style="display:none;" role="menu">
            <div class="user-menu-header">
                <span class="user-menu-face user-menu-face-lg">${initialsOf(user.displayName || user.email)}</span>
                <div class="user-menu-identity">
                    <div class="user-menu-name-row">
                        <span class="user-menu-name-big">${user.displayName || '—'}</span>
                        ${rankBadges}
                    </div>
                    <span class="user-menu-mail" title="${user.email || ''}">${user.email || '—'}</span>
                </div>
            </div>
            <div class="user-menu-separator"></div>
            <button type="button" class="user-menu-item" data-action="profile" role="menuitem">
                <span class="material-symbols-rounded">person</span>
                <span>${__('user_menu.profile')}</span>
            </button>
            <button type="button" class="user-menu-item" data-action="chat" role="menuitem">
                <span class="material-symbols-rounded">forum</span>
                <span>${__('nav.chat')}</span>
            </button>
            <button type="button" class="user-menu-item" data-action="theme" role="menuitem">
                <span class="material-symbols-rounded">dark_mode</span>
                <span>${__('user_menu.theme')}</span>
            </button>
            <div class="user-menu-separator"></div>
            <button type="button" class="user-menu-item user-menu-danger" data-action="signout" role="menuitem">
                <span class="material-symbols-rounded">logout</span>
                <span>${__('header.logout')}</span>
            </button>
        </div>
    `;

    const trigger = el('user-menu-trigger');
    const pop = el('user-menu-pop');

    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const open = pop.style.display !== 'none';
        pop.style.display = open ? 'none' : 'block';
        trigger.setAttribute('aria-expanded', String(!open));
    });
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#user-menu-root')) {
            pop.style.display = 'none';
            trigger.setAttribute('aria-expanded', 'false');
        }
    });

    pop.querySelectorAll('.user-menu-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const action = item.dataset.action;
            if (action === 'profile') {
                pop.style.display = 'none';
                document.querySelector('.dock-btn[data-target="tab-profile"]')?.click();
            } else if (action === 'chat') {
                pop.style.display = 'none';
                document.querySelector('.dock-btn[data-target="tab-chat"]')?.click();
            } else if (action === 'theme') {
                // Mevcut tema düğmesiyle aynı davranış
                document.getElementById('theme-toggle-btn')?.click();
            } else if (action === 'signout') {
                pop.style.display = 'none';
                auth.signOut();
            }
        });
    });
}

export function initUserMenu() {
    if (!el('user-menu-root')) return;
    auth.onAuthStateChanged((user) => {
        if (user) {
            renderIdentity({ displayName: user.displayName, email: user.email }, null);
        } else {
            el('user-menu-root').innerHTML = '';
        }
    });
    // Departmanlar auth akışından sonra gelsin: renderProfile çağrısında güncellenir
    window.addEventListener('vertex:departments', (e) => {
        const user = auth.currentUser;
        if (user) renderIdentity({ displayName: user.displayName, email: user.email }, e.detail);
    });
}
