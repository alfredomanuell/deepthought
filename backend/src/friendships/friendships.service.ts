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

/** Campos públicos do outro utilizador devolvidos nas listagens de amizade. */
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
 * Serviço do sistema de amizades e bloqueios.
 *
 * Modelo: uma linha `Friendship` por par de utilizadores para PENDING/ACCEPTED
 * (direcção = quem pediu). Bloqueios usam o mesmo model com status BLOCKED,
 * onde `requesterId` é sempre quem bloqueou — dois bloqueios mútuos podem
 * coexistir como duas linhas (A→B e B→A).
 */
@Injectable()
export class FriendshipsService {
  private readonly logger = new Logger(FriendshipsService.name);

  constructor(
    /** Acesso à base de dados */
    private readonly prisma: PrismaService,
    /** Notificações de pedido enviado/aceite (helpers já existentes) */
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Envia um pedido de amizade.
   * POST /friendships/:userId
   * @param requester Utilizador autenticado (id + login para a notificação)
   * @param addresseeId Destinatário do pedido
   */
  async sendRequest(
    requester: { sub: string; login: string },
    addresseeId: string,
  ) {
    if (requester.sub === addresseeId) {
      throw new BadRequestException('Cannot send a friend request to yourself');
    }

    /** Destinatário tem de existir e não estar banido. */
    const addressee = await this.prisma.user.findUnique({
      where: { id: addresseeId },
      select: { id: true, isBanned: true },
    });

    if (!addressee || addressee.isBanned) {
      throw new NotFoundException('User not found');
    }

    /** Verifica relação existente em qualquer direcção antes de criar. */
    const existing = await this.findRelation(requester.sub, addresseeId);

    if (existing) {
      if (existing.status === FriendshipStatus.BLOCKED) {
        /** Bloqueio em qualquer direcção impede novos pedidos. */
        throw new ForbiddenException('Cannot send a friend request to this user');
      }
      if (existing.status === FriendshipStatus.ACCEPTED) {
        throw new ConflictException('You are already friends');
      }
      /** PENDING: distingue pedido duplicado de pedido cruzado. */
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

    /** Notificação persistida; falha aqui não reverte o pedido (create já trata erros). */
    await this.notifications.notifyFriendRequest(addresseeId, requester.login);

    this.logger.log(`Friend request ${requester.sub} -> ${addresseeId}`);
    return friendship;
  }

  /**
   * Aceita um pedido de amizade recebido.
   * PATCH /friendships/:id/accept
   * Apenas o destinatário do pedido pode aceitar.
   */
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

  /**
   * Recusa um pedido pendente ou remove uma amizade existente.
   * DELETE /friendships/:id
   * Qualquer um dos dois lados pode remover; bloqueios não passam por aqui.
   */
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

  /**
   * Lista os amigos (pedidos aceites) do utilizador autenticado.
   * GET /friendships
   */
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

    /** Normaliza para "o outro lado" independentemente da direcção do pedido. */
    return rows.map((f) => ({
      friendshipId: f.id,
      since: f.updatedAt,
      friend: f.requesterId === userId ? f.addressee : f.requester,
    }));
  }

  /**
   * Lista pedidos pendentes recebidos e enviados.
   * GET /friendships/pending
   */
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

  /**
   * Lista os utilizadores bloqueados pelo utilizador autenticado.
   * GET /friendships/blocked
   */
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
   * Bloqueia um utilizador.
   * POST /users/:id/block
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

    /** Transacção: limpar relações e registar o bloqueio de forma atómica. */
    await this.prisma.$transaction([
      this.prisma.friendship.deleteMany({
        where: {
          OR: [
            /** Qualquer linha minha nesta direcção (pedido, amizade ou bloqueio antigo). */
            { requesterId: blockerId, addresseeId: targetId },
            /** Linhas do outro lado, excepto o bloqueio dele — esse mantém-se. */
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

  /**
   * Desbloqueia um utilizador.
   * DELETE /users/:id/block
   */
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
   * Verifica se existe bloqueio em qualquer direcção entre dois utilizadores.
   * Usado pela lógica de privacidade (perfil limitado; futuramente chat).
   */
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

  /** Encontra a relação (qualquer status) entre dois utilizadores, em qualquer direcção. */
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
