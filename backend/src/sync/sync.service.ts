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
    this.logger.log(`Starting sync for user ${userId}`);

    // Verifica se o utilizador existe antes de sincronizar
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    // Busca todos os dados do utilizador na API 42 de uma vez
    const profile = await this.fortyTwoService.getMe(accessToken);

    this.logger.log(`Syncing profile for login: ${profile.login}`);

    // Executa a sincronização numa transação para garantir consistência
    await this.prisma.$transaction(async (tx) => {
      // 1. Atualiza dados do utilizador com as informações mais recentes da 42
      await this.updateUserData(tx, userId, profile);

      // 2. Sincroniza todos os projetos do utilizador
      await this.syncProjects(tx, userId, profile.projects);
    });

    // 3. Verifica conquistas APÓS a transação (não bloqueia o sync se falhar)
    try {
      await this.achievementsService.checkAchievements(userId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Achievement check failed for user ${userId}: ${message}`);
    }

    this.logger.log(`Sync completed for user ${userId}`);
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
        /** Nível real do cursus principal da 42. */
        level: profile.level,
        /** Pontos de avaliação usados pela conquista EVALUATOR. */
        evalPoints: profile.evalPoints,
        /** XP local aproximado a partir do nível da 42. */
        xp: Math.round(profile.level * 1000),
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
}
