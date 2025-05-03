import 'reflect-metadata';
import { config } from 'dotenv';
import { Logger } from '@nestjs/common';

// Load environment variables from .env.test if it exists
config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';

// Global test timeout (optional, adjust as needed)
jest.setTimeout(10000);

// Global setup
beforeAll(async () => {
  // Add database setup here if needed
});

// Global teardown
afterAll(async () => {
  // Close any connections or cleanup
});

// Reset state between tests
afterEach(async () => {
  // Clear all mocks
  jest.clearAllMocks();
  jest.resetAllMocks();

  // Reset modules if needed
  jest.resetModules();

  // Clear any timeouts/intervals
  jest.useRealTimers();
});

// Optional: Add custom matchers if needed
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
});

// Optional: Global error handler for unhandled promises
process.on('unhandledRejection', (reason, promise) => {
  Logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Optionally fail tests on unhandled rejections
  // process.exit(1);
});
