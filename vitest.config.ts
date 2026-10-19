import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Some tests roll hundreds of labyrinth maps or sim whole runs. On a busy
    // PC they can pass Vitest's 5-second default without anything being wrong.
    testTimeout: 30_000,
  },
});
