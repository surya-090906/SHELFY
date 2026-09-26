const { AsyncLocalStorage } = require('node:async_hooks');
const context = new AsyncLocalStorage();
const current = () => { const c = context.getStore(); if (!Number.isInteger(c?.tenant_id)) throw Object.assign(new Error('Company context required'), { statusCode: 401 }); return c; };
const run = (value, fn) => context.run(value, fn);
module.exports = { current, run };
