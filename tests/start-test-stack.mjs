#!/usr/bin/env node
/**
 * Starts the throw-away back end (own database + API on port 5155) and leaves it running so a
 * dev server can be pointed at it:
 *
 *   node tests/start-test-stack.mjs
 *   VITE_API_BASE=http://localhost:5155/api npm run dev      (in frontend/)
 *   node tests/stop-test-stack.mjs                            (stops the API and drops the database)
 */
import { startStack } from './lib/test-stack.mjs';
// RX_TEST_ENFORCE=1 turns sign-in enforcement on; RX_TEST_SMS=1 lets a test read the patient sign-in code (GET /api/_test/sms)
const { base, dbName } = await startStack({ port: 5155, env: { ...(process.env.RX_TEST_ENFORCE ? { Auth__Enforce: 'true' } : {}), ...(process.env.RX_TEST_SMS ? { Sms__Provider: 'test' } : {}) } });
console.log(`READY ${base}  (database ${dbName})`);
setInterval(() => {}, 1 << 30);
