// =============================================================================
// LAN emulation orchestrator - runs after cashier1..5 finish.
//
// Reads each cashier's JSON, validates that all five reached the
// dashboard, opens a websocket, and that the total wall-clock time
// fits within the SLA. Emits a consolidated report at
// /work/results/lan-emulation-report.json.
//
// Exit 0 = all cashiers OK and within SLA.
// Exit 1 = at least one cashier failed.
// Exit 2 = orchestrator itself failed.
// =============================================================================

const fs = require('fs');
const path = require('path');

const RESULTS_DIR = process.env.LAN_EMULATION_RESULTS_DIR || '/work/results';

const SLA_TOTAL_MS = 60_000;
const RESULT_WAIT_MS = 90_000;
const EXPECTED_CASHIERS = parseInt(process.env.EXPECTED_CASHIERS || '5', 10);
const RUN_ID = process.env.LAN_EMULATION_RUN_ID || '';

async function readJson(p) {
  const raw = await fs.promises.readFile(p, 'utf-8');
  return JSON.parse(raw);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function listResultFiles() {
  try {
    return (await fs.promises.readdir(RESULTS_DIR))
      .filter((f) => /^cashier\d+\.json$/.test(f))
      .sort();
  } catch (err) {
    if (err && err.code === 'ENOENT') return [];
    throw err;
  }
}

async function waitForFreshResults() {
  const deadline = Date.now() + RESULT_WAIT_MS;
  let lastSeen = [];

  while (Date.now() <= deadline) {
    const files = await listResultFiles();
    lastSeen = files;

    if (files.length >= EXPECTED_CASHIERS) {
      const cashiers = [];
      for (const file of files.slice(0, EXPECTED_CASHIERS)) {
        try {
          cashiers.push(await readJson(path.join(RESULTS_DIR, file)));
        } catch (_) {
          cashiers.length = 0;
          break;
        }
      }

      if (
        cashiers.length === EXPECTED_CASHIERS
        && cashiers.every((cashier) => cashier.run_id === RUN_ID)
      ) {
        return cashiers;
      }
    }

    await sleep(1000);
  }

  throw new Error(
    `Expected ${EXPECTED_CASHIERS} fresh cashier results for run ${RUN_ID}; ` +
    `found ${lastSeen.length} files in ${RESULTS_DIR}`,
  );
}

async function main() {
  if (!RUN_ID || !/^[A-Za-z0-9_.-]+$/.test(RUN_ID)) {
    throw new Error('LAN_EMULATION_RUN_ID is required and may contain only letters, numbers, dot, dash or underscore.');
  }

  const cashiers = await waitForFreshResults();

  const allOk = cashiers.every((c) => c.ok);
  const allWsConnected = cashiers.every((c) =>
    c.steps.some((s) => s.step === 'websocket' && s.connected),
  );
  const totalDurationMs = cashiers.reduce(
    (acc, c) => acc + (new Date(c.finished_at).getTime() - new Date(c.started_at).getTime()),
    0,
  );
  const wallClockMs = Math.max(
    ...cashiers.map((c) => new Date(c.finished_at).getTime()),
  ) - Math.min(
    ...cashiers.map((c) => new Date(c.started_at).getTime()),
  );

  const report = {
    generated_at: new Date().toISOString(),
    base_url: process.env.BASE_URL,
    run_id: RUN_ID,
    scenario: process.env.SCENARIO || 'login_only',
    cashiers_total: cashiers.length,
    cashiers_ok: cashiers.filter((c) => c.ok).length,
    all_dashboard_reached: cashiers.every((c) =>
      c.steps.some((s) => s.step === 'login' && s.status === 200),
    ),
    all_websocket_connected: allWsConnected,
    all_within_sla: wallClockMs <= SLA_TOTAL_MS,
    sla_total_ms: SLA_TOTAL_MS,
    wall_clock_ms: wallClockMs,
    cumulative_cpu_ms: totalDurationMs,
    per_cashier: cashiers.map((c) => ({
      cashier: c.cashier,
      ok: c.ok,
      error: c.error,
      console_errors: c.console_errors?.length ?? 0,
      steps: c.steps,
    })),
  };

  const reportPath = path.join(RESULTS_DIR, 'lan-emulation-report.json');
  await fs.promises.writeFile(reportPath, JSON.stringify(report, null, 2));

  console.log(JSON.stringify(report, null, 2));

  if (!allOk) {
    console.error('FAIL: at least one cashier did not reach /dashboard');
    process.exit(1);
  }
  if (!allWsConnected) {
    console.error('FAIL: at least one cashier did not connect to the WebSocket');
    process.exit(1);
  }
  if (!report.all_within_sla) {
    console.error(`FAIL: LAN emulation wall-clock ${wallClockMs}ms exceeded ${SLA_TOTAL_MS}ms`);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
