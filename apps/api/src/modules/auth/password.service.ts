import { Injectable } from '@nestjs/common';
import { compare, hash } from 'bcryptjs';

const PASSWORD_SALT_ROUNDS = 12;

@Injectable()
export class PasswordService {
  hashPassword(password: string) {
    return hash(password, PASSWORD_SALT_ROUNDS);
  }

  verifyPassword(password: string, passwordHash: string) {
    return compare(password, passwordHash);
  }
}
