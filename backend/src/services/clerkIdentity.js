const {createClerkClient, verifyToken} = require('@clerk/backend');
const reject = (message, statusCode=401) => {throw Object.assign(new Error(message), {statusCode});};
const settings = () => {
  if (!process.env.CLERK_SECRET_KEY) reject('Email verification is not configured. Contact your administrator.', 503);
  return {secretKey:process.env.CLERK_SECRET_KEY, authorizedParties:(process.env.CLERK_AUTHORIZED_PARTIES || process.env.FRONTEND_URL || 'http://localhost:5173').split(',').map(s=>s.trim()).filter(Boolean)};
};
function createIdentityVerifier({verify=verifyToken, clientFactory=createClerkClient}={}) {
  return async token => {
    const options=settings();
    if (typeof token!=='string' || !token) reject('Email verification required');
    let claims, account, session;
    try {
      claims=await verify(token,options);
      if (!claims.sub || !claims.sid || !options.authorizedParties.includes(claims.azp)) reject('Email verification required');
      const client=clientFactory({secretKey:options.secretKey});
      [account,session]=await Promise.all([client.users.getUser(claims.sub),client.sessions.getSession(claims.sid)]);
    } catch {reject('Invalid or expired email verification');}
    if (session.status!=='active' || session.userId!==claims.sub || account.id!==claims.sub || account.banned || account.locked) reject('Invalid or expired email verification');
    const email=account.emailAddresses.find(e=>e.id===account.primaryEmailAddressId && e.verification?.status==='verified');
    if (!email) reject('Verify your email address before continuing');
    return {userId:account.id, sessionId:session.id, email:email.emailAddress.trim().toLowerCase()};
  };
}
async function assertSession(sessionId,userId) {
  const options=settings();
  try {
    const session=await createClerkClient({secretKey:options.secretKey}).sessions.getSession(sessionId);
    if (!userId || session.status!=='active' || session.userId!==userId) reject('Invalid session');
  } catch {reject('Invalid or expired refresh token');}
}
module.exports={verifyEmailIdentity:createIdentityVerifier(),createIdentityVerifier,assertSession};
