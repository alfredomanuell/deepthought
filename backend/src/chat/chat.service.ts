import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ChatRoomType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FriendshipsService } from '../friendships/friendships.service';

const SENDER_SELECT = {
  id: true,
  login: true,
  displayName: true,
  avatar: true,
} satisfies Prisma.UserSelect;

const HISTORY_PAGE_SIZE = 50;

/**
 * O ChatGateway trata do tempo real; este serviço é a
 * única camada que escreve na base de dados.
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  /** Cache do ID da sala global — criada uma única vez, nunca muda. */
  private globalRoomId: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly friendships: FriendshipsService,
  ) {}

  async getOrCreateGlobalRoom() {
    if (this.globalRoomId) {
      return { id: this.globalRoomId };
    }

    let room = await this.prisma.chatRoom.findFirst({
      where: { type: ChatRoomType.GLOBAL },
      select: { id: true },
    });

    if (!room) {
      room = await this.prisma.chatRoom.create({
        data: { type: ChatRoomType.GLOBAL, name: 'Global' },
        select: { id: true },
      });
      this.logger.log(`Global chat room created: ${room.id}`);
    }

    this.globalRoomId = room.id;
    return room;
  }

  async getOrCreateDm(userId: string, otherId: string) {
    if (userId === otherId) {
      throw new BadRequestException('Cannot open a DM with yourself');
    }

    const other = await this.prisma.user.findUnique({
      where: { id: otherId },
      select: { id: true, isBanned: true },
    });

    if (!other || other.isBanned) {
      throw new NotFoundException('User not found');
    }

    /** Privacidade de bloqueios: sem DMs entre utilizadores bloqueados. */
    if (await this.friendships.isBlockedBetween(userId, otherId)) {
      throw new ForbiddenException('Cannot message this user');
    }

    const existing = await this.prisma.chatRoom.findFirst({
      where: {
        type: ChatRoomType.PRIVATE,
        AND: [
          { participants: { some: { userId } } },
          { participants: { some: { userId: otherId } } },
        ],
      },
      include: this.roomInclude(),
    });

    if (existing) {
      return this.toRoomSummary(existing, userId);
    }

    const created = await this.prisma.chatRoom.create({
      data: {
        type: ChatRoomType.PRIVATE,
        isPrivate: true,
        participants: {
          create: [{ userId }, { userId: otherId }],
        },
      },
      include: this.roomInclude(),
    });

    this.logger.log(`DM created between ${userId} and ${otherId}`);
    return this.toRoomSummary(created, userId);
  }

  async listRooms(userId: string) {
    const global = await this.getOrCreateGlobalRoom();
    await this.ensureParticipant(global.id, userId);

    const rooms = await this.prisma.chatRoom.findMany({
      where: {
        OR: [
          { id: global.id },
          {
            type: ChatRoomType.PRIVATE,
            participants: { some: { userId } },
          },
        ],
      },
      include: this.roomInclude(),
    });

    const summaries = await Promise.all(
      rooms.map(async (room) => {
        const summary = this.toRoomSummary(room, userId);
        const me = room.participants.find((p) => p.userId === userId);

        const unreadCount = await this.prisma.message.count({
          where: {
            chatRoomId: room.id,
            deletedAt: null,
            senderId: { not: userId },
            ...(me?.lastReadAt ? { createdAt: { gt: me.lastReadAt } } : {}),
          },
        });

        return { ...summary, unreadCount };
      }),
    );

    return summaries.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'GLOBAL' ? -1 : 1;
      const aTime = a.lastMessage?.createdAt?.getTime() ?? 0;
      const bTime = b.lastMessage?.createdAt?.getTime() ?? 0;
      return bTime - aTime;
    });
  }

  /**
   * Histórico paginado por cursor temporal (`before` pede a página anterior).
   */
  async getHistory(roomId: string, userId: string, before?: string) {
    await this.assertMember(roomId, userId);

    const messages = await this.prisma.message.findMany({
      where: {
        chatRoomId: roomId,
        deletedAt: null,
        ...(before ? { createdAt: { lt: new Date(before) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_PAGE_SIZE,
      include: { sender: { select: SENDER_SELECT } },
    });

    return {
      data: messages.reverse(),
      nextBefore:
        messages.length === HISTORY_PAGE_SIZE
          ? messages[0].createdAt.toISOString()
          : null,
    };
  }

  async saveMessage(roomId: string, userId: string, content: string) {
    const room = await this.assertMember(roomId, userId);

    let recipientId: string | null = null;

    if (room.type === ChatRoomType.PRIVATE) {
      const other = room.participants.find((p) => p.userId !== userId);
      recipientId = other?.userId ?? null;

      /** Bloqueio criado depois da DM existir continua a impedir mensagens. */
      if (
        recipientId &&
        (await this.friendships.isBlockedBetween(userId, recipientId))
      ) {
        throw new ForbiddenException('Cannot message this user');
      }
    }

    const message = await this.prisma.message.create({
      data: { chatRoomId: roomId, senderId: userId, content },
      include: { sender: { select: SENDER_SELECT } },
    });

    return { message, roomType: room.type, recipientId };
  }

  async markRead(roomId: string, userId: string) {
    await this.assertMember(roomId, userId);

    const lastReadAt = new Date();
    await this.prisma.chatRoomParticipant.updateMany({
      where: { chatRoomId: roomId, userId },
      data: { lastReadAt },
    });

    return { roomId, userId, lastReadAt };
  }

  async assertMember(roomId: string, userId: string) {
    const room = await this.prisma.chatRoom.findUnique({
      where: { id: roomId },
      include: { participants: true },
    });

    if (!room) {
      throw new NotFoundException('Chat room not found');
    }

    const isMember = room.participants.some((p) => p.userId === userId);

    if (!isMember) {
      if (room.type !== ChatRoomType.GLOBAL) {
        throw new ForbiddenException('You are not a participant of this room');
      }
      /** Global: qualquer utilizador autenticado entra automaticamente. */
      await this.ensureParticipant(roomId, userId);
    }

    return room;
  }

  private async ensureParticipant(roomId: string, userId: string) {
    await this.prisma.chatRoomParticipant.upsert({
      where: { userId_chatRoomId: { userId, chatRoomId: roomId } },
      create: { userId, chatRoomId: roomId },
      update: {},
    });
  }

  private roomInclude() {
    return {
      participants: {
        include: { user: { select: SENDER_SELECT } },
      },
      messages: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' as const },
        take: 1,
        include: { sender: { select: SENDER_SELECT } },
      },
    } satisfies Prisma.ChatRoomInclude;
  }

  private toRoomSummary(
    room: Prisma.ChatRoomGetPayload<{
      include: ReturnType<ChatService['roomInclude']>;
    }>,
    userId: string,
  ) {
    const other =
      room.type === ChatRoomType.PRIVATE
        ? (room.participants.find((p) => p.userId !== userId)?.user ?? null)
        : null;

    const me = room.participants.find((p) => p.userId === userId);
    /** lastReadAt dos outros participantes — base do ✓✓ nas DMs. */
    const otherLastReadAt =
      room.type === ChatRoomType.PRIVATE
        ? (room.participants.find((p) => p.userId !== userId)?.lastReadAt ?? null)
        : null;

    return {
      id: room.id,
      type: room.type,
      name: room.type === ChatRoomType.GLOBAL ? (room.name ?? 'Global') : null,
      otherUser: other,
      lastMessage: room.messages[0] ?? null,
      myLastReadAt: me?.lastReadAt ?? null,
      otherLastReadAt,
    };
  }
}
