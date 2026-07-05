import { apiFetch } from './apiClient'
import { API_BASE_URL } from '../config/api'

export interface ProjectCatalogItem {
  id: string
  name: string
  slug: string
}

export async function fetchProjectCatalog(): Promise<ProjectCatalogItem[]> {
  const response = await apiFetch(`${API_BASE_URL}/projects/catalog`)
  if (!response.ok) throw new Error('Failed to fetch project catalog')
  return response.json()
}

export type ProjectStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'FINISHED' | 'FAILED'

export interface BoardEntry {
  id: string
  status: ProjectStatus
  finalMark: number | null
  needHelp: boolean
  updatedAt: string
  openHelpRequestsCount: number
  project: ProjectCatalogItem
  user: {
    id: string
    login: string
    displayName: string
    avatar: string | null
    campus: string | null
    coalition: string | null
    level: number
  }
}

export interface BoardPage {
  data: BoardEntry[]
  meta: { total: number; page: number; limit: number; totalPages: number }
}

async function throwIfNotOk(response: Response, fallback: string) {
  if (response.ok) return
  const err = await response.json().catch(() => ({}))
  throw new Error((err as any).message ?? fallback)
}

export async function fetchProjectBoard(
  filters: { status?: ProjectStatus; needHelp?: boolean; mine?: boolean; page?: number } = {},
): Promise<BoardPage> {
  const params = new URLSearchParams({
    page: String(filters.page ?? 1),
    limit: '50',
  })
  if (filters.status) params.set('status', filters.status)
  if (filters.needHelp !== undefined) params.set('needHelp', String(filters.needHelp))
  if (filters.mine) params.set('mine', 'true')
  const response = await apiFetch(`${API_BASE_URL}/projects?${params}`)
  await throwIfNotOk(response, 'Failed to fetch project board')
  return response.json()
}

export interface PeerUser {
  id: string
  login: string
  displayName: string
  avatar: string | null
  campus: string | null
  coalition: string | null
  level: number
}

export interface HelpPost {
  id: string
  title: string
  description: string
  isResolved: boolean
  createdAt: string
  userProject: {
    id: string
    status: ProjectStatus
    needHelp: boolean
    project: ProjectCatalogItem
    user: PeerUser & { campus: string | null }
  }
}

export interface HelpPostsPage {
  data: HelpPost[]
  meta: { total: number; page: number; limit: number; totalPages: number }
}

export async function fetchOpenHelpRequests(page = 1): Promise<HelpPostsPage> {
  const response = await apiFetch(
    `${API_BASE_URL}/projects/help/open?page=${page}&limit=50`,
  )
  await throwIfNotOk(response, 'Failed to fetch help requests')
  return response.json()
}

export interface HelpOffer {
  id: string
  message: string | null
  createdAt: string
  helper: PeerUser
}

export async function fetchOffers(userProjectId: string): Promise<HelpOffer[]> {
  const response = await apiFetch(
    `${API_BASE_URL}/projects/${encodeURIComponent(userProjectId)}/offers`,
  )
  await throwIfNotOk(response, 'Failed to fetch offers')
  return response.json()
}

export async function acceptOffer(offerId: string): Promise<{ helper: PeerUser }> {
  const response = await apiFetch(
    `${API_BASE_URL}/projects/offers/${encodeURIComponent(offerId)}/accept`,
    { method: 'POST' },
  )
  await throwIfNotOk(response, 'Failed to accept offer')
  return response.json()
}

export interface ProjectPeers {
  project: ProjectCatalogItem
  doing: PeerUser[]
  finished: PeerUser[]
  eligible: PeerUser[]
}

export async function fetchProjectPeers(projectId: string): Promise<ProjectPeers> {
  const response = await apiFetch(
    `${API_BASE_URL}/projects/${encodeURIComponent(projectId)}/peers`,
  )
  await throwIfNotOk(response, 'Failed to fetch peers')
  return response.json()
}

export async function updateProjectStatus(
  userProjectId: string,
  status: ProjectStatus,
): Promise<void> {
  const response = await apiFetch(
    `${API_BASE_URL}/projects/${encodeURIComponent(userProjectId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    },
  )
  await throwIfNotOk(response, 'Failed to update project status')
}

export async function createHelpRequest(
  userProjectId: string,
  title: string,
  description: string,
): Promise<void> {
  const response = await apiFetch(
    `${API_BASE_URL}/projects/${encodeURIComponent(userProjectId)}/help-request`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description }),
    },
  )
  await throwIfNotOk(response, 'Failed to create help request')
}

export async function createHelpOffer(
  userProjectId: string,
  message?: string,
): Promise<void> {
  const response = await apiFetch(
    `${API_BASE_URL}/projects/${encodeURIComponent(userProjectId)}/help-offer`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message ? { message } : {}),
    },
  )
  await throwIfNotOk(response, 'Failed to offer help')
}
