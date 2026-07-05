import { apiFetch } from './apiClient'
import { API_BASE_URL } from '../config/api'

export type NotificationType =
  | 'FRIEND_REQUEST'
  | 'FRIEND_ACCEPTED'
  | 'HELP_REQUEST'
  | 'PROJECT_UPDATE'
  | 'ACHIEVEMENT_UNLOCKED'
  | 'NEW_MESSAGE'
  | 'PROJECT_INVITE'
  | 'SYSTEM'

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string | null
  /** Payload accionável (ex.: friendshipId em FRIEND_REQUEST). */
  data: { friendshipId?: string } | null
  isRead: boolean
  createdAt: string
}

export interface NotificationsPage {
  data: Notification[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
    unreadCount: number
  }
}

export async function fetchNotifications(
  page = 1,
  unread = false,
): Promise<NotificationsPage> {
  const params = new URLSearchParams({ page: String(page) })
  if (unread) params.set('unread', 'true')
  const response = await apiFetch(`${API_BASE_URL}/notifications?${params}`)
  if (!response.ok) throw new Error('Failed to fetch notifications')
  return response.json()
}

export async function markNotificationRead(id: string): Promise<void> {
  const response = await apiFetch(`${API_BASE_URL}/notifications/${id}/read`, {
    method: 'PATCH',
  })
  if (!response.ok) throw new Error('Failed to mark notification as read')
}

export async function markAllNotificationsRead(): Promise<void> {
  const response = await apiFetch(`${API_BASE_URL}/notifications/read-all`, {
    method: 'PATCH',
  })
  if (!response.ok) throw new Error('Failed to mark notifications as read')
}
