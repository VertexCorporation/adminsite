const test = require('node:test');
const assert = require('node:assert/strict');
const createFunctions = require('./department-functions.cjs');

function fixture() {
    const calls = [];
    class HttpsError extends Error {
        constructor(code, message) { super(message); this.code = code; }
    }
    const functions = {
        https: { HttpsError },
        region: () => ({ https: { onCall: handler => handler } })
    };
    const auth = {
        listUsers: async (size, token) => {
            calls.push(['list', size, token]);
            return {
                users: [
                    { uid: 'a', email: 'a@example.com', customClaims: { department: 'Core' } },
                    { uid: 'b', email: 'b@example.com', customClaims: { departments: ['Pulse', 'Array'] } },
                    { uid: 'c', email: 'c@example.com', customClaims: {} }
                ],
                pageToken: 'next'
            };
        },
        getUserByEmail: async email => {
            calls.push(['get', email]);
            return { uid: 'a', customClaims: { admin: true, featureFlag: 'on', department: 'Core' } };
        },
        setCustomUserClaims: async (uid, claims) => calls.push(['set', uid, claims])
    };
    const api = createFunctions(functions, { auth: () => auth });
    return { api, calls };
}

const adminContext = { auth: { token: { admin: true } } };

test('only admins can list or change department assignments', async () => {
    const { api, calls } = fixture();
    await assert.rejects(api.listDepartmentUsers({}, {}), { code: 'permission-denied' });
    await assert.rejects(api.setUserDepartments({ email: 'a@example.com', departments: ['Core'] }, {}), { code: 'permission-denied' });
    assert.equal(calls.length, 0);
});

test('list includes legacy and multi-department claims, omits unassigned users', async () => {
    const { api, calls } = fixture();
    const result = await api.listDepartmentUsers({ pageToken: 'previous' }, adminContext);
    assert.deepEqual(result.users.map(user => user.departments), [['Core'], ['Pulse', 'Array']]);
    assert.equal(result.nextPageToken, 'next');
    assert.deepEqual(calls[0], ['list', 1000, 'previous']);
});

test('saving multiple departments preserves unrelated claims and legacy access', async () => {
    const { api, calls } = fixture();
    await api.setUserDepartments({ email: ' a@example.com ', departments: ['Pulse', 'Array'] }, adminContext);
    assert.deepEqual(calls[1], ['set', 'a', {
        admin: true, featureFlag: 'on', department: 'Pulse', departments: ['Pulse', 'Array']
    }]);
});

test('invalid or duplicate departments are rejected before changing a user', async () => {
    const { api, calls } = fixture();
    await assert.rejects(api.setUserDepartments({ email: 'a@example.com', departments: ['Core', 'Core'] }, adminContext), { code: 'invalid-argument' });
    await assert.rejects(api.setUserDepartments({ email: 'a@example.com', departments: ['Unknown'] }, adminContext), { code: 'invalid-argument' });
    assert.equal(calls.length, 0);
});
