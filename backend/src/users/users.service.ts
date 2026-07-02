import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { FriendshipsService } from '../friendships/friendships.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersQueryDto } from './dto/users-query.dto';
import { MappedFortyTwoProfile } from '../integrations/fortytwo/fortytwo.interfaces';

/**
 * Serviço de gestão de utilizadores.
 * Responsável por:
 * - Listagem paginada e filtrada de utilizadores
 * - Perfil completo do utilizador autenticado (GET /users/me)
 * - Perfil público de outros utilizadores (GET /users/:id)
 * - Actualização do perfil próprio (PATCH /users/me)
 * - Criação de utilizador a partir do perfil da 42
 */
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    /** Serviço de acesso à base de dados */
    private readonly prisma: PrismaService,
    /** Lógica de bloqueios para privacidade do perfil público */
    private readonly friendships: FriendshipsService,
  ) {}

  // ─────────────────────────────────────────────────────────
  // LISTAGEM DE UTILIZADORES
  // ─────────────────────────────────────────────────────────

  /**
   * Lista utilizadores com paginação e filtros opcionais.
   * GET /users
   * @param query Parâmetros de filtro e paginação
   */
  async findAll(query: UsersQueryDto) {
    const { login, campus, coalition, page = 1, limit = 20 } = query;

    // Calcula o offset para paginação
    const skip = (page - 1) * limit;

    // Constrói o filtro dinamicamente com base nos parâmetros recebidos
    const where: any = {
      // Exclui sempre utilizadores banidos das listagens públicas
      isBanned: false,
    };

    // Filtro por login (pesquisa parcial, case-insensitive)
    if (login) {
      where.login = { contains: login, mode: 'insensitive' };
    }

    // Filtro por campus (correspondência exacta, case-insensitive)
    if (campus) {
      where.campus = { equals: campus, mode: 'insensitive' };
    }

    // Filtro por coligação
    if (coalition) {
      where.coalition = { equals: coalition, mode: 'insensitive' };
    }

    // Executa as queries em paralelo para melhor performance
    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        // Ordena por nível descendente por defeito
        orderBy: { level: 'desc' },
        // Selecciona apenas campos públicos (sem dados sensíveis)
        select: this.publicUserSelect(),
      }),
      // Conta o total para calcular metadados de paginação
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ─────────────────────────────────────────────────────────
  // PERFIL PRÓPRIO
  // ─────────────────────────────────────────────────────────

  /**
   * Retorna o perfil completo do utilizador autenticado.
   * Inclui conquistas, projectos e estatísticas.
   * GET /users/me
   * @param userId ID do utilizador autenticado
   */
  async findMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        // Inclui conquistas desbloqueadas com detalhes da conquista
        achievements: {
          include: {
            achievement: true,
          },
          orderBy: { unlockedAt: 'desc' },
        },
        // Inclui projectos com detalhes do projecto
        projects: {
          include: {
            project: true,
          },
          orderBy: { updatedAt: 'desc' },
        },
        // Conta notificações não lidas para exibir na UI
        notifications: {
          where: { isRead: false },
          select: { id: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Calcula estatísticas agregadas do utilizador
    const stats = this.calculateStats(user);

    return {
      ...this.sanitizeUser(user),
      stats,
      achievements: user.achievements,
      projects: user.projects,
      unreadNotifications: user.notifications.length,
    };
  }

  /**
   * Actualiza o perfil do utilizador autenticado.
   * Apenas permite alterar: displayName, avatar, bio.
   * PATCH /users/me
   * @param userId ID do utilizador autenticado
   * @param dto Dados a actualizar
   */
  async updateMe(userId: string, dto: UpdateProfileDto) {
    this.logger.log(`Updating profile for user ${userId}`);

    // Filtra apenas os campos definidos no DTO (ignora undefined)
    const updateData: any = {};
    if (dto.displayName !== undefined) updateData.displayName = dto.displayName;
    if (dto.avatar !== undefined) updateData.avatar = dto.avatar;
    if (dto.bio !== undefined) updateData.bio = dto.bio;
    if (dto.characterLayers !== undefined) {
      updateData.characterLayers = dto.characterLayers;
      updateData.characterCreated = true;
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        login: true,
        displayName: true,
        avatar: true,
        bio: true,
        campus: true,
        coalition: true,
        level: true,
        xp: true,
        role: true,
        characterCreated: true,
        characterLayers: true,
        updatedAt: true,
      },
    });

    return user;
  }

  // ─────────────────────────────────────────────────────────
  // PERFIL PÚBLICO
  // ─────────────────────────────────────────────────────────

  /**
   * Retorna o perfil público de um utilizador por ID.
   * Não expõe dados sensíveis (email, refreshTokenHash, etc.).
   * Se existir bloqueio entre o viewer e o alvo (em qualquer direcção),
   * devolve apenas um perfil mínimo (privacidade de bloqueios).
   * GET /users/:id
   * @param id ID do utilizador a consultar
   * @param viewerId ID do utilizador autenticado que está a consultar
   */
  async findPublicProfile(id: string, viewerId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        // Inclui conquistas desbloqueadas
        achievements: {
          include: { achievement: true },
          orderBy: { unlockedAt: 'desc' },
        },
        // Inclui apenas projectos concluídos no perfil público
        projects: {
          where: {
            status: 'FINISHED',
          },
          include: { project: true },
          orderBy: { validatedAt: 'desc' },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }

    // Verifica se o utilizador está banido — retorna 404 para não revelar a existência
    if (user.isBanned) {
      throw new NotFoundException(`User with id ${id} not found`);
    }

    // Perfil limitado quando há bloqueio entre os dois utilizadores
    if (
      viewerId &&
      viewerId !== id &&
      (await this.friendships.isBlockedBetween(viewerId, id))
    ) {
      return {
        id: user.id,
        login: user.login,
        displayName: user.displayName,
        avatar: user.avatar,
        limited: true,
      };
    }

    return {
      id: user.id,
      login: user.login,
      displayName: user.displayName,
      avatar: user.avatar,
      bio: user.bio,
      campus: user.campus,
      coalition: user.coalition,
      level: user.level,
      xp: user.xp,
      role: user.role,
      lastSeenAt: user.lastSeenAt,
      createdAt: user.createdAt,
      achievements: user.achievements,
      completedProjects: user.projects,
    };
  }

  // ─────────────────────────────────────────────────────────
  // MÉTODOS INTERNOS (usados por outros módulos)
  // ─────────────────────────────────────────────────────────

  /**
   * Procura um utilizador pelo ID da 42.
   * Usado pelo AuthService para verificar se já existe.
   * @param fortyTwoId ID numérico do utilizador na 42
   */
  async findBy42Id(fortyTwoId: number) {
    return this.prisma.user.findUnique({
      where: { fortyTwoId },
    });
  }

  /**
   * Cria um novo utilizador a partir do perfil mapeado da API 42.
   * Usado no primeiro login OAuth2.
   * @param profile Perfil mapeado da API 42
   */
  async createFrom42Profile(profile: MappedFortyTwoProfile) {
    return this.prisma.user.create({
      data: {
        fortyTwoId: profile.fortyTwoId,
        login: profile.login,
        email: profile.email,
        displayName: profile.displayName,
        avatar: profile.avatar,
        campus: profile.campus,
        coalition: profile.coalition,
        level: profile.level,
        evalPoints: profile.evalPoints,
        xp: Math.round(profile.level * 1000),
        isEmailVerified: false, // Primeiro login deve validar OTP antes de receber JWT
        lastSyncAt: new Date(),
        lastSeenAt: new Date(),
      },
    });
  }

  // ─────────────────────────────────────────────────────────
  // UTILITÁRIOS PRIVADOS
  // ─────────────────────────────────────────────────────────

  /**
   * Define os campos seleccionados para perfis públicos na listagem.
   * Exclui campos sensíveis como email, refreshTokenHash, bannedAt.
   */
  private publicUserSelect() {
    return {
      id: true,
      login: true,
      displayName: true,
      avatar: true,
      campus: true,
      coalition: true,
      level: true,
      xp: true,
      role: true,
      lastSeenAt: true,
    };
  }

  /**
   * Remove campos sensíveis do objecto de utilizador.
   * @param user Objecto completo do utilizador
   */
  private sanitizeUser(user: any) {
    const { refreshTokenHash, otpCode, otpExpiresAt, ...safe } = user;
    return safe;
  }

  /**
   * Calcula estatísticas agregadas do utilizador.
   * @param user Utilizador com relações carregadas
   */
  private calculateStats(user: any) {
    const completedProjects =
      user.projects?.filter((p: any) => p.status === 'FINISHED').length ?? 0;

    const totalAchievements = user.achievements?.length ?? 0;

    return {
      completedProjects,
      totalProjects: user.projects?.length ?? 0,
      totalAchievements,
      level: user.level,
      xp: user.xp,
      evalPoints: user.evalPoints,
    };
  }
}
