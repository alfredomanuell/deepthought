import { apiFetch } from './apiClient'
import { API_BASE_URL } from '../config/api'

export interface FriendUser {
  id: string
  login: string
  displayName: string
  avatar: string | null
  campus: string | null
  coalition: string | null
  level: number
  lastSeenAt: string | null
}

export interface FriendEntry {
  friendshipId: string
  since: string
  friend: FriendUser
}

export interface PendingEntry {
  friendshipId: string
  createdAt: string
  user: FriendUser
}

export interface PendingLists {
  incoming: PendingEntry[]
  outgoing: PendingEntry[]
}

async function throwIfNotOk(response: Response, fallback: string) {
  if (response.ok) return
  const err = await response.json().catch(() => ({}))
  throw new Error((err as any).message ?? fallback)
}

export async function listFriends(): Promise<FriendEntry[]> {
  const response = await apiFetch(`${API_BASE_URL}/friendships`)
  await throwIfNotOk(response, 'Failed to fetch friends')
  return response.json()
}

export async function listPending(): Promise<PendingLists> {
  const response = await apiFetch(`${API_BASE_URL}/friendships/pending`)
  await throwIfNotOk(response, 'Failed to fetch pending requests')
  return response.json()
}

export async function sendFriendRequest(userId: string): Promise<void> {
  const response = await apiFetch(
    `${API_BASE_URL}/friendships/${encodeURIComponent(userId)}`,
    { method: 'POST' },
  )
  await throwIfNotOk(response, 'Failed to send friend request')
}

export async function acceptFriendRequest(friendshipId: string): Promise<void> {
  const response = await apiFetch(
    `${API_BASE_URL}/friendships/${encodeURIComponent(friendshipId)}/accept`,
    { method: 'PATCH' },
  )
  await throwIfNotOk(response, 'Failed to accept request')
}

/** Recusa um pedido pendente ou remove uma amizade existente. */
export async function removeFriendship(friendshipId: string): Promise<void> {
  const response = await apiFetch(
    `${API_BASE_URL}/friendships/${encodeURIComponent(friendshipId)}`,
    { method: 'DELETE' },
  )
  await throwIfNotOk(response, 'Failed to remove friendship')
}

export async function blockUser(userId: string): Promise<void> {
  const response = await apiFetch(
    `${API_BASE_URL}/users/${encodeURIComponent(userId)}/block`,
    { method: 'POST' },
  )
  await throwIfNotOk(response, 'Failed to block user')
}

export async function unblockUser(userId: string): Promise<void> {
  const response = await apiFetch(
    `${API_BASE_URL}/users/${encodeURIComponent(userId)}/block`,
    { method: 'DELETE' },
  )
  await throwIfNotOk(response, 'Failed to unblock user')
}

export interface BlockedEntry {
  friendshipId: string
  blockedAt: string
  user: FriendUser
}

export async function listBlockedUsers(): Promise<BlockedEntry[]> {
  const response = await apiFetch(`${API_BASE_URL}/friendships/blocked`)
  await throwIfNotOk(response, 'Failed to fetch blocked users')
  return response.json()
}
