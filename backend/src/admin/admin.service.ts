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

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: AdminUsersQueryDto) {
    const { role, campus, banned, login, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

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

  async create(dto: CreateUserDto) {
    this.logger.log(`Admin creating user: ${dto.login}`);

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

  async update(id: string, dto: AdminUpdateUserDto) {
    this.logger.log(`Admin updating user ${id}`);

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

  async remove(id: string, adminId: string) {
    if (id === adminId) {
      throw new BadRequestException('You cannot delete your own account');
    }

    await this.findOneOrThrow(id);

    this.logger.warn(`Admin ${adminId} deleting user ${id}`);

    await this.prisma.user.delete({ where: { id } });

    return { message: `User ${id} deleted successfully` };
  }

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
