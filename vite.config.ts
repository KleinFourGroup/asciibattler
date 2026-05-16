/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    open: false,
  },
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    // Sim/core/run code is pure logic — no DOM needed. Render code is not
    // tested here (visual verification handles that).
    environment: 'node',
  },
});
