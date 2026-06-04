/**
 * Interface que define a estrutura de uma conquista.
 * Usada para popular a base de dados e verificar critérios.
 */
export interface AchievementDefinition {
  /** Identificador único da conquista (usado como slug na BD) */
  slug: string;
  /** Título legível da conquista */
  title: string;
  /** Descrição do que é necessário para desbloquear */
  description: string;
  /** Emoji ou URL do ícone */
  icon: string;
  /** XP atribuído ao desbloquear */
  xpReward: number;
  /** Função que avalia se o utilizador desbloqueou esta conquista */
  check: (stats: UserStats) => boolean;
}

/**
 * Estatísticas do utilizador usadas para avaliar conquistas.
 * Calculadas pelo AchievementsService a partir da base de dados.
 */
export interface UserStats {
  /** Número de projectos com status FINISHED */
  completedProjects: number;
  /** Nível actual do utilizador */
  level: number;
  /** Pontos de avaliação acumulados */
  evalPoints: number;
  /** Número de vezes que ajudou outros utilizadores */
  helpOffersGiven: number;
}

/**
 * Catálogo de todas as conquistas disponíveis na plataforma.
 * Cada entrada define os critérios de desbloqueio e a recompensa em XP.
 *
 * Para adicionar novas conquistas, basta adicionar entradas a esta lista.
 * O AchievementsService percorre este catálogo automaticamente.
 */
export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  // ─── PROJECTOS ────────────────────────────────────────
  {
    slug: 'FIRST_PROJECT',
    title: 'First Blood',
    description: 'Concluir o primeiro projecto na 42',
    icon: '⚔️',
    xpReward: 100,
    check: (s) => s.completedProjects >= 1,
  },
  {
    slug: 'TEN_PROJECTS',
    title: 'Dez Projectos',
    description: 'Concluir 10 projectos',
    icon: '🔟',
    xpReward: 500,
    check: (s) => s.completedProjects >= 10,
  },
  {
    slug: 'TWENTY_PROJECTS',
    title: 'Vinte Projectos',
    description: 'Concluir 20 projectos',
    icon: '🏆',
    xpReward: 1000,
    check: (s) => s.completedProjects >= 20,
  },

  // ─── NÍVEIS ────────────────────────────────────────
  {
    slug: 'LEVEL_5',
    title: 'Nível 5',
    description: 'Alcançar o nível 5 na 42',
    icon: '⭐',
    xpReward: 200,
    check: (s) => s.level >= 5,
  },
  {
    slug: 'LEVEL_10',
    title: 'Nível 10',
    description: 'Alcançar o nível 10 na 42',
    icon: '🌟',
    xpReward: 500,
    check: (s) => s.level >= 10,
  },
  {
    slug: 'LEVEL_20',
    title: 'Mestre da 42',
    description: 'Alcançar o nível 20 na 42',
    icon: '💫',
    xpReward: 2000,
    check: (s) => s.level >= 20,
  },

  // ─── AVALIAÇÕES ─────────────────────────────────────
  {
    slug: 'EVALUATOR',
    title: 'Avaliador',
    description: 'Acumular 50 pontos de avaliação',
    icon: '📋',
    xpReward: 300,
    check: (s) => s.evalPoints >= 50,
  },

  // ─── AJUDA ──────────────────────────────────────────
  {
    slug: 'HELPER',
    title: 'Bom Samaritano',
    description: 'Ajudar 10 estudantes',
    icon: '🤝',
    xpReward: 250,
    check: (s) => s.helpOffersGiven >= 10,
  },
  {
    slug: 'MASTER_HELPER',
    title: 'Mestre da Ajuda',
    description: 'Ajudar 50 estudantes',
    icon: '🦸',
    xpReward: 1000,
    check: (s) => s.helpOffersGiven >= 50,
  },
];