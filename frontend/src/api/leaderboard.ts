import { apiFetch } from './apiClient'
import { API_BASE_URL } from '../config/api'

export type LeaderboardKind = 'xp' | 'level' | 'achievements'

export interface LeaderboardEntry {
  id: string
  login: string
  displayName: string
  avatar: string | null
  campus: string | null
  coalition: string | null
  level: number
  xp: number
  position: number
  achievementCount?: number
}

export interface LeaderboardPage {
  data: LeaderboardEntry[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
    currentUserPosition: number
  }
}

export async function fetchLeaderboard(
  kind: LeaderboardKind,
  page = 1,
): Promise<LeaderboardPage> {
  const response = await apiFetch(
    `${API_BASE_URL}/leaderboard/${kind}?page=${page}&limit=20`,
  )
  if (!response.ok) throw new Error('Failed to fetch leaderboard')
  return response.json()
}
