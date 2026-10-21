// Enable only in a release made after the corresponding Fulcrum functions
// have been deployed and verified. This is rollout coordination, not authorization.
export const deploymentCapabilities = Object.freeze({
    contributorMembershipWrites: true,
    eventRegistrationPages: false,
    newsRevisions: false,
    notificationStatus: false,
    chatReadPositions: false,
    bulkSubscriptionPreview: false,
    contributorRoster: false,
    consolePeople: true,
    consoleAccountActivation: true,
    consoleMembershipWrites: false,
    consolePersonnelWrites: false
});
