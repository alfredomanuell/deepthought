import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AchievementsService } from '../achievements/achievements.service';
import { NotificationsService } from '../notifications/notifications.service';
import { FriendshipsService } from '../friendships/friendships.service';
import { NotificationType, Prisma, ProjectStatus } from '@prisma/client';

const PUBLIC_USER_SELECT = {
  id: true,
  login: true,
  displayName: true,
  avatar: true,
  campus: true,
  coalition: true,
  level: true,
} satisfies Prisma.UserSelect;
import {
  UpdateProjectStatusDto,
  CreateHelpRequestDto,
  CreateHelpOfferDto,
  ProjectsQueryDto,
} from './dto/projects.dto';

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly achievementsService: AchievementsService,
    private readonly notificationsService: NotificationsService,
    private readonly friendships: FriendshipsService,
  ) {}

  async findCatalog() {
    return this.prisma.project.findMany({
      select: { id: true, name: true, slug: true },
      orderBy: { name: 'asc' },
    });
  }

  async findAll(query: ProjectsQueryDto, currentUserId?: string) {
    const { status, needHelp, campus, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const userWhere: Prisma.UserWhereInput = {
      isBanned: false,
    };

    if (campus) {
      userWhere.campus = { equals: campus, mode: 'insensitive' };
    }

    const where: Prisma.UserProjectWhereInput = {
      user: userWhere,
    };

    if (status) {
      where.status = status;
    }

    if (needHelp !== undefined) {
      where.needHelp = needHelp;
    }

    if (query.mine && currentUserId) {
      where.userId = currentUserId;
    }

    const [projects, total] = await this.prisma.$transaction([
      this.prisma.userProject.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          project: { select: { id: true, name: true, slug: true } },
          user: {
            select: {
              id: true,
              login: true,
              displayName: true,
              avatar: true,
              campus: true,
              coalition: true,
              level: true,
            },
          },
          helpRequests: {
            where: { isResolved: false },
            select: { id: true },
          },
        },
      }),
      this.prisma.userProject.count({ where }),
    ]);

    return {
      data: projects.map((p) => ({
        ...p,
        openHelpRequestsCount: p.helpRequests.length,
        helpRequests: undefined,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /** A rota pública usa Project.id, não UserProject.id. */
  async findOne(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        users: {
          where: { user: { isBanned: false } },
          orderBy: { updatedAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                login: true,
                displayName: true,
                avatar: true,
                campus: true,
                coalition: true,
                level: true,
              },
            },
            helpRequests: {
              orderBy: { createdAt: 'desc' },
            },
            helpOffers: {
              include: {
                helper: {
                  select: {
                    id: true,
                    login: true,
                    displayName: true,
                    avatar: true,
                  },
                },
              },
              orderBy: { createdAt: 'desc' },
            },
          },
        },
        resources: {
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                login: true,
                displayName: true,
                avatar: true,
              },
            },
          },
        },
        chatRooms: {
          orderBy: { createdAt: 'desc' },
          include: {
            _count: {
              select: {
                participants: true,
                messages: true,
              },
            },
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }

    return project;
  }

  async updateStatus(id: string, userId: string, dto: UpdateProjectStatusDto) {
    const userProject = await this.prisma.userProject.findFirst({
      where: { id, userId },
    });

    if (!userProject) {
      throw new NotFoundException('Project not found or you are not the owner');
    }

    const updateData: Prisma.UserProjectUpdateInput = { status: dto.status };

    if (dto.status === ProjectStatus.FINISHED) {
      updateData.validatedAt = new Date();
      if (dto.finalMark !== undefined) {
        updateData.finalMark = dto.finalMark;
      }
    }

    const updated = await this.prisma.userProject.update({
      where: { id },
      data: updateData,
      include: { project: true },
    });

    if (dto.status === ProjectStatus.FINISHED) {
      setImmediate(async () => {
        try {
          await this.achievementsService.checkAchievements(userId);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.error(`Achievement check failed: ${message}`);
        }
      });
    }

    return updated;
  }

  async createHelpRequest(
    userProjectId: string,
    userId: string,
    dto: CreateHelpRequestDto,
  ) {
    const userProject = await this.prisma.userProject.findFirst({
      where: { id: userProjectId, userId },
    });

    if (!userProject) {
      throw new NotFoundException('Project not found or you are not the owner');
    }

    const [helpRequest] = await this.prisma.$transaction([
      this.prisma.projectHelpRequest.create({
        data: {
          userProjectId,
          title: dto.title,
          description: dto.description,
        },
      }),
      this.prisma.userProject.update({
        where: { id: userProjectId },
        data: { needHelp: true },
      }),
    ]);

    return helpRequest;
  }

  async createHelpOffer(
    userProjectId: string,
    helperId: string,
    dto: CreateHelpOfferDto,
  ) {
    const userProject = await this.prisma.userProject.findUnique({
      where: { id: userProjectId },
      include: {
        user: { select: { id: true, login: true } },
        project: { select: { name: true } },
      },
    });

    if (!userProject) {
      throw new NotFoundException(`Project ${userProjectId} not found`);
    }

    if (userProject.userId === helperId) {
      throw new BadRequestException('Cannot offer help to your own project');
    }

    const helpOffer = await this.prisma.projectHelpOffer.create({
      data: {
        userProjectId,
        helperId,
        message: dto.message,
      },
      include: {
        helper: { select: { id: true, login: true, displayName: true, avatar: true } },
      },
    });

    await this.notificationsService.notifyHelpOffered(
      userProject.userId,
      helpOffer.helper.login,
      userProject.project.name,
    );

    setImmediate(async () => {
      try {
        await this.achievementsService.checkAchievements(helperId);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Achievement check failed: ${message}`);
      }
    });

    return helpOffer;
  }

  async findOpenHelpRequests(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [requests, total] = await this.prisma.$transaction([
      this.prisma.projectHelpRequest.findMany({
        where: { isResolved: false },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          userProject: {
            include: {
              project: { select: { id: true, name: true, slug: true } },
              user: {
                select: { id: true, login: true, displayName: true, avatar: true, campus: true },
              },
            },
          },
        },
      }),
      this.prisma.projectHelpRequest.count({ where: { isResolved: false } }),
    ]);

    return {
      data: requests,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async listOffers(userProjectId: string, userId: string) {
    const userProject = await this.prisma.userProject.findFirst({
      where: { id: userProjectId, userId },
      select: { id: true },
    });

    if (!userProject) {
      throw new NotFoundException('Project not found or you are not the owner');
    }

    return this.prisma.projectHelpOffer.findMany({
      where: { userProjectId },
      include: { helper: { select: PUBLIC_USER_SELECT } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Aceita oferta: amizade automática, fecha pedido de ajuda e notifica o helper.
   * O frontend usa o helper devolvido para abrir a DM.
   */
  async acceptOffer(offerId: string, user: { sub: string; login: string }) {
    const offer = await this.prisma.projectHelpOffer.findUnique({
      where: { id: offerId },
      include: {
        helper: { select: PUBLIC_USER_SELECT },
        userProject: {
          include: { project: { select: { name: true } } },
        },
      },
    });

    /** 404 também quando a oferta não é num projecto do próprio. */
    if (!offer || offer.userProject.userId !== user.sub) {
      throw new NotFoundException('Offer not found');
    }

    await this.friendships.ensureFriends(user.sub, offer.helperId);

    await this.prisma.$transaction([
      this.prisma.userProject.update({
        where: { id: offer.userProjectId },
        data: { needHelp: false },
      }),
      this.prisma.projectHelpRequest.updateMany({
        where: { userProjectId: offer.userProjectId, isResolved: false },
        data: { isResolved: true },
      }),
    ]);

    await this.notificationsService.create(
      offer.helperId,
      NotificationType.PROJECT_UPDATE,
      `${user.login} aceitou a tua oferta de ajuda no ${offer.userProject.project.name}`,
    );

    this.logger.log(`Offer ${offerId} accepted by ${user.sub}`);

    return { helper: offer.helper };
  }

  async findPeers(projectId: string, currentUserId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, slug: true },
    });

    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }

    const baseWhere = {
      projectId,
      userId: { not: currentUserId },
      user: { isBanned: false },
    };

    const select = {
      user: { select: PUBLIC_USER_SELECT },
    } satisfies Prisma.UserProjectSelect;

    const [doing, finished, eligible] = await this.prisma.$transaction([
      this.prisma.userProject.findMany({
        where: { ...baseWhere, status: ProjectStatus.IN_PROGRESS },
        select,
        orderBy: { updatedAt: 'desc' },
        take: 50,
      }),
      this.prisma.userProject.findMany({
        where: { ...baseWhere, status: ProjectStatus.FINISHED },
        select,
        orderBy: { updatedAt: 'desc' },
        take: 50,
      }),
      this.prisma.userProject.findMany({
        where: { ...baseWhere, status: ProjectStatus.NOT_STARTED },
        select,
        orderBy: { updatedAt: 'desc' },
        take: 50,
      }),
    ]);

    return {
      project,
      doing: doing.map((r) => r.user),
      finished: finished.map((r) => r.user),
      eligible: eligible.map((r) => r.user),
    };
  }
}
