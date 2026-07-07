import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { NotificationType, Prisma } from '@prisma/client';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  async create(
    userId: string,
    type: NotificationType,
    title: string,
    message?: string,
    /** Payload accionável opcional (ex.: { friendshipId } em FRIEND_REQUEST). */
    data?: Prisma.InputJsonValue,
  ) {
    try {
      const notification = await this.prisma.notification.create({
        data: {
          userId,
          type,
          title,
          message,
          data,
          isRead: false,
        },
      });

      this.logger.debug(`Notification created for user ${userId}: [${type}] ${title}`);

      /** Push em tempo real; no-op se o utilizador não tiver sessões ligadas. */
      this.realtime.emitToUser(userId, 'notification:new', notification);

      return notification;
      } catch (error) {
            const message =
            error instanceof Error ? error.message : String(error);

            this.logger.error(
            `Failed to create notification for user ${userId}: ${message}`,
            );
            return null;
        }
  }

  async notifyAchievementUnlocked(
    userId: string,
    achievementTitle: string,
    xpReward: number,
  ) {
    return this.create(
      userId,
      NotificationType.ACHIEVEMENT_UNLOCKED,
      `🏆 Conquista desbloqueada: ${achievementTitle}`,
      xpReward > 0 ? `+${xpReward} XP ganho` : undefined,
    );
  }

  async notifyHelpOffered(
    userId: string,
    helperLogin: string,
    projectName: string,
  ) {
    return this.create(
      userId,
      NotificationType.HELP_REQUEST,
      `${helperLogin} ofereceu ajuda no ${projectName}`,
    );
  }

  async notifyFriendAccepted(userId: string, acceptorLogin: string) {
    return this.create(
      userId,
      NotificationType.FRIEND_ACCEPTED,
      `${acceptorLogin} aceitou o teu pedido de amizade`,
    );
  }

  async notifyNewMessage(userId: string, senderLogin: string) {
    return this.create(
      userId,
      NotificationType.NEW_MESSAGE,
      `Nova mensagem de ${senderLogin}`,
    );
  }

  async notifyProjectInvite(
    userId: string,
    inviterLogin: string,
    projectName: string,
  ) {
    return this.create(
      userId,
      NotificationType.PROJECT_INVITE,
      `${inviterLogin} convidou-te para o ${projectName}`,
    );
  }

  async notifyProjectInviteResponse(
    userId: string,
    inviteeLogin: string,
    projectName: string,
    accepted: boolean,
  ) {
    return this.create(
      userId,
      NotificationType.PROJECT_UPDATE,
      accepted
        ? `${inviteeLogin} aceitou o convite para o ${projectName}`
        : `${inviteeLogin} recusou o convite para o ${projectName}`,
    );
  }

  /**
   * O friendshipId no payload permite aceitar/recusar directamente na UI.
   */
  async notifyFriendRequest(
    userId: string,
    requesterLogin: string,
    friendshipId: string,
  ) {
    return this.create(
      userId,
      NotificationType.FRIEND_REQUEST,
      `${requesterLogin} enviou-te um pedido de amizade`,
      undefined,
      { friendshipId },
    );
  }

  async findAll(userId: string, onlyUnread = false, page = 1, limit = 20) {
    const where = onlyUnread ? { userId, isRead: false } : { userId };
    const skip = (page - 1) * limit;

    const [notifications, total, unreadCount] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
      /** Contagem de não lidas independente do filtro, para o badge da UI. */
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return {
      data: notifications,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        unreadCount,
      },
    };
  }

  /** O filtro por userId garante que só marca notificações próprias. */
  async markAsRead(userId: string, notificationId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });

    if (result.count === 0) {
      throw new NotFoundException('Notification not found');
    }

    return { message: 'Notification marked as read' };
  }

  async markAllAsRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    return { message: 'All notifications marked as read', count: result.count };
  }
}
