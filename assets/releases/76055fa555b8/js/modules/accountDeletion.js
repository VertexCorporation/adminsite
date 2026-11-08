import { initPasswordResetModule } from './passwordReset.js';
import { initCustomerAccounts } from './customerAccounts.js';
import { auth, consolePeopleCall } from '../core/firebase.js';
import { isPanelAdmin } from './roles.js';
import { confirmDialog } from './shell.js';
import { __, userErrorMessage } from '../utils/ui.js';

// The server, not the sidebar, authorizes this destructive operation.
// A verified account lookup precedes each request; no arbitrary UID submission.
export function initAccountDeletionModule() {
    initPasswordResetModule();
    initCustomerAccounts();
    const byId = id => document.getElementById(id);
    const form = byId('account-deletion-search-form');
    if (!form) return;

    const emailInput = byId('account-deletion-email');
    const searchButton = byId('account-deletion-search-button');
    const summary = byId('account-deletion-summary');
    const nameOutput = byId('account-deletion-name-output');
    const emailOutput = byId('account-deletion-email-output');
    const uidOutput = byId('account-deletion-uid-output');
    const verifyInput = byId('account-deletion-verified');
    const confirmInput = byId('account-deletion-confirm-email');
    const deleteButton = byId('account-deletion-submit');
    const status = byId('account-deletion-status');
    let target = null;
    let busy = false;
    let lookupGeneration = 0;

    const normalize = value => String(value || '').trim().toLowerCase();
    const setStatus = (text, isError = false) => {
        status.textContent = text;
        status.classList.toggle('people-validation', isError);
    };
    const syncButton = () => {
        deleteButton.disabled = busy || !target || target.disabled === true ||
            !isPanelAdmin() || !auth.currentUser ||
            normalize(confirmInput.value) !== normalize(target.email) ||
            !verifyInput.checked;
    };
    const resetResult = () => {
        lookupGeneration++;
        target = null;
        summary.hidden = true;
        verifyInput.checked = false;
        confirmInput.value = '';
        syncButton();
    };

    emailInput.addEventListener('input', () => {
        resetResult();
        setStatus('');
    });
    verifyInput.addEventListener('change', syncButton);
    confirmInput.addEventListener('input', syncButton);
    document.addEventListener('vertex:access-changed', () => {
        resetResult();
        setStatus('');
    });

    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (busy || !isPanelAdmin() || !auth.currentUser) return;
        const email = normalize(emailInput.value);
        resetResult();
        const generation = lookupGeneration;
        if (!email || !emailInput.checkValidity()) return;
        busy = true;
        searchButton.disabled = true;
        setStatus(__('deleteAccount.searching'));
        try {
            const response = (await consolePeopleCall('listConsoleUsers', { search: email })).data;
            if (generation !== lookupGeneration) return;
            const match = (response.users || []).find(person => normalize(person.email) === email);
            if (!match) {
                setStatus(__('deleteAccount.not_found'), true);
                return;
            }
            if (match.uid === auth.currentUser.uid) {
                setStatus(__('deleteAccount.self_blocked'), true);
                return;
            }
            target = { uid: match.uid, email: match.email, name: match.name || '—', disabled: match.disabled === true };
            nameOutput.textContent = target.name;
            emailOutput.textContent = target.email;
            uidOutput.textContent = target.uid;
            summary.hidden = false;
            setStatus(target.disabled ? __('deleteAccount.disabled') : __('deleteAccount.review_warning'), target.disabled);
        } catch (error) {
            if (generation === lookupGeneration) setStatus(userErrorMessage(error), true);
        } finally {
            busy = false;
            searchButton.disabled = false;
            syncButton();
        }
    });

    deleteButton.addEventListener('click', async () => {
        syncButton();
        if (deleteButton.disabled || !target) return;
        const selected = { ...target };
        const confirmed = await confirmDialog(() => ({
            title: __('deleteAccount.confirm_title'),
            body: __('deleteAccount.confirm_body'),
            warning: __('deleteAccount.confirm_warning'),
            danger: true,
            confirmLabel: __('deleteAccount.action'),
            rows: [
                { label: __('deleteAccount.email_label'), value: selected.email },
                { label: 'UID', value: selected.uid }
            ]
        }));
        if (!confirmed || !isPanelAdmin() || !auth.currentUser ||
            !target || target.uid !== selected.uid) return;
        busy = true;
        searchButton.disabled = true;
        syncButton();
        setStatus(__('deleteAccount.submitting'));
        try {
            const { data } = await consolePeopleCall('adminRequestAccountDeletion', {
                uid: selected.uid,
                email: selected.email,
                confirmationEmail: confirmInput.value,
                ownershipVerified: verifyInput.checked
            });
            setStatus(__(data.status === 'already-pending' ? 'deleteAccount.already_pending' : 'deleteAccount.queued'));
            target = { ...selected, disabled: true };
            verifyInput.checked = false;
            confirmInput.value = '';
        } catch (error) {
            setStatus(userErrorMessage(error), true);
            resetResult(); // stale or changed targets require a new verified lookup
        } finally {
            busy = false;
            searchButton.disabled = false;
            syncButton();
        }
    });
}
