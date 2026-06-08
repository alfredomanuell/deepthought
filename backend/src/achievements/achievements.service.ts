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

    /** Calcula as estatísticas actuais do utilizador a partir do Prisma. */
    const stats = await this.calculateUserStats(userId);

    /** Garante que o catálogo da BD reflecte o ficheiro achievements.constants.ts. */
    await this.seedAchievementsIfNeeded();

    /** Busca conquistas já desbloqueadas pelo utilizador com o slug da conquista. */
    const alreadyUnlocked = await this.prisma.userAchievement.findMany({
      /** Filtra apenas registos UserAchievement deste User. */
      where: { userId },
      /** Inclui apenas o slug necessário para comparar com as definições locais. */
      select: { achievement: { select: { slug: true } } },
    });

    /** Set com slugs já desbloqueados para lookup O(1). */
    const unlockedSlugs = new Set(
      alreadyUnlocked.map((ua) => ua.achievement.slug),
    );

    /** Avalia todas as conquistas de forma independente, sem else-if e sem return prematuro. */
    const definitionsToUnlock = ACHIEVEMENT_DEFINITIONS.filter(
      (definition) =>
        /** Ignora definições já desbloqueadas pelo utilizador. */
        !unlockedSlugs.has(definition.slug) &&
        /** Executa o critério da definição usando as stats actuais. */
        definition.check(stats),
    );

    /** Se nenhum critério foi cumprido, termina sem tocar na base de dados. */
    if (definitionsToUnlock.length === 0) {
      return;
    }

    /** Carrega da BD apenas as conquistas que ficaram elegíveis. */
    const achievements = await this.prisma.achievement.findMany({
      /** Usa slug porque o catálogo local e a BD são ligados por slug único. */
      where: {
        slug: { in: definitionsToUnlock.map((definition) => definition.slug) },
      },
    });

    /** Mapa slug -> Achievement para ligar definição local ao registo Prisma. */
    const achievementBySlug = new Map(
      achievements.map((achievement) => [achievement.slug, achievement]),
    );

    /** Percorre todas as definições elegíveis para permitir múltiplos unlocks no mesmo run. */
    for (const definition of definitionsToUnlock) {
      /** Obtém o registo Achievement correspondente ao slug da definição. */
      const achievement = achievementBySlug.get(definition.slug);

      /** Protecção defensiva: se o seed falhou, não tenta criar UserAchievement inválido. */
      if (!achievement) {
        this.logger.warn(`Achievement ${definition.slug} is missing from database`);
        continue;
      }

      /** Desbloqueia a conquista de forma idempotente e segura contra duplicados. */
      await this.unlockAchievement(userId, achievement, definition);
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
  private async unlockAchievement(
    userId: string,
    achievement: Achievement,
    definition: AchievementDefinition,
  ): Promise<void> {
    this.logger.log(`Unlocking achievement ${achievement.slug} for user ${userId}`);

    /** Executa o unlock numa transação interactiva para só dar XP se houve insert real. */
    const created = await this.prisma.$transaction(async (tx) => {
      /** Cria UserAchievement respeitando @@unique([userId, achievementId]). */
      const result = await tx.userAchievement.createMany({
        /** skipDuplicates transforma corrida concorrente em operação idempotente. */
        skipDuplicates: true,
        /** Dados da relação entre User e Achievement. */
        data: {
          /** User interno que recebeu a conquista. */
          userId,
          /** Achievement da tabela seeded a partir das constantes. */
          achievementId: achievement.id,
        },
      });

      /** Se count é 0, a unique constraint já existia e nenhum XP deve ser somado. */
      if (result.count === 0) {
        return false;
      }

      /** Incrementa o XP local apenas quando a conquista foi criada agora. */
      await tx.user.update({
        /** Actualiza o mesmo User que recebeu o UserAchievement. */
        where: { id: userId },
        /** Usa incremento atómico do Prisma para evitar perder XP em concorrência. */
        data: { xp: { increment: achievement.xpReward } },
      });

      /** Indica ao código fora da transação que a notificação deve ser enviada. */
      return true;
    });

    /** Se não criou nada, a conquista já existia e não há notificação duplicada. */
    if (!created) {
      this.logger.debug(`Achievement ${achievement.slug} already unlocked for ${userId}`);
      return;
    }

    /** Cria notificação fora da transação porque falha de notificação não deve reverter XP. */
    await this.notificationsService.notifyAchievementUnlocked(
      /** Utilizador que acabou de desbloquear a conquista. */
      userId,
      /** Título vindo da definição local para manter texto alinhado ao catálogo. */
      definition.title,
      /** XP real guardado no Achievement da BD. */
      achievement.xpReward,
    );
  }

  /**
   * Calcula as estatísticas actuais do utilizador para avaliação de conquistas.
   * @param userId ID do utilizador
   */
  private async calculateUserStats(userId: string): Promise<UserStats> {
    /** Executa query do User e contagem de ajudas em paralelo para reduzir latência. */
    const [user, completedProjects, helpOffersCount] = await Promise.all([
      /** Busca apenas campos do User usados pelo motor de conquistas. */
      this.prisma.user.findUnique({
        /** Usa o ID interno da aplicação. */
        where: { id: userId },
        /** Selecciona só métricas necessárias para evitar payload desnecessário. */
        select: {
          /** Nível sincronizado da API 42. */
          level: true,
          /** Pontos de avaliação sincronizados da API 42. */
          evalPoints: true,
        },
      }),
      /** Conta UserProject concluídos sem carregar todos os registos. */
      this.prisma.userProject.count({
        /** Filtra pelo User interno e pelo enum FINISHED do Prisma. */
        where: {
          /** Relação UserProject pertence ao utilizador avaliado. */
          userId,
          /** Apenas projectos realmente concluídos contam para FIRST_PROJECT/TEN_PROJECTS. */
          status: ProjectStatus.FINISHED,
        },
      }),
      /** Conta ofertas de ajuda dadas pelo utilizador para HELPER/MASTER_HELPER. */
      this.prisma.projectHelpOffer.count({
        /** helperId aponta para User.id de quem ofereceu ajuda. */
        where: { helperId: userId },
      }),
    ]);

    /** Se o User não existe, devolve stats neutras e evita erro em chamadas assíncronas antigas. */
    if (!user) {
      return {
        /** Nenhum projecto concluído porque o utilizador não existe. */
        completedProjects: 0,
        /** Sem User, nível efectivo é zero. */
        level: 0,
        /** Sem User, evaluation points são zero. */
        evalPoints: 0,
        /** Sem User, ofertas de ajuda são zero. */
        helpOffersGiven: 0,
      };
    }

    /** Devolve stats normalizadas para as funções check() das definições. */
    return {
      /** Contagem Prisma de UserProject com status FINISHED. */
      completedProjects,
      /** Nível actual persistido após sync da API 42. */
      level: user.level,
      /** Pontos de avaliação persistidos após sync da API 42. */
      evalPoints: user.evalPoints,
      /** Contagem Prisma de ProjectHelpOffer criados pelo utilizador. */
      helpOffersGiven: helpOffersCount,
    };
  }

  /**
   * Garante que todas as conquistas do catálogo existem na base de dados.
   * Executa o upsert apenas para conquistas em falta (não recria as existentes).
   * Chamado automaticamente pelo checkAchievements().
   */
  private async seedAchievementsIfNeeded(): Promise<void> {
    /** Executa os upserts em paralelo porque cada slug é independente e único. */
    await Promise.all(
      ACHIEVEMENT_DEFINITIONS.map((def) =>
        /** Upsert mantém a tabela Achievement alinhada com o ficheiro constants. */
        this.prisma.achievement.upsert({
          /** slug é único no schema Prisma e liga código local ao registo da BD. */
          where: { slug: def.slug },
          /** Dados usados quando a conquista ainda não existe. */
          create: {
            slug: def.slug,
            title: def.title,
            description: def.description,
            icon: def.icon,
            xpReward: def.xpReward,
          },
          /** Dados usados quando a conquista já existe. */
          update: {
            /** Mantém título sincronizado com constants. */
            title: def.title,
            /** Mantém descrição sincronizada com constants. */
            description: def.description,
            /** Mantém ícone sincronizado com constants. */
            icon: def.icon,
            /** Mantém recompensa XP sincronizada com constants. */
            xpReward: def.xpReward,
          },
        }),
      ),
    );
  }
}
