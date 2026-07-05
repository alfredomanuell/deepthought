import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FortyTwoService } from '../integrations/fortytwo/fortytwo.service';
import { AchievementsService } from '../achievements/achievements.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  MappedFortyTwoProfile,
  MappedProject,
} from '../integrations/fortytwo/fortytwo.interfaces';
import { Prisma, ProjectStatus } from '@prisma/client';

/**
 * Serviço responsável pela sincronização completa de dados
 * entre a API 42 e a base de dados local.
 *
 * Fluxo de sincronização:
 * 1. Busca perfil completo na API 42
 * 2. Atualiza dados do utilizador (nível, xp, campus, coligação)
 * 3. Faz upsert de todos os projetos
 * 4. Verifica e desbloqueia conquistas
 */
@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);
  /** Mapa em memória que evita duas sincronizações simultâneas para o mesmo User. */
  private readonly inFlightSyncs = new Map<string, Promise<void>>();

  constructor(
    /** Serviço de acesso à base de dados via Prisma */
    private readonly prisma: PrismaService,
    /** Serviço de comunicação com a API 42 */
    private readonly fortyTwoService: FortyTwoService,
    /** Serviço de verificação e desbloqueio de conquistas */
    private readonly achievementsService: AchievementsService,
    /** Serviço de criação de notificações */
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Executa a sincronização completa do utilizador com a API 42.
   * Chamado manualmente via POST /sync/me ou automaticamente após login.
   * @param userId ID interno do utilizador
   * @param accessToken Token OAuth2 da sessão 42
   */
  async syncUser(userId: string, accessToken: string): Promise<void> {
    /** Serializa syncs do mesmo utilizador para evitar writes concorrentes e API duplicada. */
    return this.runExclusiveSync(userId, async () => {
      this.logger.log(`Starting sync for user ${userId}`);

      /** Confirma que o utilizador existe e guarda fortyTwoId para validar o token. */
      const user = await this.prisma.user.findUnique({
        /** Usa o ID interno vindo do JWT ou do AuthService. */
        where: { id: userId },
        /** Selecciona apenas o necessário para validar consistência. */
        select: { id: true, fortyTwoId: true },
      });

      if (!user) {
        throw new NotFoundException(`User ${userId} not found`);
      }

      /** Endpoint manual precisa carregar o perfil actual da API 42. */
      const profile = await this.fortyTwoService.getMe(accessToken);

      /** Evita sincronizar dados de outro aluno se o token 42 não corresponde ao User. */
      if (profile.fortyTwoId !== user.fortyTwoId) {
        throw new NotFoundException(`User ${userId} does not match 42 token`);
      }

      /** Aplica no Prisma o perfil já normalizado pelo FortyTwoService. */
      await this.persistMappedProfile(userId, profile);
    });
  }

  /**
   * Sincroniza usando um perfil da 42 já carregado pelo fluxo OAuth.
   *
   * Isto evita uma segunda chamada a /v2/me e /v2/users/:id/coalitions durante
   * o login, mantendo o sync automático sem duplicar requests para a API 42.
   */
  async syncFromProfile(
    userId: string,
    profile: MappedFortyTwoProfile,
  ): Promise<void> {
    /** Usa o mesmo lock de syncUser para não correr em paralelo com POST /sync/me. */
    return this.runExclusiveSync(userId, async () => {
      this.logger.log(`Starting profile-based sync for user ${userId}`);

      /** Valida existência antes de escrever relações e projectos. */
      const user = await this.prisma.user.findUnique({
        /** O ID interno vem do user criado/encontrado no AuthService. */
        where: { id: userId },
        /** Verifica também a correspondência com a conta 42 mapeada. */
        select: { id: true, fortyTwoId: true },
      });

      if (!user) {
        throw new NotFoundException(`User ${userId} not found`);
      }

      /** Protecção contra gravar dados de uma conta 42 diferente no User local. */
      if (profile.fortyTwoId !== user.fortyTwoId) {
        throw new NotFoundException(`User ${userId} does not match 42 profile`);
      }

      /** Persiste exactamente os dados já extraídos no OAuth. */
      await this.persistMappedProfile(userId, profile);
    });
  }

  // ─────────────────────────────────────────────────────────
  // MÉTODOS PRIVADOS
  // ─────────────────────────────────────────────────────────

  /**
   * Atualiza os dados do utilizador na base de dados com o perfil da API 42.
   * Inclui: nível, xp, campus, coligação, eval points e timestamp de sync.
   * @param tx Transação Prisma ativa
   * @param userId ID interno do utilizador
   * @param profile Dados mapeados da API 42
   */
  private async updateUserData(
    tx: Prisma.TransactionClient,
    userId: string,
    profile: MappedFortyTwoProfile,
  ): Promise<void> {
    /**
     * O XP local é base (nível da 42 * 1000) + bónus das conquistas.
     * Recalcular a soma aqui evita que o sync apague o XP que o
     * AchievementsService atribuiu por incremento.
     */
    const unlocked = await tx.userAchievement.findMany({
      where: { userId },
      select: { achievement: { select: { xpReward: true } } },
    });
    const achievementXp = unlocked.reduce(
      (sum, ua) => sum + ua.achievement.xpReward,
      0,
    );

    /** Actualiza o User dentro da transação Prisma do sync. */
    await tx.user.update({
      /** Usa o ID interno da app, não o ID numérico da API 42. */
      where: { id: userId },
      /** Dados sincronizados a partir do perfil já mapeado da API 42. */
      data: {
        /** Nome público actualizado com o valor mais recente da 42. */
        displayName: profile.displayName,
        /** Avatar remoto da 42 guardado para uso no frontend. */
        avatar: profile.avatar,
        /** Campus primário extraído do payload da 42. */
        campus: profile.campus,
        /** Coalition obtida em /v2/users/:id/coalitions com fallback null. */
        coalition: profile.coalition,
        /** Nível real do cursus principal da 42. */
        level: profile.level,
        /** Pontos de avaliação usados pela conquista EVALUATOR. */
        evalPoints: profile.evalPoints,
        /** XP local: base aproximada do nível da 42 + bónus de conquistas. */
        xp: Math.round(profile.level * 1000) + achievementXp,
        /** Timestamp usado para saber quando o sync terminou com sucesso. */
        lastSyncAt: new Date(),
      },
    });
  }

  /**
   * Sincroniza a lista de projetos do utilizador.
   * Para cada projeto:
   * 1. Garante que o projeto existe no catálogo global (upsert)
   * 2. Cria ou atualiza o estado do projeto para este utilizador (upsert)
   * @param tx Transação Prisma ativa
   * @param userId ID interno do utilizador
   * @param projects Lista de projetos mapeados da API 42
   */
  private async syncProjects(
    tx: Prisma.TransactionClient,
    userId: string,
    projects: MappedProject[],
  ): Promise<void> {
    /** Percorre os projectos já normalizados pelo FortyTwoService. */
    for (const proj of projects) {
      /** Garante que o Project global existe com slug único vindo da API 42. */
      const project = await tx.project.upsert({
        /** O slug da 42 é a chave estável para não duplicar Project. */
        where: { slug: proj.slug },
        /** Cria o Project quando o catálogo local ainda não conhece este slug. */
        create: {
          /** Nome legível vindo da API 42. */
          name: proj.name,
          /** Slug usado para futuras sincronizações. */
          slug: proj.slug,
        },
        /** Actualiza o nome caso a 42 altere a designação do projecto. */
        update: {
          /** Mantém o catálogo local alinhado com a API 42. */
          name: proj.name,
        },
      });

      /** Status já validado pelo mapper contra os valores do enum Prisma. */
      const status: ProjectStatus = proj.status;

      /** Cria ou actualiza a relação UserProject sem duplicar userId/projectId. */
      await tx.userProject.upsert({
        /** Usa a constraint composta @@unique([userId, projectId]) do Prisma. */
        where: {
          /** Chave composta gerada pelo Prisma para a relação UserProject. */
          userId_projectId: {
            /** User interno que está a ser sincronizado. */
            userId,
            /** Project global encontrado/criado pelo upsert anterior. */
            projectId: project.id,
          },
        },
        /** Dados usados quando este utilizador ainda não tem o Project. */
        create: {
          /** Liga o UserProject ao User interno. */
          userId,
          /** Liga o UserProject ao Project global. */
          projectId: project.id,
          /** Estado normalizado da API 42. */
          status,
          /** Nota final vinda da API 42, se existir. */
          finalMark: proj.finalMark,
          /** Data de marcação/conclusão vinda da API 42, se existir. */
          validatedAt: proj.validatedAt,
        },
        /** Dados usados quando a relação UserProject já existe. */
        update: {
          /** Mantém o estado sincronizado com a API 42 sem inferir FAILED. */
          status,
          /** Actualiza a nota final quando a API 42 envia novo valor. */
          finalMark: proj.finalMark,
          /** Actualiza a data de validação quando a API 42 envia novo valor. */
          validatedAt: proj.validatedAt,
        },
      });
    }

    this.logger.debug(`Synced ${projects.length} projects for user ${userId}`);
  }

  /**
   * Persiste o perfil mapeado e dispara achievements depois de a transação fechar.
   *
   * Mantém o fluxo comum entre sync automático do login e sync manual.
   */
  private async persistMappedProfile(
    userId: string,
    profile: MappedFortyTwoProfile,
  ): Promise<void> {
    this.logger.log(`Syncing profile for login: ${profile.login}`);

    /** Transação garante que User e UserProject ficam consistentes entre si. */
    await this.prisma.$transaction(async (tx) => {
      /** Actualiza métricas e dados públicos do User. */
      await this.updateUserData(tx, userId, profile);

      /** Faz upsert do catálogo de Project e da relação UserProject. */
      await this.syncProjects(tx, userId, profile.projects);
    });

    /** Conquistas são verificadas depois para não reverter o sync se notificações falharem. */
    try {
      await this.achievementsService.checkAchievements(userId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Achievement check failed for user ${userId}: ${message}`);
    }

    this.logger.log(`Sync completed for user ${userId}`);
  }

  /**
   * Executa uma sincronização por utilizador de cada vez.
   *
   * Se outro sync do mesmo User já está activo, devolve a mesma Promise para
   * evitar chamadas paralelas à API da 42 e updates Prisma concorrentes.
   */
  private runExclusiveSync(
    userId: string,
    task: () => Promise<void>,
  ): Promise<void> {
    /** Reutiliza sync em progresso em vez de iniciar outro trabalho igual. */
    const existingSync = this.inFlightSyncs.get(userId);

    if (existingSync) {
      this.logger.debug(`Reusing in-flight sync for user ${userId}`);
      return existingSync;
    }

    /** Guarda a Promise imediatamente para bloquear chamadas concorrentes. */
    const syncPromise = task().finally(() => {
      /** Remove o lock quando termina, com sucesso ou erro. */
      this.inFlightSyncs.delete(userId);
    });

    /** Regista a sincronização activa para este User. */
    this.inFlightSyncs.set(userId, syncPromise);

    return syncPromise;
  }
}
