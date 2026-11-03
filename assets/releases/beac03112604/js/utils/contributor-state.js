// Contributor application flags are independent of Cortex/Auth membership.
export const isActiveContributor = person => person?.isVertex === true;
export function contributorState(person) {
    return person?.isVertex === true ? 'active' : person?.isVertex === false ? 'inactive' : 'unknown';
}
