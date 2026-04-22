import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import { UsersService, type UserWithRole } from '../users/users.service';
import { AuthUserDto } from './dto/auth-user.dto';
import { PasswordService } from './password.service';
import type { AccessTokenPayload } from './auth.types';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';

export interface AuthSession {
  accessToken: string;
  user: AuthUserDto;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(UsersService) private readonly usersService: UsersService,
    @Inject(PasswordService)
    private readonly passwordService: PasswordService,
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {}

  async register(input: RegisterDto): Promise<AuthSession> {
    const email = input.email.trim().toLowerCase();
    const existingUser = await this.usersService.findByEmail(email);

    if (existingUser) {
      throw new ConflictException('Email is already in use.');
    }

    const passwordHash = await this.passwordService.hashPassword(
      input.password,
    );
    const user = await this.usersService.createCustomer({
      email,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      passwordHash,
    });

    return this.createSession(user);
  }

  async login(input: LoginDto): Promise<AuthSession> {
    const email = input.email.trim().toLowerCase();
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const isPasswordValid = await this.passwordService.verifyPassword(
      input.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    return this.createSession(user);
  }

  async getCurrentUser(userId: string) {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new UnauthorizedException('Authenticated user no longer exists.');
    }

    return AuthUserDto.fromUser(user);
  }

  getAccessTokenCookieName() {
    return this.configService.getOrThrow<string>('auth.cookieName');
  }

  getAccessTokenTtlSeconds() {
    return this.configService.getOrThrow<number>('auth.accessTokenTtlSeconds');
  }

  private createSession(user: UserWithRole): AuthSession {
    const payload: AccessTokenPayload = {
      email: user.email,
      role: user.role.name,
      sub: user.id,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: AuthUserDto.fromUser(user),
    };
  }
}
