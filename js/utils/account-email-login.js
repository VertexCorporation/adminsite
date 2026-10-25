// Resolve all password entry addresses on the server. Native-first login
// could otherwise open an old duplicate account with its independent password.
export async function signInWithAccountEmail(auth,call,email,password){
 const {data}=await call('signInWithPersonnelEmail',{email,password});
 if(typeof data?.token!=='string'||!data.token){
  const error=new Error('Invalid sign-in response.');error.code='auth/invalid-credential';throw error;
 }
 return auth.signInWithCustomToken(data.token);
}
