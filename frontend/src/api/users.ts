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
