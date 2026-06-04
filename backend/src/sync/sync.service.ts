import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FortyTwoService } from '../integrations/fortytwo/fortytwo.service';
import { AchievementsService } from '../achievements/achievements.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MappedFortyTwoProfile, MappedProject } from '../integrations/fortytwo/fortytwo.interfaces';
import { ProjectStatus } from '@prisma/client';

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
    tx: any,
    userId: string,
    profile: MappedFortyTwoProfile,
  ): Promise<void> {
    await tx.user.update({
      where: { id: userId },
      data: {
        // Atualiza dados sincronizados da API 42
        displayName: profile.displayName,
        avatar: profile.avatar,
        campus: profile.campus,
        level: profile.level,
        evalPoints: profile.evalPoints,
        // XP calculado com base no nível: aproximação do sistema da 42
        // Fórmula: xp ≈ level * 1000 (simplificado)
        xp: Math.round(profile.level * 1000),
        // Regista o timestamp do último sync bem-sucedido
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
    tx: any,
    userId: string,
    projects: MappedProject[],
  ): Promise<void> {
    for (const proj of projects) {
      // 1. Garante que o projeto existe no catálogo global
      // Se não existir, cria; se existir, atualiza o nome
      const project = await tx.project.upsert({
        where: { slug: proj.slug },
        create: {
          name: proj.name,
          slug: proj.slug,
        },
        update: {
          name: proj.name,
        },
      });

      // 2. Converte o status string para o enum Prisma
      const status = proj.status as ProjectStatus;

      // 3. Cria ou atualiza o estado deste projeto para o utilizador
      await tx.userProject.upsert({
        where: {
          // Chave composta única: combinação de userId + projectId
          userId_projectId: {
            userId,
            projectId: project.id,
          },
        },
        create: {
          userId,
          projectId: project.id,
          status,
          finalMark: proj.finalMark,
          validatedAt: proj.validatedAt,
        },
        update: {
          // Atualiza apenas se o estado for mais recente/avançado
          status,
          finalMark: proj.finalMark,
          validatedAt: proj.validatedAt,
        },
      });
    }

    this.logger.debug(`Synced ${projects.length} projects for user ${userId}`);
  }
}