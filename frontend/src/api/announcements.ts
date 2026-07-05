import { apiFetch } from './apiClient'
import { API_BASE_URL } from '../config/api'

export interface Announcement {
  id: string
  title: string
  body: string
  pinned: boolean
  createdAt: string
  author: { id: string; login: string; displayName: string }
  isRead: boolean
}

export async function fetchAnnouncements(): Promise<Announcement[]> {
  const response = await apiFetch(`${API_BASE_URL}/announcements`)
  if (!response.ok) throw new Error('Failed to fetch announcements')
  return response.json()
}

export async function markAnnouncementRead(id: string): Promise<void> {
  const response = await apiFetch(
    `${API_BASE_URL}/announcements/${encodeURIComponent(id)}/read`,
    { method: 'PATCH' },
  )
  if (!response.ok) throw new Error('Failed to mark announcement as read')
}

export async function createAnnouncement(payload: {
  title: string
  body: string
  pinned?: boolean
}): Promise<Announcement> {
  const response = await apiFetch(`${API_BASE_URL}/announcements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error((err as any).message ?? 'Failed to create announcement')
  }
  return response.json()
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const response = await apiFetch(`${API_BASE_URL}/announcements/${id}`, { method: 'DELETE' })
  if (!response.ok) throw new Error('Failed to delete announcement')
}
