import { describe, expect, it } from 'vitest';

import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const passwordService = new PasswordService();

  it('hashes and verifies passwords', async () => {
    const plainPassword = 'Password1!';
    const passwordHash = await passwordService.hashPassword(plainPassword);

    expect(passwordHash).not.toBe(plainPassword);
    await expect(
      passwordService.verifyPassword(plainPassword, passwordHash),
    ).resolves.toBe(true);
    await expect(
      passwordService.verifyPassword('WrongPassword1!', passwordHash),
    ).resolves.toBe(false);
  });
});
