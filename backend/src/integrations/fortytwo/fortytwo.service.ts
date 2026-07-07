import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import {
  FortyTwoProfile,
  FortyTwoCoalition,
  MappedFortyTwoProfile,
  MappedProject,
  FortyTwoProjectUser,
} from './fortytwo.interfaces';

@Injectable()
export class FortyTwoService {
  private readonly logger = new Logger(FortyTwoService.name);

  private readonly BASE_URL = 'https://api.intra.42.fr/v2';

  /** ID do cursus principal da 42 (42cursus = 21) */
  private readonly MAIN_CURSUS_ID = 21;

  async getMe(accessToken: string): Promise<MappedFortyTwoProfile> {
    this.logger.log('Fetching /v2/me from 42 API');

    const profile = await this.fetchFromApi<FortyTwoProfile>('/me', accessToken);

    return this.mapProfile(profile, await this.getCoalition(profile, accessToken));
  }

  async getCoalition(
    profile: FortyTwoProfile,
    accessToken: string,
  ): Promise<FortyTwoCoalition | null> {
    try {
      const coalitions = await this.fetchFromApi<FortyTwoCoalition[]>(
        `/users/${profile.id}/coalitions`,
        accessToken,
      );

      if (coalitions.length === 0) {
        return null;
      }

      /** Preferimos a coalition do cursus principal para não gravar dados de piscine. */
      const mainCursus =
        profile.cursus_users.find((c) => c.cursus_id === this.MAIN_CURSUS_ID) ??
        profile.cursus_users[0] ??
        null;

      const coalitionForMainCursus = coalitions.find(
        (coalition) =>
          coalition.cursus_id !== undefined &&
          coalition.cursus_id === mainCursus?.cursus_id,
      );

      /** Fallback: a API antiga pode não enviar cursus_id neste endpoint. */
      return coalitionForMainCursus ?? coalitions[0];
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      /** Utilizador sem coalition não bloqueia o login/sync. */
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`No coalition found for user ${profile.id}: ${message}`);
      return null;
    }
  }

  private mapProfile(
    profile: FortyTwoProfile,
    coalition: FortyTwoCoalition | null,
  ): MappedFortyTwoProfile {
    const mainCursus =
      profile.cursus_users.find((c) => c.cursus_id === this.MAIN_CURSUS_ID) ??
      profile.cursus_users[0] ??
      null;

    const primaryCampus = this.extractPrimaryCampus(profile);
    const coalitionName = coalition?.name ?? coalition?.slug ?? null;

    /** Apenas projectos do cursus usado para nível/XP — evita misturar piscine. */
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

  private extractPrimaryCampus(profile: FortyTwoProfile): string | null {
    const primaryCampusUser = profile.campus_users?.find((cu) => cu.is_primary);

    if (primaryCampusUser) {
      const campus = profile.campus?.find((c) => c.id === primaryCampusUser.campus_id);
      return campus?.name ?? null;
    }

    return profile.campus?.[0]?.name ?? null;
  }

  private mapProjects(
    projectsUsers: FortyTwoProjectUser[],
    cursusId?: number,
  ): MappedProject[] {
    return projectsUsers
      .filter(
        (pu) =>
          pu.project?.slug &&
          (cursusId === undefined || pu.cursus_ids.includes(cursusId)),
      )
      .map((pu) => ({
        slug: pu.project.slug,
        name: pu.project.name,
        status: this.mapProjectStatus(pu.status),
        finalMark: pu.final_mark ?? null,
        validatedAt: pu.marked_at ? new Date(pu.marked_at) : null,
      }));
  }

  /**
   * FAILED só é retornado quando a API 42 envia uma falha explícita.
   * Estado desconhecido nunca vira FAILED por inferência.
   */
  private mapProjectStatus(apiStatus: string): MappedProject['status'] {
    const normalizedStatus = apiStatus.toLowerCase();

    const statusMap: Record<string, MappedProject['status']> = {
      finished: 'FINISHED',
      in_progress: 'IN_PROGRESS',
      creating_group: 'IN_PROGRESS',
      creating: 'IN_PROGRESS',
      searching_a_group: 'IN_PROGRESS',
      waiting_for_avaluation: 'IN_PROGRESS',
      failed: 'FAILED',
      fail: 'FAILED',
    };

    return statusMap[normalizedStatus] ?? 'NOT_STARTED';
  }

  private async fetchFromApi<T>(path: string, accessToken: string): Promise<T> {
    const url = `${this.BASE_URL}${path}`;

    this.logger.debug(`GET ${url}`);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (response.status === 401) {
      this.logger.error(`Unauthorized request to 42 API: ${url}`);
      throw new UnauthorizedException('42 API token is invalid or expired');
    }

    if (!response.ok) {
      const error = `42 API error: ${response.status} ${response.statusText} for ${url}`;
      this.logger.error(error);
      throw new Error(error);
    }

    return response.json() as Promise<T>;
  }
}
