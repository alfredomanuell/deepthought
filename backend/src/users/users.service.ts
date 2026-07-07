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

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly friendships: FriendshipsService,
  ) {}

  async findAll(query: UsersQueryDto) {
    const { login, campus, coalition, page = 1, limit = 20 } = query;

    const skip = (page - 1) * limit;

    const where: any = {
      isBanned: false,
    };

    if (login) {
      where.login = { contains: login, mode: 'insensitive' };
    }

    if (campus) {
      where.campus = { equals: campus, mode: 'insensitive' };
    }

    if (coalition) {
      where.coalition = { equals: coalition, mode: 'insensitive' };
    }

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { level: 'desc' },
        select: this.publicUserSelect(),
      }),
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

  async findMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        achievements: {
          include: {
            achievement: true,
          },
          orderBy: { unlockedAt: 'desc' },
        },
        projects: {
          include: {
            project: true,
          },
          orderBy: { updatedAt: 'desc' },
        },
        notifications: {
          where: { isRead: false },
          select: { id: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const stats = this.calculateStats(user);

    return {
      ...this.sanitizeUser(user),
      stats,
      achievements: user.achievements,
      projects: user.projects,
      unreadNotifications: user.notifications.length,
    };
  }

  async updateMe(userId: string, dto: UpdateProfileDto) {
    this.logger.log(`Updating profile for user ${userId}`);

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

  /**
   * Se existir bloqueio entre o viewer e o alvo (em qualquer direcção),
   * devolve apenas um perfil mínimo (privacidade de bloqueios).
   */
  async findPublicProfile(id: string, viewerId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        achievements: {
          include: { achievement: true },
          orderBy: { unlockedAt: 'desc' },
        },
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

    // 404 para não revelar a existência de utilizadores banidos
    if (user.isBanned) {
      throw new NotFoundException(`User with id ${id} not found`);
    }

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

  async findBy42Id(fortyTwoId: number) {
    return this.prisma.user.findUnique({
      where: { fortyTwoId },
    });
  }

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

  private sanitizeUser(user: any) {
    const { refreshTokenHash, otpCode, otpExpiresAt, ...safe } = user;
    return safe;
  }

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
