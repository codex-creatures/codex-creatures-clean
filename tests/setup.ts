import { afterEach } from "vitest";

// Let the test worker catch its breath between tests. Without it, a file of long sweeps
// (dungeon.test.ts) keeps the worker busy for over a minute and Vitest reports a spurious
// "Timeout calling onTaskUpdate" error even though every test passed.
afterEach(() => new Promise<void>((done) => setTimeout(done, 0)));
