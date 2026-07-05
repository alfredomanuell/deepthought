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

/** Campos públicos de utilizadores em listagens do board/peers. */
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

/**
 * Serviço de gestão do Project Board.
 * Permite visualizar, actualizar e gerir pedidos/ofertas de ajuda em projectos.
 */
@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    /** Acesso à base de dados */
    private readonly prisma: PrismaService,
    /** Para verificar conquistas após conclusão de projecto */
    private readonly achievementsService: AchievementsService,
    /** Para criar notificações de ajuda */
    private readonly notificationsService: NotificationsService,
    /** Amizade automática ao aceitar uma oferta de ajuda */
    private readonly friendships: FriendshipsService,
  ) {}

  /**
   * Retorna o catálogo de todos os projectos disponíveis na plataforma.
   * GET /projects/catalog
   */
  async findCatalog() {
    return this.prisma.project.findMany({
      select: { id: true, name: true, slug: true },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Lista projectos de todos os utilizadores com filtros e paginação.
   * GET /projects
   */
  async findAll(query: ProjectsQueryDto, currentUserId?: string) {
    const { status, needHelp, campus, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    /** Filtro Prisma do User relacionado, reutilizado dentro do filtro UserProject. */
    const userWhere: Prisma.UserWhereInput = {
      /** Exclui utilizadores banidos do Project Board público. */
      isBanned: false,
    };

    /** Se o cliente filtrou por campus, aplica comparação case-insensitive. */
    if (campus) {
      userWhere.campus = { equals: campus, mode: 'insensitive' };
    }

    /** Filtro Prisma tipado para evitar `any` e proteger nomes de campos. */
    const where: Prisma.UserProjectWhereInput = {
      /** Exclui projectos de utilizadores banidos do board público. */
      user: userWhere,
    };

    if (status) {
      where.status = status;
    }

    // Filtro por flag needHelp
    if (needHelp !== undefined) {
      where.needHelp = needHelp;
    }

    // Apenas os projectos do próprio utilizador (formulário "pedir ajuda")
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
          // Inclui dados do projecto (nome, slug)
          project: { select: { id: true, name: true, slug: true } },
          // Inclui dados públicos do utilizador
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
          // Conta pedidos de ajuda abertos
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
        helpRequests: undefined, // Remove a lista completa da resposta resumida
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Retorna os detalhes completos de um Project do catálogo global.
   * GET /projects/:id
   * @param projectId ID do Project, não do UserProject
   */
  async findOne(projectId: string) {
    /** Consulta o modelo Project porque a rota pública usa Project.id. */
    const project = await this.prisma.project.findUnique({
      /** Usa o ID do Project recebido na rota, corrigindo o bug de UserProject.id. */
      where: { id: projectId },
      /** Inclui relações necessárias para a página de detalhe do projecto. */
      include: {
        /** Lista todos os utilizadores associados a este Project via UserProject. */
        users: {
          /** Não expõe utilizadores banidos no detalhe público do projecto. */
          where: { user: { isBanned: false } },
          /** Ordena participações recentes primeiro para uma resposta estável. */
          orderBy: { updatedAt: 'desc' },
          /** Inclui dados do progresso do utilizador neste projecto. */
          include: {
            /** Inclui dados públicos do utilizador dono deste UserProject. */
            user: {
              /** Selecciona apenas campos seguros e úteis para UI. */
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
            /** Inclui pedidos de ajuda ligados a este UserProject. */
            helpRequests: {
              /** Mostra pedidos mais recentes primeiro. */
              orderBy: { createdAt: 'desc' },
            },
            /** Inclui ofertas de ajuda ligadas a este UserProject. */
            helpOffers: {
              /** Inclui dados públicos de quem ofereceu ajuda. */
              include: {
                helper: {
                  /** Selecciona apenas campos públicos do helper. */
                  select: {
                    id: true,
                    login: true,
                    displayName: true,
                    avatar: true,
                  },
                },
              },
              /** Mostra ofertas mais recentes primeiro. */
              orderBy: { createdAt: 'desc' },
            },
          },
        },
        /** Inclui recursos associados directamente ao Project. */
        resources: {
          /** Mostra recursos mais recentes primeiro. */
          orderBy: { createdAt: 'desc' },
          /** Inclui autor do recurso para contexto na UI. */
          include: {
            user: {
              /** Selecciona apenas dados públicos do autor. */
              select: {
                id: true,
                login: true,
                displayName: true,
                avatar: true,
              },
            },
          },
        },
        /** Inclui salas de chat associadas ao Project, se existirem no schema. */
        chatRooms: {
          /** Ordena salas por criação para resposta determinística. */
          orderBy: { createdAt: 'desc' },
          /** Inclui contagens sem carregar todas as mensagens. */
          include: {
            _count: {
              /** Conta participantes e mensagens para evitar payload pesado. */
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

  /**
   * Actualiza o estado de um UserProject.
   * Apenas o dono do projecto pode actualizar.
   * PATCH /projects/:id
   * @param id ID do UserProject
   * @param userId ID do utilizador autenticado
   * @param dto Dados a actualizar
   */
  async updateStatus(id: string, userId: string, dto: UpdateProjectStatusDto) {
    // Verifica se o projecto existe e pertence ao utilizador
    const userProject = await this.prisma.userProject.findFirst({
      where: { id, userId },
    });

    if (!userProject) {
      throw new NotFoundException('Project not found or you are not the owner');
    }

    /** Dados Prisma tipados para atualizar apenas campos permitidos. */
    const updateData: Prisma.UserProjectUpdateInput = { status: dto.status };

    // Regista a data de conclusão se o projecto for marcado como FINISHED
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

    // Se o projecto foi concluído, verifica conquistas
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

  /**
   * Cria um pedido de ajuda num projecto.
   * POST /projects/:id/help-request
   * @param userProjectId ID do UserProject
   * @param userId ID do utilizador autenticado
   * @param dto Título e descrição do pedido
   */
  async createHelpRequest(
    userProjectId: string,
    userId: string,
    dto: CreateHelpRequestDto,
  ) {
    // Verifica se o projecto pertence ao utilizador
    const userProject = await this.prisma.userProject.findFirst({
      where: { id: userProjectId, userId },
    });

    if (!userProject) {
      throw new NotFoundException('Project not found or you are not the owner');
    }

    // Cria o pedido de ajuda e activa a flag needHelp em transacção
    const [helpRequest] = await this.prisma.$transaction([
      this.prisma.projectHelpRequest.create({
        data: {
          userProjectId,
          title: dto.title,
          description: dto.description,
        },
      }),
      // Activa a flag needHelp para aparecer nos filtros
      this.prisma.userProject.update({
        where: { id: userProjectId },
        data: { needHelp: true },
      }),
    ]);

    return helpRequest;
  }

  /**
   * Cria uma oferta de ajuda para um projecto.
   * POST /projects/:id/help-offer
   * Não pode oferecer ajuda ao próprio projecto.
   * @param userProjectId ID do UserProject
   * @param helperId ID do utilizador que oferece ajuda
   * @param dto Mensagem opcional
   */
  async createHelpOffer(
    userProjectId: string,
    helperId: string,
    dto: CreateHelpOfferDto,
  ) {
    // Busca o projecto e o dono para validações e notificações
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

    // Não pode oferecer ajuda ao próprio projecto
    if (userProject.userId === helperId) {
      throw new BadRequestException('Cannot offer help to your own project');
    }

    // Cria a oferta de ajuda
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

    // Notifica o dono do projecto
    await this.notificationsService.notifyHelpOffered(
      userProject.userId,
      helpOffer.helper.login,
      userProject.project.name,
    );

    // Verifica conquistas de ajuda para o helper
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

  /**
   * Lista pedidos de ajuda abertos (isResolved = false).
   * GET /projects/help/open
   */
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

  /**
   * Lista as ofertas de ajuda recebidas num projecto próprio.
   * GET /projects/:id/offers  (:id = UserProject.id, apenas o dono)
   */
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
   * Aceita uma oferta de ajuda no próprio projecto:
   * cria amizade automática com o helper, fecha o pedido (needHelp off +
   * help requests resolvidos) e notifica o helper. A UI abre depois a DM.
   * POST /projects/offers/:offerId/accept
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

    /** Amizade automática (falha se houver bloqueio entre os dois). */
    await this.friendships.ensureFriends(user.sub, offer.helperId);

    /** Fecha o pedido de ajuda deste projecto. */
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

    /** O frontend usa o helper devolvido para abrir a DM. */
    return { helper: offer.helper };
  }

  /**
   * Encontra colegas para um projecto do catálogo: quem está a fazê-lo,
   * quem já terminou (pode ajudar) e quem ainda não começou (elegível).
   * GET /projects/:id/peers  (:id = Project.id)
   */
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
