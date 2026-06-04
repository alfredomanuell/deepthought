import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateUserDto,
  AdminUpdateUserDto,
  BanUserDto,
  UpdateRoleDto,
  AdminUsersQueryDto,
} from './dto/admin.dto';

/**
 * Serviço de administração.
 * Permite gerir todos os utilizadores da plataforma.
 * Todos os métodos requerem role ADMIN.
 */
@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    /** Acesso total à base de dados */
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Lista todos os utilizadores com filtros avançados (incluindo banidos).
   * GET /admin/users
   */
  async findAll(query: AdminUsersQueryDto) {
    const { role, campus, banned, login, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    // Filtro sem restrições (admin vê tudo, incluindo banidos)
    const where: any = {};

    if (role) where.role = role;
    if (campus) where.campus = { equals: campus, mode: 'insensitive' };
    if (banned !== undefined) where.isBanned = banned;
    if (login) where.login = { contains: login, mode: 'insensitive' };

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          login: true,
          email: true,
          displayName: true,
          avatar: true,
          campus: true,
          coalition: true,
          role: true,
          level: true,
          xp: true,
          isBanned: true,
          bannedAt: true,
          isEmailVerified: true,
          lastSeenAt: true,
          lastSyncAt: true,
          createdAt: true,
          // Conta conquistas e projectos para estatísticas rápidas
          _count: {
            select: {
              achievements: true,
              projects: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Cria um utilizador manualmente (sem OAuth2).
   * POST /admin/users
   * @param dto Dados do novo utilizador
   */
  async create(dto: CreateUserDto) {
    this.logger.log(`Admin creating user: ${dto.login}`);

    // Verifica se o login já existe
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ login: dto.login }, { email: dto.email }] },
    });

    if (existing) {
      throw new ConflictException(
        `User with login '${dto.login}' or email '${dto.email}' already exists`,
      );
    }

    return this.prisma.user.create({
      data: {
        fortyTwoId: dto.fortyTwoId,
        login: dto.login,
        email: dto.email,
        displayName: dto.displayName,
        campus: dto.campus,
        role: dto.role ?? 'USER',
        isEmailVerified: true,
      },
    });
  }

  /**
   * Edita qualquer campo de um utilizador.
   * PATCH /admin/users/:id
   * @param id ID do utilizador a editar
   * @param dto Dados a actualizar
   */
  async update(id: string, dto: AdminUpdateUserDto) {
    this.logger.log(`Admin updating user ${id}`);

    // Verifica se o utilizador existe
    await this.findOneOrThrow(id);

    return this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.displayName !== undefined && { displayName: dto.displayName }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.role !== undefined && { role: dto.role }),
        ...(dto.campus !== undefined && { campus: dto.campus }),
        ...(dto.coalition !== undefined && { coalition: dto.coalition }),
        ...(dto.isEmailVerified !== undefined && { isEmailVerified: dto.isEmailVerified }),
      },
    });
  }

  /**
   * Apaga um utilizador permanentemente.
   * DELETE /admin/users/:id
   * @param id ID do utilizador a apagar
   * @param adminId ID do admin (não pode apagar a si próprio)
   */
  async remove(id: string, adminId: string) {
    // Previne que um admin se apague a si próprio
    if (id === adminId) {
      throw new BadRequestException('You cannot delete your own account');
    }

    await this.findOneOrThrow(id);

    this.logger.warn(`Admin ${adminId} deleting user ${id}`);

    await this.prisma.user.delete({ where: { id } });

    return { message: `User ${id} deleted successfully` };
  }

  /**
   * Bane um utilizador.
   * Regista o motivo e a data do ban.
   * PATCH /admin/users/:id/ban
   * @param id ID do utilizador a banir
   * @param adminId ID do admin (não pode banir a si próprio)
   * @param dto Motivo do ban (opcional)
   */
  async ban(id: string, adminId: string, dto: BanUserDto) {
    if (id === adminId) {
      throw new BadRequestException('You cannot ban yourself');
    }

    const user = await this.findOneOrThrow(id);

    if (user.isBanned) {
      throw new ConflictException('User is already banned');
    }

    this.logger.warn(`Admin ${adminId} banning user ${id}`);

    return this.prisma.user.update({
      where: { id },
      data: {
        isBanned: true,
        bannedAt: new Date(),
      },
    });
  }

  /**
   * Remove o ban de um utilizador.
   * PATCH /admin/users/:id/unban
   */
  async unban(id: string) {
    const user = await this.findOneOrThrow(id);

    if (!user.isBanned) {
      throw new ConflictException('User is not banned');
    }

    this.logger.log(`Unbanning user ${id}`);

    return this.prisma.user.update({
      where: { id },
      data: {
        isBanned: false,
        bannedAt: null,
      },
    });
  }

  /**
   * Altera o role de um utilizador.
   * PATCH /admin/users/:id/role
   */
  async updateRole(id: string, adminId: string, dto: UpdateRoleDto) {
    if (id === adminId) {
      throw new BadRequestException('You cannot change your own role');
    }

    await this.findOneOrThrow(id);

    this.logger.log(`Changing role of user ${id} to ${dto.role}`);

    return this.prisma.user.update({
      where: { id },
      data: { role: dto.role },
    });
  }

  // ─────────────────────────────────────────────────────────
  // UTILITÁRIOS PRIVADOS
  // ─────────────────────────────────────────────────────────

  /**
   * Busca um utilizador ou lança NotFoundException.
   * @param id ID do utilizador
   */
  private async findOneOrThrow(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }

    return user;
  }
}