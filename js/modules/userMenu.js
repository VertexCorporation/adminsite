import { openPopover, closePopover } from './shell.js';
import { __, sanitizeHTML, onLangChange } from '../utils/ui.js';
import { auth } from '../core/firebase.js';
import { isPanelAdmin } from './roles.js';

let departments = [];
function initialsOf(name) {
    return String(name || '').trim().split(/\s+/).slice(0,2).map(part => part[0]?.toUpperCase() || '').join('') || '?';
}
function renderIdentity() {
    const root = document.getElementById('user-menu-root');
    if (!root) return;
    if (document.querySelector('.account-popover.is-open')) closePopover({restoreFocus:false});
    const user = auth.currentUser;
    if (!user) {root.replaceChildren();return;}
    const name = sanitizeHTML(user.displayName || user.email || '—');
    const email = sanitizeHTML(user.email || '—');
    const face = sanitizeHTML(initialsOf(user.displayName || user.email));
    root.innerHTML = `<button type="button" id="user-menu-trigger" class="user-menu-trigger" aria-haspopup="dialog" aria-expanded="false" aria-label="${__('nav.profile')}"><span class="user-menu-face">${face}</span><span class="user-menu-name">${name}</span><i class="user-menu-chevron" data-icon="keyboard_arrow_down"></i></button>`;
    const trigger = root.querySelector('button');
    trigger.onclick = () => openPopover(trigger, {className:'account-popover',render(pop) {
        const ranks = isPanelAdmin() ? [__('user_menu.admin')] : departments;
        pop.innerHTML = `<div class="user-menu-header"><span class="user-menu-face user-menu-face-lg">${face}</span><div class="user-menu-identity"><div class="user-menu-name-big">${name}</div><span class="user-menu-mail">${email}</span><div class="dept-badges">${ranks.map(rank=>`<span class="user-menu-plan">${sanitizeHTML(rank)}</span>`).join('')}</div></div></div><div class="menu-list"><button type="button" class="menu-item" data-account="profile"><i data-icon="person"></i><span>${__('user_menu.profile')}</span></button><button type="button" class="menu-item" data-account="chat"><i data-icon="forum"></i><span>${__('nav.chat')}</span></button><button type="button" class="menu-item" data-account="theme"><i data-icon="dark_mode"></i><span>${__('user_menu.theme')}</span></button><button type="button" class="menu-item" data-account="signout"><i data-icon="logout"></i><span>${__('header.logout')}</span></button></div>`;
        pop.querySelectorAll('[data-account]').forEach(button => button.onclick = () => {
            closePopover();
            const action = button.dataset.account;
            if (action === 'profile' || action === 'chat') document.querySelector(`.dock-btn[data-target="tab-${action}"]`)?.click();
            if (action === 'theme') document.getElementById('theme-menu-btn')?.click();
            if (action === 'signout') auth.signOut();
        });
    }});
}
export function initUserMenu() {
    auth.onAuthStateChanged(renderIdentity);
    document.addEventListener('vertex:departments', event => {departments = event.detail || [];renderIdentity();});
    onLangChange(renderIdentity);
}
