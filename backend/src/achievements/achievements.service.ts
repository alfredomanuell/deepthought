import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  ACHIEVEMENT_DEFINITIONS,
  UserStats,
} from './achievements.constants';
import { Prisma } from '@prisma/client';

/**
 * Serviço de gestão e desbloqueio de conquistas.
 *
 * Responsabilidades:
 * 1. Listar todas as conquistas disponíveis
 * 2. Listar conquistas desbloqueadas por um utilizador
 * 3. Verificar e desbloquear conquistas após eventos (sync, ajuda, etc.)
 * 4. Atribuir XP e gerar notificações ao desbloquear
 *
 * O método checkAchievements() é chamado após:
 * - Sync com API 42
 * - Conclusão de projecto
 * - Oferta de ajuda
 */
@Injectable()
export class AchievementsService {
  private readonly logger = new Logger(AchievementsService.name);

  constructor(
    /** Acesso à base de dados */
    private readonly prisma: PrismaService,
    /** Serviço para criar notificações ao desbloquear conquistas */
    private readonly notificationsService: NotificationsService,
  ) {}

  // ─────────────────────────────────────────────────────────
  // ENDPOINTS PÚBLICOS
  // ─────────────────────────────────────────────────────────

  /**
   * Lista todas as conquistas disponíveis na plataforma.
   * GET /achievements
   */
  async findAll() {
    return this.prisma.achievement.findMany({
      orderBy: { xpReward: 'asc' },
    });
  }

  /**
   * Lista as conquistas desbloqueadas por um utilizador específico.
   * GET /users/:id/achievements
   * @param userId ID do utilizador
   */
  async findByUser(userId: string) {
    // Verifica se o utilizador existe
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
        // Inclui os detalhes completos da conquista
        achievement: true,
      },
      orderBy: { unlockedAt: 'desc' },
    });
  }

  // ─────────────────────────────────────────────────────────
  // MOTOR DE DESBLOQUEIO
  // ─────────────────────────────────────────────────────────

  /**
   * Método principal — verifica e desbloqueia conquistas para um utilizador.
   * Chamado automaticamente após sync, ajuda ou conclusão de projecto.
   *
   * Fluxo:
   * 1. Calcula as estatísticas actuais do utilizador
   * 2. Garante que todas as conquistas existem na BD (seed automático)
   * 3. Verifica quais conquistas ainda não foram desbloqueadas
   * 4. Para cada conquista não desbloqueada, verifica os critérios
   * 5. Se os critérios forem cumpridos: cria UserAchievement + atribui XP + notifica
   *
   * @param userId ID do utilizador a verificar
   */
  async checkAchievements(userId: string): Promise<void> {
    this.logger.debug(`Checking achievements for user ${userId}`);

    // 1. Calcula as estatísticas actuais do utilizador
    const stats = await this.calculateUserStats(userId);

    // 2. Garante que todas as conquistas do catálogo existem na BD
    await this.seedAchievementsIfNeeded();

    // 3. Busca as conquistas que o utilizador JÁ desbloqueou
    const alreadyUnlocked = await this.prisma.userAchievement.findMany({
      where: { userId },
      select: { achievementId: true },
    });
    // Cria um Set com os IDs já desbloqueados para lookup O(1)
    const unlockedIds = new Set(alreadyUnlocked.map((ua) => ua.achievementId));

    // 4. Busca todas as conquistas da BD
    const allAchievements = await this.prisma.achievement.findMany();

    // 5. Para cada conquista, verifica se deve ser desbloqueada
    for (const achievement of allAchievements) {
      // Ignora conquistas já desbloqueadas
      if (unlockedIds.has(achievement.id)) continue;

      // Encontra a definição local da conquista pelo slug
      const definition = ACHIEVEMENT_DEFINITIONS.find(
        (d) => d.slug === achievement.slug,
      );
      if (!definition) continue;

      // Verifica os critérios usando a função check() da definição
      const shouldUnlock = definition.check(stats);

      if (shouldUnlock) {
        await this.unlockAchievement(userId, achievement);
      }
    }
  }

  // ─────────────────────────────────────────────────────────
  // MÉTODOS PRIVADOS
  // ─────────────────────────────────────────────────────────

  /**
   * Desbloqueia uma conquista para o utilizador.
   * Executa numa transação: cria UserAchievement + adiciona XP ao utilizador.
   * Depois da transação, cria a notificação.
   * @param userId ID do utilizador
   * @param achievement Conquista a desbloquear
   */
  private async unlockAchievement(userId: string, achievement: any): Promise<void> {
    this.logger.log(`Unlocking achievement ${achievement.slug} for user ${userId}`);

    try {
      // Usa transação para garantir que o XP e o unlock são atómicos
      await this.prisma.$transaction([
        // Cria o registo de conquista desbloqueada
        this.prisma.userAchievement.create({
          data: {
            userId,
            achievementId: achievement.id,
          },
        }),
        // Adiciona o XP ao utilizador
        this.prisma.user.update({
          where: { id: userId },
          data: {
            xp: { increment: achievement.xpReward },
          },
        }),
      ]);

      // Cria notificação fora da transação (não é crítico)
      await this.notificationsService.notifyAchievementUnlocked(
        userId,
        achievement.title,
        achievement.xpReward,
      );
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        this.logger.debug(`Achievement ${achievement.slug} already unlocked for ${userId}`);
        return;
      }
      throw error;
    }
  }

  /**
   * Calcula as estatísticas actuais do utilizador para avaliação de conquistas.
   * @param userId ID do utilizador
   */
  private async calculateUserStats(userId: string): Promise<UserStats> {
    // Executa todas as queries em paralelo para melhor performance
    const [user, helpOffersCount] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          level: true,
          evalPoints: true,
          // Conta apenas projectos concluídos
          projects: {
            where: { status: 'FINISHED' },
            select: { id: true },
          },
        },
      }),
      // Conta o número de ajudas oferecidas pelo utilizador
      this.prisma.projectHelpOffer.count({
        where: { helperId: userId },
      }),
    ]);

    if (!user) {
      return { completedProjects: 0, level: 0, evalPoints: 0, helpOffersGiven: 0 };
    }

    return {
      completedProjects: user.projects.length,
      level: user.level,
      evalPoints: user.evalPoints,
      helpOffersGiven: helpOffersCount,
    };
  }

  /**
   * Garante que todas as conquistas do catálogo existem na base de dados.
   * Executa o upsert apenas para conquistas em falta (não recria as existentes).
   * Chamado automaticamente pelo checkAchievements().
   */
  private async seedAchievementsIfNeeded(): Promise<void> {
    for (const def of ACHIEVEMENT_DEFINITIONS) {
      await this.prisma.achievement.upsert({
        where: { slug: def.slug },
        create: {
          slug: def.slug,
          title: def.title,
          description: def.description,
          icon: def.icon,
          xpReward: def.xpReward,
        },
        // Actualiza título/descrição se a definição mudar
        update: {
          title: def.title,
          description: def.description,
          icon: def.icon,
          xpReward: def.xpReward,
        },
      });
    }
  }
}