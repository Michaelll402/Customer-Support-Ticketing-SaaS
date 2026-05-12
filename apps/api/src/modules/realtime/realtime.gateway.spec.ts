import 'reflect-metadata';

import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import { RoleName } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../../common/database/prisma.service';
import type { AccessTokenPayload } from '../auth/auth.types';
import { ticketRoom, ticketStaffRoom, userRoom } from './realtime.constants';
import { RealtimeGateway } from './realtime.gateway';

type FakeSocket = {
  data: { user?: AccessTokenPayload };
  handshake: { headers: { cookie?: string } };
  join: ReturnType<typeof vi.fn>;
  leave: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
};

const buildSocket = (cookie?: string): FakeSocket => ({
  data: {},
  handshake: { headers: cookie === undefined ? {} : { cookie } },
  join: vi.fn().mockResolvedValue(undefined),
  leave: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn(),
});

const validUser: AccessTokenPayload = {
  email: 'agent@example.test',
  role: RoleName.AGENT,
  sub: '00000000-0000-4000-8000-000000000001',
};

const adminUser: AccessTokenPayload = {
  email: 'admin@example.test',
  role: RoleName.ADMIN,
  sub: '00000000-0000-4000-8000-000000000002',
};

const customerUser: AccessTokenPayload = {
  email: 'customer@example.test',
  role: RoleName.CUSTOMER,
  sub: '00000000-0000-4000-8000-000000000003',
};

const VALID_TICKET_ID = '00000000-0000-4000-8000-000000000010';

describe('RealtimeGateway', () => {
  let jwtService: JwtService;
  let configService: ConfigService;
  let prismaService: PrismaService;
  let ticketFindFirst: ReturnType<typeof vi.fn>;
  let ticketFindUnique: ReturnType<typeof vi.fn>;
  let verifyAsync: ReturnType<typeof vi.fn>;
  let gateway: RealtimeGateway;

  beforeEach(() => {
    verifyAsync = vi.fn();
    jwtService = { verifyAsync } as unknown as JwtService;
    configService = {
      getOrThrow: vi.fn((key: string) =>
        key === 'auth.cookieName' ? 'access_token' : '',
      ),
    } as unknown as ConfigService;
    ticketFindFirst = vi.fn();
    ticketFindUnique = vi.fn();
    prismaService = {
      ticket: { findFirst: ticketFindFirst, findUnique: ticketFindUnique },
    } as unknown as PrismaService;
    gateway = new RealtimeGateway(jwtService, configService, prismaService);
  });

  describe('handleConnection', () => {
    it('disconnects when no cookie header is present', async () => {
      const socket = buildSocket();
      await gateway.handleConnection(socket as never);
      expect(socket.disconnect).toHaveBeenCalledWith(true);
      expect(verifyAsync).not.toHaveBeenCalled();
    });

    it('disconnects when the JWT verification throws', async () => {
      const socket = buildSocket('access_token=bogus');
      verifyAsync.mockRejectedValueOnce(new Error('invalid'));
      await gateway.handleConnection(socket as never);
      expect(socket.disconnect).toHaveBeenCalledWith(true);
      expect(socket.join).not.toHaveBeenCalled();
    });

    it('joins user:{sub} room on a valid handshake', async () => {
      const socket = buildSocket('access_token=valid');
      verifyAsync.mockResolvedValueOnce(validUser);
      await gateway.handleConnection(socket as never);
      expect(socket.data.user).toEqual(validUser);
      expect(socket.join).toHaveBeenCalledWith(userRoom(validUser.sub));
      expect(socket.disconnect).not.toHaveBeenCalled();
    });
  });

  describe('ticket.subscribe', () => {
    it('returns denied for an invisible ticket and does not join the room', async () => {
      const socket = buildSocket();
      socket.data.user = validUser;
      ticketFindFirst.mockResolvedValueOnce(null);
      ticketFindUnique.mockResolvedValueOnce({ id: VALID_TICKET_ID });

      const ack = await gateway.onSubscribeTicket(socket as never, {
        ticketId: VALID_TICKET_ID,
      });

      expect(ack).toEqual({ ok: false, code: 'denied' });
      expect(socket.join).not.toHaveBeenCalled();
    });

    it('returns ok and joins the ticket room when the ticket is visible', async () => {
      const socket = buildSocket();
      socket.data.user = validUser;
      ticketFindFirst.mockResolvedValueOnce({ id: VALID_TICKET_ID });

      const ack = await gateway.onSubscribeTicket(socket as never, {
        ticketId: VALID_TICKET_ID,
      });

      expect(ack).toEqual({ ok: true });
      expect(socket.join).toHaveBeenCalledWith(ticketRoom(VALID_TICKET_ID));
    });

    it('returns invalid_payload for a non-UUID ticketId', async () => {
      const socket = buildSocket();
      socket.data.user = validUser;

      const ack = await gateway.onSubscribeTicket(socket as never, {
        ticketId: 'not-a-uuid',
      });

      expect(ack).toEqual({ ok: false, code: 'invalid_payload' });
      expect(ticketFindFirst).not.toHaveBeenCalled();
    });
  });

  describe('ticket.subscribe.staff', () => {
    it('rejects customers even when the ticket is visible to them', async () => {
      const socket = buildSocket();
      socket.data.user = customerUser;
      ticketFindFirst.mockResolvedValueOnce({ id: VALID_TICKET_ID });

      const ack = await gateway.onSubscribeTicketStaff(socket as never, {
        ticketId: VALID_TICKET_ID,
      });

      expect(ack).toEqual({ ok: false, code: 'denied' });
      expect(socket.join).not.toHaveBeenCalled();
    });

    it('joins ticket:{id}:staff for an admin with visibility', async () => {
      const socket = buildSocket();
      socket.data.user = adminUser;
      ticketFindUnique.mockResolvedValueOnce({ id: VALID_TICKET_ID });

      const ack = await gateway.onSubscribeTicketStaff(socket as never, {
        ticketId: VALID_TICKET_ID,
      });

      expect(ack).toEqual({ ok: true });
      expect(socket.join).toHaveBeenCalledWith(
        ticketStaffRoom(VALID_TICKET_ID),
      );
    });
  });

  describe('unsubscribe handlers', () => {
    it('leaves the standard ticket room safely', async () => {
      const socket = buildSocket();
      socket.data.user = validUser;
      const ack = await gateway.onUnsubscribeTicket(socket as never, {
        ticketId: VALID_TICKET_ID,
      });
      expect(ack).toEqual({ ok: true });
      expect(socket.leave).toHaveBeenCalledWith(ticketRoom(VALID_TICKET_ID));
    });

    it('leaves the staff ticket room safely', async () => {
      const socket = buildSocket();
      socket.data.user = validUser;
      const ack = await gateway.onUnsubscribeTicketStaff(socket as never, {
        ticketId: VALID_TICKET_ID,
      });
      expect(ack).toEqual({ ok: true });
      expect(socket.leave).toHaveBeenCalledWith(
        ticketStaffRoom(VALID_TICKET_ID),
      );
    });
  });
});
