import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
} from '@nestjs/websockets';
import { RoleName } from '@prisma/client';
import type { Server, Socket } from 'socket.io';

import { buildAllowedOrigins } from '../../common/cors/build-allowed-origins';
import { PrismaService } from '../../common/database/prisma.service';
import type { AccessTokenPayload } from '../auth/auth.types';
import { UsersService } from '../users/users.service';
import { ticketRoom, ticketStaffRoom, userRoom } from './realtime.constants';
import type { SubscribeAck } from './realtime.types';

type AuthenticatedSocket = Socket & {
  data: {
    user?: AccessTokenPayload;
  };
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const extractAccessTokenFromCookie = (
  cookieHeader: string | undefined,
  cookieName: string,
): string | null => {
  if (!cookieHeader) {
    return null;
  }

  for (const cookie of cookieHeader.split(';')) {
    const [name, ...valueParts] = cookie.trim().split('=');

    if (name === cookieName) {
      try {
        return decodeURIComponent(valueParts.join('='));
      } catch {
        // A malformed percent-encoded cookie (e.g. `access_token=%ZZ`) must
        // never throw out of the handshake; treat it as an absent token.
        return null;
      }
    }
  }

  return null;
};

@Injectable()
@WebSocketGateway({
  cors: {
    credentials: true,
    origin: buildAllowedOrigins(
      process.env.WEB_APP_ORIGIN ?? 'http://localhost:3000',
    ),
  },
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  public server!: Server;

  constructor(
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(UsersService) private readonly usersService: UsersService,
  ) {}

  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    try {
      const cookieName =
        this.configService.getOrThrow<string>('auth.cookieName');
      const token = extractAccessTokenFromCookie(
        client.handshake.headers.cookie,
        cookieName,
      );

      if (!token) {
        client.disconnect(true);
        return;
      }

      const payload =
        await this.jwtService.verifyAsync<AccessTokenPayload>(token);

      // Mirror the REST JwtStrategy: re-validate the token against the
      // persisted user so revoked (tokenVersion bump), deactivated, or deleted
      // users cannot open new sockets, and so room authorization uses the
      // FRESH database role instead of the possibly stale token role.
      const user = await this.usersService.findById(payload.sub);

      if (
        !user ||
        !user.isActive ||
        user.tokenVersion !== payload.tokenVersion
      ) {
        client.disconnect(true);
        return;
      }

      client.data.user = {
        email: user.email,
        role: user.role.name,
        sub: user.id,
        tokenVersion: user.tokenVersion,
      };
      await client.join(userRoom(user.id));
    } catch {
      // Any failure during the handshake (malformed cookie, invalid or expired
      // token, DB lookup failure, room join error) disconnects the socket
      // instead of escaping as an unhandled rejection that could crash the
      // process.
      client.disconnect(true);
    }
  }

  handleDisconnect(): void {
    return;
  }

  @SubscribeMessage('ticket.subscribe')
  async onSubscribeTicket(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { ticketId?: unknown },
  ): Promise<SubscribeAck> {
    const user = client.data.user;
    if (!user) return { ok: false, code: 'denied' };

    const ticketId = this.parseTicketId(body);
    if (!ticketId) return { ok: false, code: 'invalid_payload' };

    const visibility = await this.resolveVisibility(user, ticketId);
    if (visibility !== 'visible') return { ok: false, code: visibility };

    await client.join(ticketRoom(ticketId));
    return { ok: true };
  }

  @SubscribeMessage('ticket.unsubscribe')
  async onUnsubscribeTicket(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { ticketId?: unknown },
  ): Promise<SubscribeAck> {
    const ticketId = this.parseTicketId(body);
    if (!ticketId) return { ok: false, code: 'invalid_payload' };
    await client.leave(ticketRoom(ticketId));
    return { ok: true };
  }

  @SubscribeMessage('ticket.subscribe.staff')
  async onSubscribeTicketStaff(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { ticketId?: unknown },
  ): Promise<SubscribeAck> {
    const user = client.data.user;
    if (!user) return { ok: false, code: 'denied' };
    if (user.role === RoleName.CUSTOMER) {
      return { ok: false, code: 'denied' };
    }

    const ticketId = this.parseTicketId(body);
    if (!ticketId) return { ok: false, code: 'invalid_payload' };

    const visibility = await this.resolveVisibility(user, ticketId);
    if (visibility !== 'visible') return { ok: false, code: visibility };

    await client.join(ticketStaffRoom(ticketId));
    return { ok: true };
  }

  @SubscribeMessage('ticket.unsubscribe.staff')
  async onUnsubscribeTicketStaff(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { ticketId?: unknown },
  ): Promise<SubscribeAck> {
    const ticketId = this.parseTicketId(body);
    if (!ticketId) return { ok: false, code: 'invalid_payload' };
    await client.leave(ticketStaffRoom(ticketId));
    return { ok: true };
  }

  private parseTicketId(
    body: { ticketId?: unknown } | undefined,
  ): string | null {
    const raw = body?.ticketId;
    if (typeof raw !== 'string' || !UUID_RE.test(raw)) return null;
    return raw;
  }

  private async resolveVisibility(
    user: AccessTokenPayload,
    ticketId: string,
  ): Promise<'visible' | 'denied' | 'not_found'> {
    if (user.role === RoleName.ADMIN) {
      const exists = await this.prisma.ticket.findUnique({
        where: { id: ticketId },
        select: { id: true },
      });
      return exists ? 'visible' : 'not_found';
    }

    if (user.role === RoleName.CUSTOMER) {
      const own = await this.prisma.ticket.findFirst({
        where: { id: ticketId, requesterId: user.sub },
        select: { id: true },
      });
      if (own) return 'visible';
    } else {
      const visible = await this.prisma.ticket.findFirst({
        where: {
          id: ticketId,
          OR: [
            { assigneeId: user.sub },
            { team: { members: { some: { userId: user.sub } } } },
          ],
        },
        select: { id: true },
      });
      if (visible) return 'visible';
    }

    const exists = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true },
    });
    return exists ? 'denied' : 'not_found';
  }
}
