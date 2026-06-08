// =============================================================================
// LAN emulation cashier - local test stub.
//
// This is a lightweight variant of qa/lan-emulation/cashier.js that
// runs in the playwright e2e test (which does not have a real
// backend to drive). It produces a JSON report with the same
// shape as the production script, but skips the actual
// browser automation.
//
// The production script (qa/lan-emulation/cashier.js) is the
// canonical one; it runs inside the docker-compose.lan-emulation
// containers against a real stack.
// =============================================================================

const fs = require('fs');
const path = require('path');

const RESULTS_DIR = process.env.RESULTS_DIR || path.join(__dirname, '..', '..', 'test-results', 'lan-emulation', 'results');

async function main() {
  const idx = parseInt(process.env.CASHIER_INDEX || '0', 10);
  const user = process.env.CASHIER_USER || 'cajero' + idx;
  const baseUrl = process.env.BASE_URL || 'https://127.0.0.1:8443';
  const scenario = process.env.SCENARIO || 'login_only';
  const startedAt = new Date().toISOString();
  const reachable = (process.env.STUB_REACHABLE || 'true') === 'true';

  await fs.promises.mkdir(RESULTS_DIR, { recursive: true });

  const steps = [
    { step: '/up', status: reachable ? 200 : 0, ms: 50 },
    { step: '/login', status: reachable ? 200 : 0, ms: 100 },
  ];

  if (reachable) {
    steps.push({ step: 'login', status: 200, ms: 200, landed_at: '/dashboard' });
    steps.push({ step: 'websocket', connected: true, state: 'connected', ms: 300 });
  }

  const result = {
    cashier: idx,
    user,
    base_url: baseUrl,
    scenario,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    steps,
    ok: reachable,
    console_errors: reachable ? [] : ['ERR_CONNECTION_REFUSED'],
  };

  const target = path.join(RESULTS_DIR, 'cashier' + idx + '.json');
  await fs.promises.writeFile(target, JSON.stringify(result, null, 2));
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.exit(reachable ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
