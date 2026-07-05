import { apiFetch } from './apiClient'
import { API_BASE_URL } from '../config/api'

export interface CharacterLayers {
  skin: string
  eyes: string
  hair: string
  clothes: string
  accessory: string
}

export async function saveCharacter(layers: CharacterLayers): Promise<void> {
  const response = await apiFetch(`${API_BASE_URL}/users/me`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ characterLayers: layers }),
  })
  if (!response.ok) {
    const data = await response.json()
    throw new Error(data.message ?? 'Failed to save character')
  }
}

export async function fetchMe(): Promise<{
  id: string
  login: string
  displayName: string
  avatar: string | null
  campus: string | null
  coalition: string | null
  level: number
  xp: number
  evalPoints: number
  role: string
  bio: string | null
  characterCreated: boolean
  characterLayers: CharacterLayers | null
  unreadNotifications: number
  achievements?: {
    id: string
    unlockedAt: string
    achievement: {
      title: string
      description: string
      icon: string | null
      xpReward: number
    }
  }[]
}> {
  const response = await apiFetch(`${API_BASE_URL}/users/me`)
  if (!response.ok) throw new Error('Failed to fetch user')
  return response.json()
}

export async function saveProfile(data: {
  displayName?: string
  avatar?: string
  bio?: string
}): Promise<void> {
  const response = await apiFetch(`${API_BASE_URL}/users/me`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const json = await response.json()
    throw new Error(json.message ?? 'Failed to save profile')
  }
}
