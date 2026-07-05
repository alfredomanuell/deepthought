import { apiFetch } from './apiClient'
import { API_BASE_URL } from '../config/api'

export interface ChatUser {
  id: string
  login: string
  displayName: string
  avatar: string | null
}

export interface ChatMessage {
  id: string
  chatRoomId: string
  senderId: string
  content: string
  createdAt: string
  sender: ChatUser
}

export interface ChatRoomSummary {
  id: string
  type: 'GLOBAL' | 'PRIVATE' | 'PROJECT' | 'ROOM'
  name: string | null
  otherUser: ChatUser | null
  lastMessage: ChatMessage | null
  myLastReadAt: string | null
  otherLastReadAt: string | null
  unreadCount?: number
}

export interface ChatHistoryPage {
  data: ChatMessage[]
  nextBefore: string | null
}

export async function fetchChatRooms(): Promise<ChatRoomSummary[]> {
  const response = await apiFetch(`${API_BASE_URL}/chat/rooms`)
  if (!response.ok) throw new Error('Failed to fetch chat rooms')
  return response.json()
}

export async function fetchChatMessages(
  roomId: string,
  before?: string,
): Promise<ChatHistoryPage> {
  const params = before ? `?before=${encodeURIComponent(before)}` : ''
  const response = await apiFetch(
    `${API_BASE_URL}/chat/rooms/${encodeURIComponent(roomId)}/messages${params}`,
  )
  if (!response.ok) throw new Error('Failed to fetch messages')
  return response.json()
}

export async function openDm(userId: string): Promise<ChatRoomSummary> {
  const response = await apiFetch(
    `${API_BASE_URL}/chat/dm/${encodeURIComponent(userId)}`,
    { method: 'POST' },
  )
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error((err as any).message ?? 'Failed to open DM')
  }
  return response.json()
}
