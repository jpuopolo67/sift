import { beforeEach } from 'vitest';
import { setupChromeMocks, resetMockSettings } from './mocks/chrome';

beforeEach(() => {
  setupChromeMocks();
  resetMockSettings();
});
