// Drop-in Cloud Functions v1 exports for the Firebase Functions project.
// Register with: Object.assign(exports, require('./department-functions.cjs')(functions, admin));
const DEPARTMENTS = new Set([
    'Essence', 'Core', 'Senatus', 'Pulse', 'Chroma', 'Catalyst',
    'Envoy', 'Aero', 'Array', 'Scout', 'Vertest'
]);

module.exports = (functions, admin) => {
    const requireAdmin = context => {
        if (!context.auth?.token?.admin) {
            throw new functions.https.HttpsError('permission-denied', 'Administrator access required.');
        }
    };

    return {
        listDepartmentUsers: functions.region('europe-west1').https.onCall(async (data, context) => {
            requireAdmin(context);
            const pageToken = typeof data?.pageToken === 'string' ? data.pageToken : undefined;
            const page = await admin.auth().listUsers(1000, pageToken);
            const users = page.users.flatMap(user => {
                const claims = user.customClaims || {};
                const departments = Array.isArray(claims.departments)
                    ? claims.departments.filter(id => DEPARTMENTS.has(id))
                    : (DEPARTMENTS.has(claims.department) ? [claims.department] : []);
                if (!departments.length) return [];
                return [{
                    uid: user.uid,
                    email: user.email || '',
                    displayName: user.displayName || '',
                    departments
                }];
            });
            return { users, nextPageToken: page.pageToken || null };
        }),

        setUserDepartments: functions.region('europe-west1').https.onCall(async (data, context) => {
            requireAdmin(context);
            const email = typeof data?.email === 'string' ? data.email.trim() : '';
            const departments = data?.departments;
            if (!email || !Array.isArray(departments) || !departments.length ||
                new Set(departments).size !== departments.length ||
                departments.some(id => !DEPARTMENTS.has(id))) {
                throw new functions.https.HttpsError('invalid-argument', 'A valid email and unique departments are required.');
            }
            let user;
            try {
                user = await admin.auth().getUserByEmail(email);
            } catch (error) {
                if (error.code === 'auth/user-not-found') {
                    throw new functions.https.HttpsError('not-found', 'User not found.');
                }
                throw error;
            }
            await admin.auth().setCustomUserClaims(user.uid, {
                ...(user.customClaims || {}),
                departments,
                department: departments[0] // Keeps older clients working during migration.
            });
            return { uid: user.uid, departments };
        })
    };
};
