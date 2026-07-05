import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { NotificationType, Prisma } from '@prisma/client';

/**
 * Serviço reutilizável de notificações.
 * Centraliza a criação de notificações para todos os módulos.
 * Usado por: AchievementsService, ProjectsService, AuthService.
 *
 * Tipos suportados:
 * - FRIEND_REQUEST / FRIEND_ACCEPTED
 * - HELP_REQUEST
 * - PROJECT_UPDATE
 * - ACHIEVEMENT_UNLOCKED
 * - SYSTEM
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    /** Acesso à base de dados para criar e listar notificações */
    private readonly prisma: PrismaService,
    /** Emissão de eventos socket.io para sessões ligadas do destinatário */
    private readonly realtime: RealtimeService,
  ) {}

  /**
   * Cria uma nova notificação para um utilizador.
   * Método base usado por todos os outros métodos específicos.
   * @param userId ID do utilizador destinatário
   * @param type Tipo da notificação (enum NotificationType)
   * @param title Título curto da notificação
   * @param message Mensagem opcional com mais detalhe
   */
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

  /**
   * Notifica o desbloqueio de uma conquista.
   * @param userId ID do utilizador
   * @param achievementTitle Nome da conquista
   * @param xpReward XP atribuído pela conquista
   */
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

  /**
   * Notifica que alguém ofereceu ajuda num projecto.
   * @param userId ID do utilizador que pediu ajuda
   * @param helperLogin Login de quem ofereceu ajuda
   * @param projectName Nome do projecto
   */
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

  /**
   * Notifica que um pedido de amizade foi aceite.
   * @param userId ID do utilizador destinatário
   * @param acceptorLogin Login de quem aceitou
   */
  async notifyFriendAccepted(userId: string, acceptorLogin: string) {
    return this.create(
      userId,
      NotificationType.FRIEND_ACCEPTED,
      `${acceptorLogin} aceitou o teu pedido de amizade`,
    );
  }

  /**
   * Notifica uma nova mensagem privada recebida (destinatário offline).
   * @param userId ID do destinatário
   * @param senderLogin Login de quem enviou a mensagem
   */
  async notifyNewMessage(userId: string, senderLogin: string) {
    return this.create(
      userId,
      NotificationType.NEW_MESSAGE,
      `Nova mensagem de ${senderLogin}`,
    );
  }

  /**
   * Notifica um convite para projecto recebido.
   * @param userId ID do convidado
   * @param inviterLogin Login de quem convidou
   * @param projectName Nome do projecto
   */
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

  /**
   * Notifica o autor do convite sobre a resposta do convidado.
   * @param userId ID de quem convidou
   * @param inviteeLogin Login do convidado
   * @param projectName Nome do projecto
   * @param accepted true se o convite foi aceite
   */
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
   * Notifica um pedido de amizade recebido.
   * O friendshipId no payload permite aceitar/recusar directamente na UI.
   * @param userId ID do utilizador destinatário
   * @param requesterLogin Login de quem enviou o pedido
   * @param friendshipId ID da linha Friendship pendente
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

  /**
   * Lista as notificações de um utilizador com paginação real.
   * GET /notifications
   * @param userId ID do utilizador
   * @param onlyUnread Se verdadeiro, retorna apenas não lidas
   * @param page Página (começa em 1)
   * @param limit Resultados por página
   */
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

  /**
   * Marca uma notificação como lida.
   * PATCH /notifications/:id/read
   * O filtro por userId garante que só marca notificações próprias.
   */
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

  /**
   * Marca todas as notificações do utilizador como lidas.
   * PATCH /notifications/read-all
   */
  async markAllAsRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    return { message: 'All notifications marked as read', count: result.count };
  }
}