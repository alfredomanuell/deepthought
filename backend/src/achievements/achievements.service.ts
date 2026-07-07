import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  ACHIEVEMENT_DEFINITIONS,
  AchievementDefinition,
  UserStats,
} from './achievements.constants';
import { Achievement, ProjectStatus } from '@prisma/client';

/**
 * O método checkAchievements() é chamado após:
 * - Sync com API 42
 * - Conclusão de projecto
 * - Oferta de ajuda
 */
@Injectable()
export class AchievementsService {
  private readonly logger = new Logger(AchievementsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async findAll() {
    return this.prisma.achievement.findMany({
      orderBy: { xpReward: 'asc' },
    });
  }

  async findByUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isBanned: true },
    });

    if (!user || user.isBanned) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    return this.prisma.userAchievement.findMany({
      where: { userId },
      include: {
        achievement: true,
      },
      orderBy: { unlockedAt: 'desc' },
    });
  }

  /**
   * Verifica e desbloqueia conquistas para um utilizador.
   * Garante seed do catálogo, avalia critérios e atribui XP + notificação.
   */
  async checkAchievements(userId: string): Promise<void> {
    this.logger.debug(`Checking achievements for user ${userId}`);

    const stats = await this.calculateUserStats(userId);
    await this.seedAchievementsIfNeeded();

    const alreadyUnlocked = await this.prisma.userAchievement.findMany({
      where: { userId },
      select: { achievement: { select: { slug: true } } },
    });

    const unlockedSlugs = new Set(
      alreadyUnlocked.map((ua) => ua.achievement.slug),
    );

    const definitionsToUnlock = ACHIEVEMENT_DEFINITIONS.filter(
      (definition) =>
        !unlockedSlugs.has(definition.slug) && definition.check(stats),
    );

    if (definitionsToUnlock.length === 0) {
      return;
    }

    const achievements = await this.prisma.achievement.findMany({
      where: {
        slug: { in: definitionsToUnlock.map((definition) => definition.slug) },
      },
    });

    const achievementBySlug = new Map(
      achievements.map((achievement) => [achievement.slug, achievement]),
    );

    for (const definition of definitionsToUnlock) {
      const achievement = achievementBySlug.get(definition.slug);

      if (!achievement) {
        this.logger.warn(`Achievement ${definition.slug} is missing from database`);
        continue;
      }

      await this.unlockAchievement(userId, achievement, definition);
    }
  }

  /**
   * Desbloqueia numa transação com skipDuplicates (idempotente contra corrida).
   * Notificação fora da transação — falha de notificação não reverte XP.
   */
  private async unlockAchievement(
    userId: string,
    achievement: Achievement,
    definition: AchievementDefinition,
  ): Promise<void> {
    this.logger.log(`Unlocking achievement ${achievement.slug} for user ${userId}`);

    const created = await this.prisma.$transaction(async (tx) => {
      const result = await tx.userAchievement.createMany({
        skipDuplicates: true,
        data: {
          userId,
          achievementId: achievement.id,
        },
      });

      if (result.count === 0) {
        return false;
      }

      await tx.user.update({
        where: { id: userId },
        data: { xp: { increment: achievement.xpReward } },
      });

      return true;
    });

    if (!created) {
      this.logger.debug(`Achievement ${achievement.slug} already unlocked for ${userId}`);
      return;
    }

    await this.notificationsService.notifyAchievementUnlocked(
      userId,
      definition.title,
      achievement.xpReward,
    );
  }

  private async calculateUserStats(userId: string): Promise<UserStats> {
    const [user, completedProjects, helpOffersCount] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          level: true,
          evalPoints: true,
        },
      }),
      this.prisma.userProject.count({
        where: {
          userId,
          status: ProjectStatus.FINISHED,
        },
      }),
      this.prisma.projectHelpOffer.count({
        where: { helperId: userId },
      }),
    ]);

    if (!user) {
      return {
        completedProjects: 0,
        level: 0,
        evalPoints: 0,
        helpOffersGiven: 0,
      };
    }

    return {
      completedProjects,
      level: user.level,
      evalPoints: user.evalPoints,
      helpOffersGiven: helpOffersCount,
    };
  }

  /** Upsert apenas para manter o catálogo da BD alinhado com achievements.constants.ts. */
  private async seedAchievementsIfNeeded(): Promise<void> {
    await Promise.all(
      ACHIEVEMENT_DEFINITIONS.map((def) =>
        this.prisma.achievement.upsert({
          where: { slug: def.slug },
          create: {
            slug: def.slug,
            title: def.title,
            description: def.description,
            icon: def.icon,
            xpReward: def.xpReward,
          },
          update: {
            title: def.title,
            description: def.description,
            icon: def.icon,
            xpReward: def.xpReward,
          },
        }),
      ),
    );
  }
}
