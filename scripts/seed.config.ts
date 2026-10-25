/**
 * Seed configuration – TEST VALUES ONLY, used exclusively against the local Emulator Suite
 * (project demo-solid-drive). Accounts come from the shared demo fixtures so the emulator seed and the
 * demo-mode preview use the same logins.
 */
import { DEMO_ACCOUNTS } from '@sda/shared/demo';

export const seedConfig = {
  projectId: 'demo-solid-drive',
  users: DEMO_ACCOUNTS,
} as const;
