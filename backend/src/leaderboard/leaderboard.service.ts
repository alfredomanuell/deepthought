import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LeaderboardQueryDto } from './dto/leaderboard-query.dto';

@Injectable()
export class LeaderboardService {
  private readonly logger = new Logger(LeaderboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getXpLeaderboard(query: LeaderboardQueryDto, currentUserId: string) {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where = { isBanned: false };

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ xp: 'desc' }, { level: 'desc' }],
        select: {
          id: true,
          login: true,
          displayName: true,
          avatar: true,
          campus: true,
          coalition: true,
          level: true,
          xp: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const userPosition = await this.getUserPosition(currentUserId, 'xp');

    const rankedUsers = users.map((user, index) => ({
      ...user,
      position: skip + index + 1,
    }));

    return {
      data: rankedUsers,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        currentUserPosition: userPosition,
      },
    };
  }

  async getAchievementsLeaderboard(query: LeaderboardQueryDto, currentUserId: string) {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    // Prisma não suporta groupBy com relações directamente — usa-se raw query.
    const [rankingRaw, total] = await this.prisma.$transaction([
      this.prisma.$queryRaw<Array<{
        userId: string;
        achievementCount: bigint;
      }>>`
        SELECT 
          ua."userId",
          COUNT(ua."achievementId")::int AS "achievementCount"
        FROM "UserAchievement" ua
        JOIN "User" u ON u.id = ua."userId"
        WHERE u."isBanned" = false
        GROUP BY ua."userId"
        ORDER BY "achievementCount" DESC, ua."userId"
        LIMIT ${limit} OFFSET ${skip}
      `,
      this.prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(DISTINCT ua."userId")::int AS count
        FROM "UserAchievement" ua
        JOIN "User" u ON u.id = ua."userId"
        WHERE u."isBanned" = false
      `,
    ]);

    const userIds = rankingRaw.map((r) => r.userId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        login: true,
        displayName: true,
        avatar: true,
        campus: true,
        coalition: true,
        level: true,
        xp: true,
      },
    });

    const usersById = new Map(users.map((user) => [user.id, user]));

    const ranked = rankingRaw.map((r, index) => {
      const user = usersById.get(r.userId);
      return {
        ...user,
        achievementCount: Number(r.achievementCount),
        position: skip + index + 1,
      };
    });

    const userPositionRaw = await this.prisma.$queryRaw<[{ position: bigint }]>`
      SELECT COUNT(*) + 1 AS position
      FROM (
        SELECT ua."userId", COUNT(*) AS cnt
        FROM "UserAchievement" ua
        JOIN "User" u ON u.id = ua."userId"
        WHERE u."isBanned" = false
        GROUP BY ua."userId"
        HAVING COUNT(*) > (
          SELECT COUNT(*) FROM "UserAchievement" WHERE "userId" = ${currentUserId}
        )
      ) ranked
    `;

    return {
      data: ranked,
      meta: {
        total: Number(total[0]?.count ?? 0),
        page,
        limit,
        totalPages: Math.ceil(Number(total[0]?.count ?? 0) / limit),
        currentUserPosition: Number(userPositionRaw[0]?.position ?? 0),
      },
    };
  }

  async getLevelLeaderboard(query: LeaderboardQueryDto, currentUserId: string) {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where = { isBanned: false };

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ level: 'desc' }, { xp: 'desc' }],
        select: {
          id: true,
          login: true,
          displayName: true,
          avatar: true,
          campus: true,
          coalition: true,
          level: true,
          xp: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const userPosition = await this.getUserPosition(currentUserId, 'level');

    const rankedUsers = users.map((user, index) => ({
      ...user,
      position: skip + index + 1,
    }));

    return {
      data: rankedUsers,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        currentUserPosition: userPosition,
      },
    };
  }

  private async getUserPosition(
    userId: string,
    field: 'xp' | 'level',
  ): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, xp: true, level: true },
    });

    if (!user) return 0;

    /** XP usa level como desempate; level usa XP como desempate. */
    const primaryValue = user[field];
    const tieBreakerField = field === 'xp' ? 'level' : 'xp';
    const tieBreakerValue = user[tieBreakerField];

    const ahead = await this.prisma.user.count({
      where: {
        isBanned: false,
        OR: [
          { [field]: { gt: primaryValue } },
          {
            [field]: primaryValue,
            [tieBreakerField]: { gt: tieBreakerValue },
          },
          {
            [field]: primaryValue,
            [tieBreakerField]: tieBreakerValue,
            id: { lt: user.id },
          },
        ],
      },
    });

    return ahead + 1;
  }
}
