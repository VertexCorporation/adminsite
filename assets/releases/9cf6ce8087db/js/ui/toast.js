import { icon } from '../utils/icons.js';
import { afterMotion, reducedMotion } from './motion.js';
import { __, onLangChange } from '../lang.js';

// Toast logic lives here; legacy imports are re-exported by utils/ui.js.
/**
 * Displays a toast notification message.
 * @param {string | (() => string)} message A render callback keeps translated text current.
 * @param {'info' | 'success' | 'error'} type The type of toast.
 */
const liveToasts = new Set();
const toastLimit=()=>Math.max(1,Math.min(innerWidth<721?2:innerWidth<1024?3:4,Math.floor((innerHeight-150)/85)));
const layoutAnimations = new WeakMap();
function toastLayout(change) {
    const host = document.getElementById('toast-container');
    if (!host) return;
    const before = new Map([...host.children].map(slot => [slot, slot.getBoundingClientRect().top]));
    change();
    if (reducedMotion()) return;
    requestAnimationFrame(() => {
        for (const [slot, top] of before) {
            if (!slot.isConnected) continue;
            layoutAnimations.get(slot)?.cancel();
            const delta = top - slot.getBoundingClientRect().top;
            if (Math.abs(delta) < 1) continue;
            // Animate only the slot, never the toast whose entrance owns its transform.
            const animation = slot.animate([{ transform: `translateY(${delta}px)` }, { transform: 'translateY(0)' }], {
                duration: 200, easing: 'cubic-bezier(.2,.8,.2,1)'
            });
            layoutAnimations.set(slot, animation);
            animation.finished.catch(() => {}).finally(() => {
                if (layoutAnimations.get(slot) === animation) layoutAnimations.delete(slot);
            });
        }
    });
}
export function dismissToasts(){[...liveToasts].forEach(item=>item.dismiss());}
export function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');if(!container)return;
    const text=()=>{try{const value=typeof message==='function'?message():message;return typeof value==='string'&&!/\[object Object\]|\(\)\s*=>|functions\/|PERMISSION_DENIED|auth\//.test(value)?value:__('errors.service');}catch{return __('errors.service');}};
    const duplicate=[...liveToasts].find(item=>item.type===type&&item.text()===text());if(duplicate)return duplicate.dismiss;
    const slot=document.createElement('div');slot.className='toast-slot';
    const toast=document.createElement('div');toast.className=`toast ${['success','error','warning'].includes(type)?type:'info'}`;toast.tabIndex=0;
    toast.setAttribute('role',type==='error'?'alert':'status');
    toast.innerHTML=`${icon(type==='success'?'circle-check':type==='error'?'alert-circle':type==='warning'?'alert-triangle':'info-circle')}<span class="toast-message"></span>`;
    const paint=()=>{toast.querySelector('.toast-message').textContent=text();toast.setAttribute('aria-label',text()+' · '+__('toast.dismiss_hint'));};paint();const unsubscribe=onLangChange(paint);
    let timer,dismissed=false;const item={type,text,dismiss};
    function dismiss(){if(dismissed)return;dismissed=true;clearTimeout(timer);unsubscribe();liveToasts.delete(item);toast.classList.remove('show');toast.classList.add('is-leaving');afterMotion(toast,()=>toastLayout(()=>slot.remove()),'transform');}
    const schedule=()=>{clearTimeout(timer);if(!dismissed)timer=setTimeout(dismiss,type==='error'?7500:5000);};
    toast.onclick=dismiss;toast.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();dismiss();}};
    toast.onmouseenter=()=>clearTimeout(timer);toast.onmouseleave=schedule;toast.onfocus=()=>clearTimeout(timer);toast.onblur=schedule;
    slot.appendChild(toast);toastLayout(()=>container.prepend(slot));liveToasts.add(item);while(liveToasts.size>toastLimit())[...liveToasts][0].dismiss();
    requestAnimationFrame(()=>{if(!dismissed)toast.classList.add('show');});schedule();return dismiss;
}
window.addEventListener('resize',()=>{while(liveToasts.size>toastLimit())[...liveToasts][0].dismiss();});

