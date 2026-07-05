import { apiFetch } from './apiClient'
import { API_BASE_URL } from '../config/api'

/** Perfil público; `limited: true` quando há bloqueio entre os utilizadores. */
export interface PublicProfile {
  id: string
  login: string
  displayName: string
  avatar: string | null
  bio?: string | null
  campus?: string | null
  coalition?: string | null
  level?: number
  xp?: number
  limited?: boolean
}

export async function fetchPublicProfile(id: string): Promise<PublicProfile> {
  const response = await apiFetch(
    `${API_BASE_URL}/users/${encodeURIComponent(id)}`,
  )
  if (!response.ok) throw new Error('Failed to fetch profile')
  return response.json()
}

export interface UserSearchResult {
  id: string
  login: string
  displayName: string
  avatar: string | null
  campus: string | null
  coalition: string | null
  level: number
  xp: number
  lastSeenAt: string | null
}

export interface UserSearchPage {
  data: UserSearchResult[]
  meta: { total: number; page: number; limit: number; totalPages: number }
}

export async function searchUsers(
  login = '',
  page = 1,
): Promise<UserSearchPage> {
  const params = new URLSearchParams({ page: String(page), limit: '20' })
  if (login) params.set('login', login)
  const response = await apiFetch(`${API_BASE_URL}/users?${params}`)
  if (!response.ok) throw new Error('Failed to search users')
  return response.json()
}
