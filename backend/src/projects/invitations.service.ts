import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  ProjectInvitationStatus,
  ProjectStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FriendshipsService } from '../friendships/friendships.service';
import { NotificationsService } from '../notifications/notifications.service';

/** Campos públicos dos utilizadores incluídos nas listagens de convites. */
const INVITE_USER_SELECT = {
  id: true,
  login: true,
  displayName: true,
  avatar: true,
} satisfies Prisma.UserSelect;

/** Include comum: projecto + ambos os lados do convite. */
const INVITE_INCLUDE = {
  project: { select: { id: true, name: true, slug: true } },
  inviter: { select: INVITE_USER_SELECT },
  invitee: { select: INVITE_USER_SELECT },
} satisfies Prisma.ProjectInvitationInclude;

/**
 * Serviço de convites para projectos.
 * Convida outro utilizador a juntar-se a um Project do catálogo; ao aceitar,
 * é criado (upsert) o UserProject IN_PROGRESS do convidado.
 */
@Injectable()
export class InvitationsService {
  private readonly logger = new Logger(InvitationsService.name);

  constructor(
    /** Acesso à base de dados */
    private readonly prisma: PrismaService,
    /** Bloqueios: sem convites entre utilizadores bloqueados */
    private readonly friendships: FriendshipsService,
    /** Notificações persistidas + push em tempo real (fase 2) */
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Convida um utilizador para um projecto do catálogo.
   * POST /projects/:id/invite  (body: { userId })
   * @param projectId Project.id do catálogo global
   * @param inviter Utilizador autenticado que convida
   * @param inviteeId Utilizador convidado
   */
  async invite(
    projectId: string,
    inviter: { sub: string; login: string },
    inviteeId: string,
  ) {
    if (inviter.sub === inviteeId) {
      throw new BadRequestException('Cannot invite yourself');
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true },
    });

    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }

    const invitee = await this.prisma.user.findUnique({
      where: { id: inviteeId },
      select: { id: true, isBanned: true },
    });

    if (!invitee || invitee.isBanned) {
      throw new NotFoundException('User not found');
    }

    /** Privacidade de bloqueios: sem convites entre bloqueados. */
    if (await this.friendships.isBlockedBetween(inviter.sub, inviteeId)) {
      throw new ForbiddenException('Cannot invite this user');
    }

    /** Convite é inútil se o convidado já está activo/terminou o projecto. */
    const existingProgress = await this.prisma.userProject.findUnique({
      where: {
        userId_projectId: { userId: inviteeId, projectId },
      },
      select: { status: true },
    });

    if (
      existingProgress &&
      (existingProgress.status === ProjectStatus.IN_PROGRESS ||
        existingProgress.status === ProjectStatus.FINISHED)
    ) {
      throw new ConflictException('User is already on this project');
    }

    /** Reutiliza a linha única [inviter, invitee, project] entre re-convites. */
    const existing = await this.prisma.projectInvitation.findUnique({
      where: {
        inviterId_inviteeId_projectId: {
          inviterId: inviter.sub,
          inviteeId,
          projectId,
        },
      },
    });

    if (existing) {
      if (existing.status === ProjectInvitationStatus.PENDING) {
        throw new ConflictException('Invitation already sent');
      }
      if (existing.status === ProjectInvitationStatus.ACCEPTED) {
        throw new ConflictException('Invitation was already accepted');
      }
    }

    /** Convite novo, ou re-convite depois de uma recusa (volta a PENDING). */
    const invitation = existing
      ? await this.prisma.projectInvitation.update({
          where: { id: existing.id },
          data: { status: ProjectInvitationStatus.PENDING },
          include: INVITE_INCLUDE,
        })
      : await this.prisma.projectInvitation.create({
          data: { projectId, inviterId: inviter.sub, inviteeId },
          include: INVITE_INCLUDE,
        });

    await this.notifications.notifyProjectInvite(
      inviteeId,
      inviter.login,
      project.name,
    );

    this.logger.log(
      `Invite ${inviter.sub} -> ${inviteeId} for project ${projectId}`,
    );
    return invitation;
  }

  /**
   * Lista convites pendentes recebidos e enviados.
   * GET /invitations
   */
  async list(userId: string) {
    const rows = await this.prisma.projectInvitation.findMany({
      where: {
        status: ProjectInvitationStatus.PENDING,
        OR: [{ inviteeId: userId }, { inviterId: userId }],
      },
      include: INVITE_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    return {
      incoming: rows.filter((i) => i.inviteeId === userId),
      outgoing: rows.filter((i) => i.inviterId === userId),
    };
  }

  /**
   * Aceita um convite recebido: marca ACCEPTED e cria o UserProject.
   * PATCH /invitations/:id/accept
   */
  async accept(id: string, invitee: { sub: string; login: string }) {
    const invitation = await this.findPendingForInvitee(id, invitee.sub);

    /** Transacção: resposta ao convite + entrada no projecto são atómicas. */
    const [updated] = await this.prisma.$transaction([
      this.prisma.projectInvitation.update({
        where: { id },
        data: { status: ProjectInvitationStatus.ACCEPTED },
        include: INVITE_INCLUDE,
      }),
      /** Upsert: cria IN_PROGRESS; se já existir (NOT_STARTED/FAILED) promove. */
      this.prisma.userProject.upsert({
        where: {
          userId_projectId: {
            userId: invitee.sub,
            projectId: invitation.projectId,
          },
        },
        create: {
          userId: invitee.sub,
          projectId: invitation.projectId,
          status: ProjectStatus.IN_PROGRESS,
        },
        update: { status: ProjectStatus.IN_PROGRESS },
      }),
    ]);

    await this.notifications.notifyProjectInviteResponse(
      invitation.inviterId,
      invitee.login,
      updated.project.name,
      true,
    );

    this.logger.log(`Invitation ${id} accepted by ${invitee.sub}`);
    return updated;
  }

  /**
   * Recusa um convite recebido.
   * PATCH /invitations/:id/reject
   */
  async reject(id: string, invitee: { sub: string; login: string }) {
    const invitation = await this.findPendingForInvitee(id, invitee.sub);

    const updated = await this.prisma.projectInvitation.update({
      where: { id },
      data: { status: ProjectInvitationStatus.REJECTED },
      include: INVITE_INCLUDE,
    });

    await this.notifications.notifyProjectInviteResponse(
      invitation.inviterId,
      invitee.login,
      updated.project.name,
      false,
    );

    this.logger.log(`Invitation ${id} rejected by ${invitee.sub}`);
    return updated;
  }

  /** 404 também quando o convite não é dirigido ao user (não revela existência). */
  private async findPendingForInvitee(id: string, userId: string) {
    const invitation = await this.prisma.projectInvitation.findUnique({
      where: { id },
    });

    if (
      !invitation ||
      invitation.inviteeId !== userId ||
      invitation.status !== ProjectInvitationStatus.PENDING
    ) {
      throw new NotFoundException('Invitation not found');
    }

    return invitation;
  }
}
