import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBody,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';

import { AUTH_COOKIE_SECURITY_NAME } from './auth.constants';
import { AuthService, type AuthSession } from './auth.service';
import { AuthSessionDto } from './dto/auth-session.dto';
import { AuthUserDto } from './dto/auth-user.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { AccessTokenPayload } from './auth.types';
import { validationPipeOptions } from '../../common/validation/validation.pipe-options';

type AuthenticatedRequest = Request & {
  user: AccessTokenPayload;
};

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {}

  @Post('register')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Register a new customer account.',
  })
  @ApiBody({
    type: RegisterDto,
  })
  @ApiCreatedResponse({
    description: 'Customer account created and access token cookie issued.',
    type: AuthSessionDto,
  })
  @ApiConflictResponse({
    description: 'Email is already in use.',
  })
  register(
    @Res({ passthrough: true }) response: Response,
    @Body(
      new ValidationPipe({
        ...validationPipeOptions,
        expectedType: RegisterDto,
      }),
    )
    body: RegisterDto,
  ) {
    return this.handleAuthSession(response, this.authService.register(body));
  }

  @Post('login')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Authenticate a user and issue an access token cookie.',
  })
  @ApiBody({
    type: LoginDto,
  })
  @ApiOkResponse({
    description: 'Login succeeded and access token cookie issued.',
    type: AuthSessionDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid email or password.',
  })
  login(
    @Res({ passthrough: true }) response: Response,
    @Body(
      new ValidationPipe({
        ...validationPipeOptions,
        expectedType: LoginDto,
      }),
    )
    body: LoginDto,
  ) {
    return this.handleAuthSession(response, this.authService.login(body));
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_SECURITY_NAME)
  @ApiOperation({
    summary: 'Return the currently authenticated user.',
  })
  @ApiOkResponse({
    description: 'Authenticated user returned successfully.',
    type: AuthUserDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid or missing access token cookie.',
  })
  me(@Req() request: AuthenticatedRequest) {
    return this.authService.getCurrentUser(request.user.sub);
  }

  @Post('logout')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Clear the access token cookie.',
  })
  @ApiNoContentResponse({
    description: 'Access token cookie cleared.',
  })
  logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie(
      this.authService.getAccessTokenCookieName(),
      this.getAccessTokenCookieOptions(),
    );
  }

  private async handleAuthSession(
    response: Response,
    sessionPromise: Promise<AuthSession>,
  ): Promise<AuthSessionDto> {
    const session = await sessionPromise;

    response.cookie(
      this.authService.getAccessTokenCookieName(),
      session.accessToken,
      {
        maxAge: this.authService.getAccessTokenTtlSeconds() * 1000,
        ...this.getAccessTokenCookieOptions(),
      },
    );

    return {
      user: session.user,
    };
  }

  private getAccessTokenCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      secure: this.configService.getOrThrow<string>('app.env') === 'production',
    };
  }
}
