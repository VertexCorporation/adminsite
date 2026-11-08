import { __ } from './ui.js';
// No persistence: callers explicitly download this private report.
const cell = (value) => {
  let text = String(value ?? '');
  // A validated E.164 mobile is numeric-only and cannot contain a formula.
  // Keep that value reusable as a normalized phone; neutralize other formulas.
  if (!/^\+905\d{9}$/.test(text) && (/^[\s]*[=+\-@]/.test(text) || /^[\t\r]/.test(text))) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
};
export function rosterCSV(plan) {
  const headers = [
    __('people.phone'),
    __('roster.ui.ePosta'),
    __('people.email'),
    __('roster.ui.emailVerified'),
    __('roster.ui.application'),
    __('roster.ui.cortexAccount'),
    __('homeCopy.department'),
    __('roster.ui.currentAdministratorRole'),
    __('roster.ui.proposedAdministratorRole'),
    __('roster.ui.roleReview'),
    __('people.joined'),
    __('roster.ui.dateSource'),
    __('roster.ui.previousVertexMembership'),
    __('roster.ui.proposedVertexMembership'),
    __('roster.ui.cortexPlus'),
    __('roster.ui.operationResult'),
    __('roster.ui.reviewReasons'),
  ];
  const rows = plan.rows.map((r) => [
    r.phone,
    r.name,
    r.email,
    r.emailVerified ? __('roster.ui.yes') : __('roster.ui.no'),
    r.application ? __('roster.ui.found') : __('roster.ui.notFound'),
    r.cortexAccount ? __('roster.ui.found') : __('roster.ui.notFound'),
    r.departments.join('; '),
    r.currentRoles.join('; '),
    r.proposedRoles.join('; '),
    r.roleReview,
    r.joining.value,
    r.joining.estimated ? __('roster.ui.estimatedApplication7Days') : __('rosterCopy.actual'),
    r.before.isVertex ? __('catalog.enabled') : __('people.inactive'),
    r.after.isVertex ? __('catalog.enabled') : __('people.inactive'),
    r.plus,
    r.result,
    r.reasons.join('; '),
  ]);
  // Keep outsiders in the same reusable export, without suggesting deactivation.
  for (const p of plan.activeOutside)
    rows.push([
      '',
      '',
      p.email,
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      __('catalog.enabled'),
      '',
      '',
      __('roster.ui.outsideReferenceListNoChangesMade'),
      p.uid,
    ]);
  return [headers, ...rows].map((row) => row.map(cell).join(',')).join('\r\n');
}

export function contributorRosterCSV(plan) {
  const headers = [
    __('people.phone'),
    __('roster.ui.ePosta'),
    __('people.email'),
    __('roster.ui.application'),
    __('roster.ui.contributorId'),
    __('homeCopy.department'),
    __('roster.ui.fieldPath'),
    __('roster.ui.previousIsvertex'),
    __('roster.ui.proposedIsvertex'),
    __('roster.ui.matchMethod'),
    __('roster.ui.operationResult'),
    __('roster.ui.reason'),
  ];
  return [
    headers,
    ...plan.rows.map((r) => [
      r.phone,
      r.name,
      r.email,
      r.application ? __('roster.ui.found') : __('roster.ui.notFound'),
      r.contributorId,
      r.department,
      r.path,
      r.application
        ? r.before?.fieldExists
          ? String(r.before.isVertex)
          : __('roster.ui.fieldMissing')
        : __('roster.ui.noApplication'),
      r.result === 'successful' || r.result === 'unchanged' ? 'true' : (r.after?.isVertex ?? ''),
      r.method,
      r.result,
      r.reasons.join('; '),
    ]),
  ]
    .map((row) => row.map(cell).join(','))
    .join('\r\n');
}
