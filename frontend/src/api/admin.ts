import { apiFetch } from './apiClient'
import { API_BASE_URL } from '../config/api'

export interface AdminUser {
  id: string
  login: string
  email: string
  displayName: string
  avatar: string | null
  campus: string | null
  coalition: string | null
  role: 'USER' | 'MODERATOR' | 'ADMIN'
  level: number
  xp: number
  isBanned: boolean
  bannedAt: string | null
  isEmailVerified: boolean
  lastSeenAt: string | null
  createdAt: string
  _count: { achievements: number; projects: number }
}

export interface AdminUsersPage {
  data: AdminUser[]
  meta: { total: number; page: number; limit: number; totalPages: number }
}

async function throwIfNotOk(response: Response, fallback: string) {
  if (response.ok) return
  const err = await response.json().catch(() => ({}))
  throw new Error((err as any).message ?? fallback)
}

export async function fetchAdminUsers(
  page = 1,
  login = '',
): Promise<AdminUsersPage> {
  const params = new URLSearchParams({ page: String(page), limit: '20' })
  if (login) params.set('login', login)
  const response = await apiFetch(`${API_BASE_URL}/admin/users?${params}`)
  await throwIfNotOk(response, 'Failed to fetch users')
  return response.json()
}

export async function banUser(id: string): Promise<void> {
  const response = await apiFetch(
    `${API_BASE_URL}/admin/users/${encodeURIComponent(id)}/ban`,
    { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{}' },
  )
  await throwIfNotOk(response, 'Failed to ban user')
}

export async function unbanUser(id: string): Promise<void> {
  const response = await apiFetch(
    `${API_BASE_URL}/admin/users/${encodeURIComponent(id)}/unban`,
    { method: 'PATCH' },
  )
  await throwIfNotOk(response, 'Failed to unban user')
}

export async function updateUserRole(
  id: string,
  role: AdminUser['role'],
): Promise<void> {
  const response = await apiFetch(
    `${API_BASE_URL}/admin/users/${encodeURIComponent(id)}/role`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    },
  )
  await throwIfNotOk(response, 'Failed to update role')
}

export async function deleteUser(id: string): Promise<void> {
  const response = await apiFetch(
    `${API_BASE_URL}/admin/users/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  )
  await throwIfNotOk(response, 'Failed to delete user')
}
