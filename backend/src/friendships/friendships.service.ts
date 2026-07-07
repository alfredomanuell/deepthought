import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { FriendshipStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

const FRIEND_SELECT = {
  id: true,
  login: true,
  displayName: true,
  avatar: true,
  campus: true,
  coalition: true,
  level: true,
  lastSeenAt: true,
} satisfies Prisma.UserSelect;

/**
 * Modelo: uma linha `Friendship` por par de utilizadores para PENDING/ACCEPTED
 * (direcção = quem pediu). Bloqueios usam o mesmo model com status BLOCKED,
 * onde `requesterId` é sempre quem bloqueou — dois bloqueios mútuos podem
 * coexistir como duas linhas (A→B e B→A).
 */
@Injectable()
export class FriendshipsService {
  private readonly logger = new Logger(FriendshipsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async sendRequest(
    requester: { sub: string; login: string },
    addresseeId: string,
  ) {
    if (requester.sub === addresseeId) {
      throw new BadRequestException('Cannot send a friend request to yourself');
    }

    const addressee = await this.prisma.user.findUnique({
      where: { id: addresseeId },
      select: { id: true, isBanned: true },
    });

    if (!addressee || addressee.isBanned) {
      throw new NotFoundException('User not found');
    }

    const existing = await this.findRelation(requester.sub, addresseeId);

    if (existing) {
      if (existing.status === FriendshipStatus.BLOCKED) {
        throw new ForbiddenException('Cannot send a friend request to this user');
      }
      if (existing.status === FriendshipStatus.ACCEPTED) {
        throw new ConflictException('You are already friends');
      }
      if (existing.requesterId === requester.sub) {
        throw new ConflictException('Friend request already sent');
      }
      throw new ConflictException(
        'This user already sent you a friend request — accept it instead',
      );
    }

    const friendship = await this.prisma.friendship.create({
      data: { requesterId: requester.sub, addresseeId },
      include: { addressee: { select: FRIEND_SELECT } },
    });

    await this.notifications.notifyFriendRequest(
      addresseeId,
      requester.login,
      friendship.id,
    );

    this.logger.log(`Friend request ${requester.sub} -> ${addresseeId}`);
    return friendship;
  }

  async accept(id: string, acceptor: { sub: string; login: string }) {
    const friendship = await this.prisma.friendship.findUnique({
      where: { id },
    });

    /** 404 também quando o pedido não é dirigido ao user (não revela existência). */
    if (
      !friendship ||
      friendship.addresseeId !== acceptor.sub ||
      friendship.status !== FriendshipStatus.PENDING
    ) {
      throw new NotFoundException('Friend request not found');
    }

    const updated = await this.prisma.friendship.update({
      where: { id },
      data: { status: FriendshipStatus.ACCEPTED },
      include: { requester: { select: FRIEND_SELECT } },
    });

    await this.notifications.notifyFriendAccepted(
      friendship.requesterId,
      acceptor.login,
    );

    this.logger.log(`Friend request ${id} accepted by ${acceptor.sub}`);
    return updated;
  }

  async remove(id: string, userId: string) {
    const friendship = await this.prisma.friendship.findUnique({
      where: { id },
    });

    if (
      !friendship ||
      friendship.status === FriendshipStatus.BLOCKED ||
      (friendship.requesterId !== userId && friendship.addresseeId !== userId)
    ) {
      throw new NotFoundException('Friendship not found');
    }

    await this.prisma.friendship.delete({ where: { id } });

    this.logger.log(`Friendship ${id} removed by ${userId}`);
    return { message: 'Friendship removed' };
  }

  async listFriends(userId: string) {
    const rows = await this.prisma.friendship.findMany({
      where: {
        status: FriendshipStatus.ACCEPTED,
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      include: {
        requester: { select: FRIEND_SELECT },
        addressee: { select: FRIEND_SELECT },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return rows.map((f) => ({
      friendshipId: f.id,
      since: f.updatedAt,
      friend: f.requesterId === userId ? f.addressee : f.requester,
    }));
  }

  async listPending(userId: string) {
    const rows = await this.prisma.friendship.findMany({
      where: {
        status: FriendshipStatus.PENDING,
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      include: {
        requester: { select: FRIEND_SELECT },
        addressee: { select: FRIEND_SELECT },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      incoming: rows
        .filter((f) => f.addresseeId === userId)
        .map((f) => ({ friendshipId: f.id, createdAt: f.createdAt, user: f.requester })),
      outgoing: rows
        .filter((f) => f.requesterId === userId)
        .map((f) => ({ friendshipId: f.id, createdAt: f.createdAt, user: f.addressee })),
    };
  }

  async listBlocked(userId: string) {
    const rows = await this.prisma.friendship.findMany({
      where: { requesterId: userId, status: FriendshipStatus.BLOCKED },
      include: { addressee: { select: FRIEND_SELECT } },
      orderBy: { updatedAt: 'desc' },
    });

    return rows.map((f) => ({
      friendshipId: f.id,
      blockedAt: f.updatedAt,
      user: f.addressee,
    }));
  }

  /**
   * Remove qualquer amizade/pedido entre os dois e cria a linha BLOCKED.
   * Um bloqueio do outro lado (B→A) nunca é apagado por esta operação.
   */
  async block(blockerId: string, targetId: string) {
    if (blockerId === targetId) {
      throw new BadRequestException('Cannot block yourself');
    }

    const target = await this.prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true },
    });

    if (!target) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.$transaction([
      this.prisma.friendship.deleteMany({
        where: {
          OR: [
            { requesterId: blockerId, addresseeId: targetId },
            {
              requesterId: targetId,
              addresseeId: blockerId,
              status: { not: FriendshipStatus.BLOCKED },
            },
          ],
        },
      }),
      this.prisma.friendship.create({
        data: {
          requesterId: blockerId,
          addresseeId: targetId,
          status: FriendshipStatus.BLOCKED,
        },
      }),
    ]);

    this.logger.log(`User ${blockerId} blocked ${targetId}`);
    return { message: 'User blocked' };
  }

  async unblock(blockerId: string, targetId: string) {
    const result = await this.prisma.friendship.deleteMany({
      where: {
        requesterId: blockerId,
        addresseeId: targetId,
        status: FriendshipStatus.BLOCKED,
      },
    });

    if (result.count === 0) {
      throw new NotFoundException('User is not blocked');
    }

    this.logger.log(`User ${blockerId} unblocked ${targetId}`);
    return { message: 'User unblocked' };
  }

  /**
   * Garante amizade ACCEPTED entre dois utilizadores (sem passar por pedido).
   * Usado quando uma acção de ambos implica amizade — ex.: aceitar uma
   * oferta de ajuda num projecto. Bloqueios continuam a impedir.
   */
  async ensureFriends(userA: string, userB: string): Promise<void> {
    if (userA === userB) return;

    const existing = await this.findRelation(userA, userB);

    if (existing) {
      if (existing.status === FriendshipStatus.BLOCKED) {
        throw new ForbiddenException('Cannot befriend this user');
      }
      if (existing.status !== FriendshipStatus.ACCEPTED) {
        await this.prisma.friendship.update({
          where: { id: existing.id },
          data: { status: FriendshipStatus.ACCEPTED },
        });
      }
      return;
    }

    await this.prisma.friendship.create({
      data: {
        requesterId: userA,
        addresseeId: userB,
        status: FriendshipStatus.ACCEPTED,
      },
    });
  }

  /** Usado pela lógica de privacidade (perfil limitado, DMs, convites). */
  async isBlockedBetween(userA: string, userB: string): Promise<boolean> {
    const count = await this.prisma.friendship.count({
      where: {
        status: FriendshipStatus.BLOCKED,
        OR: [
          { requesterId: userA, addresseeId: userB },
          { requesterId: userB, addresseeId: userA },
        ],
      },
    });

    return count > 0;
  }

  private findRelation(userA: string, userB: string) {
    return this.prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: userA, addresseeId: userB },
          { requesterId: userB, addresseeId: userA },
        ],
      },
    });
  }
}
