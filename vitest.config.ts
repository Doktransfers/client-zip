import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['test/**/*.test.ts'],
        // Large file tests are tagged with 'large-files' and won't run by default
        // To run them: vitest --reporter=verbose --run --reporter=verbose --tag=large-files
    },
});