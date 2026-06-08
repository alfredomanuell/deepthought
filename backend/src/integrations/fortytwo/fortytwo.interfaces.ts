/**
 * Interfaces que representam as respostas da API v2 da 42.
 * Usadas para tipar corretamente os dados recebidos antes de os mapear
 * para os modelos internos da aplicação.
 */

/** Representa um campus na resposta da API 42 */
export interface FortyTwoCampus {
  id: number;
  name: string;
  country: string;
}

/** Representa a imagem de perfil do utilizador na API 42 */
export interface FortyTwoImage {
  link: string;
  versions: {
    large: string;
    medium: string;
    small: string;
    micro: string;
  };
}

/** Representa o cursus (42cursus, piscine, etc.) associado ao utilizador */
export interface FortyTwoCursusUser {
  id: number;
  grade: string | null;
  level: number;
  skills: Array<{ id: number; name: string; level: number }>;
  blackholed_at: string | null;
  begin_at: string;
  end_at: string | null;
  cursus_id: number;
  has_coalition: boolean;
  cursus: {
    id: number;
    created_at: string;
    name: string;
    slug: string;
  };
}

/** Representa um projeto associado ao utilizador na API 42 */
export interface FortyTwoProjectUser {
  id: number;
  occurrence: number;
  final_mark: number | null;
  status: string; // 'finished' | 'in_progress' | 'searching_a_group' | 'creating_group' | 'waiting_for_correction' | 'failed'
  validated: boolean | null;
  current_team_id: number | null;
  project: {
    id: number;
    name: string;
    slug: string;
    parent_id: number | null;
  };
  cursus_ids: number[];
  marked_at: string | null;
  marked: boolean;
  retriable_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Representa a coligação do utilizador */
export interface FortyTwoCoalition {
  id: number;
  name: string;
  slug: string;
  image_url: string;
  cover_url: string;
  color: string;
  score: number;
  user_id: number;
}

/** Resposta completa do endpoint /v2/me da API 42 */
export interface FortyTwoProfile {
  id: number;
  email: string;
  login: string;
  first_name: string;
  last_name: string;
  usual_full_name: string;
  displayname: string;
  kind: string;
  image: FortyTwoImage;
  cursus_users: FortyTwoCursusUser[];
  projects_users: FortyTwoProjectUser[];
  campus: FortyTwoCampus[];
  campus_users: Array<{ id: number; user_id: number; campus_id: number; is_primary: boolean }>;
  correction_point: number;
  wallet: number;
  pool_month: string | null;
  pool_year: string | null;
  location: string | null;
  active: boolean;
  alumni: boolean;
  created_at: string;
  updated_at: string;
}

/** DTO interno mapeado da API 42 para uso nos serviços */
export interface MappedFortyTwoProfile {
  fortyTwoId: number;
  login: string;
  email: string;
  displayName: string;
  avatar: string | null;
  campus: string | null;
  level: number;
  evalPoints: number;
  projects: MappedProject[];
}

/** Projeto mapeado da API 42 */
export interface MappedProject {
  slug: string;
  name: string;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'FINISHED' | 'FAILED';
  finalMark: number | null;
  validatedAt: Date | null;
}
