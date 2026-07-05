import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import {
  FortyTwoProfile,
  FortyTwoCoalition,
  MappedFortyTwoProfile,
  MappedProject,
  FortyTwoCursusUser,
  FortyTwoProjectUser,
} from './fortytwo.interfaces';

/**
 * Serviço responsável por toda a comunicação com a API v2 da 42.
 * Encapsula as chamadas HTTP, trata erros e mapeia as respostas
 * para DTOs internos utilizados pelo resto da aplicação.
 */
@Injectable()
export class FortyTwoService {
  /** Logger específico para este serviço */
  private readonly logger = new Logger(FortyTwoService.name);

  /** URL base da API v2 da intranet 42 */
  private readonly BASE_URL = 'https://api.intra.42.fr/v2';

  /** ID do cursus principal da 42 (42cursus = 21) */
  private readonly MAIN_CURSUS_ID = 21;

  // ─────────────────────────────────────────────────────────
  // MÉTODOS PÚBLICOS
  // ─────────────────────────────────────────────────────────

  /**
   * Busca o perfil completo do utilizador autenticado
   * através do endpoint /v2/me e mapeia para DTO interno.
   * @param accessToken Token OAuth2 da sessão 42
   * @returns Perfil mapeado com dados consolidados
   */
  async getMe(accessToken: string): Promise<MappedFortyTwoProfile> {
    this.logger.log('Fetching /v2/me from 42 API');

    // Busca o perfil completo — inclui campus, cursus_users e projects_users
    const profile = await this.fetchFromApi<FortyTwoProfile>('/me', accessToken);

    // Mapeia o perfil bruto da API para o DTO interno
    return this.mapProfile(profile, await this.getCoalition(profile, accessToken));
  }

  /**
   * Busca a coligação do utilizador.
   * Retorna null se o utilizador não tiver coligação.
   * @param profile Perfil bruto da 42, usado para escolher o cursus principal
   * @param accessToken Token OAuth2
   */
  async getCoalition(
    profile: FortyTwoProfile,
    accessToken: string,
  ): Promise<FortyTwoCoalition | null> {
    try {
      /** Endpoint oficial da API 42 para obter as coalitions de um utilizador. */
      const coalitions = await this.fetchFromApi<FortyTwoCoalition[]>(
        `/users/${profile.id}/coalitions`,
        accessToken,
      );

      /** Sem dados da API significa que este utilizador ainda não tem coalition. */
      if (coalitions.length === 0) {
        return null;
      }

      /** Preferimos a coalition do cursus principal para não gravar dados de piscine. */
      const mainCursus =
        profile.cursus_users.find((c) => c.cursus_id === this.MAIN_CURSUS_ID) ??
        profile.cursus_users[0] ??
        null;

      /** Se a API enviar cursus_id, escolhemos a coalition correspondente ao cursus usado no sync. */
      const coalitionForMainCursus = coalitions.find(
        (coalition) =>
          coalition.cursus_id !== undefined &&
          coalition.cursus_id === mainCursus?.cursus_id,
      );

      /** Fallback seguro: a API antiga pode não enviar cursus_id neste endpoint. */
      return coalitionForMainCursus ?? coalitions[0];
    } catch (error) {
      /** Erros de autenticação não devem ser mascarados como "sem coalition". */
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      /** Utilizador sem coalition, ou endpoint sem dados, não bloqueia o login/sync. */
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`No coalition found for user ${profile.id}: ${message}`);
      return null;
    }
  }

  // ─────────────────────────────────────────────────────────
  // MÉTODOS PRIVADOS — MAPPERS
  // ─────────────────────────────────────────────────────────

  /**
   * Mapeia o perfil bruto da API 42 para o DTO interno MappedFortyTwoProfile.
   * Extrai os dados relevantes do cursus principal e lista de projetos.
   * @param profile Perfil bruto vindo da API
   * @param coalition Coligação do utilizador (pode ser null)
   */
  private mapProfile(
    profile: FortyTwoProfile,
    coalition: FortyTwoCoalition | null,
  ): MappedFortyTwoProfile {
    // Encontra o cursus principal (42cursus). Se não existir, usa o primeiro disponível
    const mainCursus =
      profile.cursus_users.find((c) => c.cursus_id === this.MAIN_CURSUS_ID) ??
      profile.cursus_users[0] ??
      null;

    // Extrai o campus primário do utilizador
    const primaryCampus = this.extractPrimaryCampus(profile);

    /** Normaliza coalition para um texto estável e seguro para guardar no User. */
    const coalitionName = coalition?.name ?? coalition?.slug ?? null;

    // Mapeia apenas projetos do cursus usado para nível/XP, evitando misturar piscine.
    const projects = this.mapProjects(profile.projects_users, mainCursus?.cursus_id);

    return {
      fortyTwoId: profile.id,
      login: profile.login,
      email: profile.email,
      displayName: profile.displayname || profile.usual_full_name,
      avatar: profile.image?.link ?? null,
      campus: primaryCampus,
      coalition: coalitionName,
      level: mainCursus?.level ?? 0,
      evalPoints: profile.correction_point ?? 0,
      projects,
      kind: profile.kind,
      cursusUsers: profile.cursus_users.map((cu) => ({
        slug: cu.cursus.slug,
        end_at: cu.end_at,
      })),
    };
  }

  /**
   * Extrai o nome do campus primário do utilizador.
   * Utiliza o campo campus_users para determinar qual é o principal.
   * @param profile Perfil bruto da API
   */
  private extractPrimaryCampus(profile: FortyTwoProfile): string | null {
    // Tenta encontrar o campus marcado como primário
    const primaryCampusUser = profile.campus_users?.find((cu) => cu.is_primary);

    if (primaryCampusUser) {
      const campus = profile.campus?.find((c) => c.id === primaryCampusUser.campus_id);
      return campus?.name ?? null;
    }

    // Fallback: primeiro campus da lista
    return profile.campus?.[0]?.name ?? null;
  }

  /**
   * Mapeia a lista de projetos da API 42 para MappedProject[].
   * Converte o status da API para o formato interno e filtra projetos relevantes.
   * @param projectsUsers Lista de projetos do utilizador
   */
  private mapProjects(
    projectsUsers: FortyTwoProjectUser[],
    cursusId?: number,
  ): MappedProject[] {
    /** Filtra apenas projetos com slug válido para ignorar entradas internas da 42. */
    return projectsUsers
      .filter(
        (pu) =>
          pu.project?.slug &&
          /** Quando há cursus conhecido, sincronizamos só projectos desse cursus. */
          (cursusId === undefined || pu.cursus_ids.includes(cursusId)),
      )
      .map((pu) => ({
        /** Slug estável da API 42 usado como chave única no Prisma Project. */
        slug: pu.project.slug,
        /** Nome legível vindo da API 42 para manter o catálogo local actualizado. */
        name: pu.project.name,
        /** Status normalizado para o enum Prisma ProjectStatus. */
        status: this.mapProjectStatus(pu.status),
        /** Nota final da API 42, preservada sem inferir falha automaticamente. */
        finalMark: pu.final_mark ?? null,
        /** Data de marcação da API 42, usada como validatedAt local quando existe. */
        validatedAt: pu.marked_at ? new Date(pu.marked_at) : null,
      }));
  }

  /**
   * Converte o status de projeto da API 42 para o enum interno ProjectStatus.
   * @param apiStatus Status vindo da API ('finished', 'in_progress', etc.)
   * FAILED só é retornado quando a API 42 envia uma falha explícita.
   */
  private mapProjectStatus(apiStatus: string): MappedProject['status'] {
    /** Normaliza o texto da API 42 para evitar falhas por capitalização inesperada. */
    const normalizedStatus = apiStatus.toLowerCase();

    /** Mapa explícito entre estados da API 42 e enum Prisma ProjectStatus. */
    const statusMap: Record<string, MappedProject['status']> = {
      /** Projecto terminado na 42 deve ficar FINISHED, independentemente de `validated`. */
      finished: 'FINISHED',
      /** Projecto em progresso na 42 fica em progresso no Prisma. */
      in_progress: 'IN_PROGRESS',
      /** Criação de grupo ainda é progresso operacional, não falha. */
      creating_group: 'IN_PROGRESS',
      /** Variante comum enviada pela API para criação do projecto/grupo. */
      creating: 'IN_PROGRESS',
      /** Procura de grupo indica que o utilizador ainda está no fluxo do projecto. */
      searching_a_group: 'IN_PROGRESS',
      /** Espera por avaliação ainda não é falha. */
      waiting_for_avaluation: 'IN_PROGRESS',
      /** Apenas falha explícita da API vira FAILED. */
      failed: 'FAILED',
      /** Outra variante explícita de falha fica FAILED. */
      fail: 'FAILED',
    };

    /** Fallback seguro: estado desconhecido nunca deve virar FAILED por inferência. */
    return statusMap[normalizedStatus] ?? 'NOT_STARTED';
  }

  // ─────────────────────────────────────────────────────────
  // UTILITÁRIOS HTTP
  // ─────────────────────────────────────────────────────────

  /**
   * Método genérico para fazer pedidos autenticados à API 42.
   * Trata erros HTTP e lança exceções adequadas.
   * @param path Caminho do endpoint (ex: '/me', '/users/123/coalitions')
   * @param accessToken Token OAuth2
   * @returns Dados tipados da resposta
   */
  private async fetchFromApi<T>(path: string, accessToken: string): Promise<T> {
    const url = `${this.BASE_URL}${path}`;

    this.logger.debug(`GET ${url}`);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    // Trata resposta não autorizada (token expirado ou inválido)
    if (response.status === 401) {
      this.logger.error(`Unauthorized request to 42 API: ${url}`);
      throw new UnauthorizedException('42 API token is invalid or expired');
    }

    // Trata outros erros HTTP
    if (!response.ok) {
      const error = `42 API error: ${response.status} ${response.statusText} for ${url}`;
      this.logger.error(error);
      throw new Error(error);
    }

    return response.json() as Promise<T>;
  }
}
