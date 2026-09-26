const clerkEnabled = () => process.env.AUTH_PROVIDER !== 'local';
module.exports = {clerkEnabled};
