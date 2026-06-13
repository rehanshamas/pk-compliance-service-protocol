/**
 * E2E global setup: verify backend is reachable before running tests.
 * Run `make dev` in another terminal before `make test-e2e`.
 */
async function globalSetup() {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  try {
    const res = await fetch(`${apiBase}/health`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error(`Health check returned ${res.status}`);
    console.log("✓ Backend reachable at", apiBase);
  } catch (err) {
    console.error("\n❌ E2E tests require the backend to be running.");
    console.error("   Run in another terminal: make dev");
    console.error("   Then: make migrate && make seed");
    console.error("   Error:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

export default globalSetup;
