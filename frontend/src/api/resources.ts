import { apiFetch } from './apiClient'
import { API_BASE_URL } from '../config/api'

export type ResourceType = 'LINK' | 'PDF' | 'VIDEO' | 'ARTICLE' | 'GITHUB' | 'OTHER' | 'FILE'

export interface Resource {
  id: string
  title: string
  description: string | null
  url: string
  type: ResourceType
  originalName: string | null
  fileSize: number | null
  createdAt: string
  user: { id: string; login: string; displayName: string }
  project: { id: string; name: string; slug: string }
}

export interface CreateResourcePayload {
  title: string
  description?: string
  url: string
  type: ResourceType
  projectId: string
}

export async function fetchResources(projectId: string): Promise<Resource[]> {
  const response = await apiFetch(`${API_BASE_URL}/resources?projectId=${encodeURIComponent(projectId)}&limit=50`)
  if (!response.ok) throw new Error('Failed to fetch resources')
  const body = await response.json()
  return body.data ?? []
}

export async function createResource(payload: CreateResourcePayload): Promise<Resource> {
  const response = await apiFetch(`${API_BASE_URL}/resources`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error((err as any).message ?? 'Failed to create resource')
  }
  return response.json()
}

export async function uploadResource(formData: FormData): Promise<Resource> {
  const response = await apiFetch(`${API_BASE_URL}/resources/upload`, {
    method: 'POST',
    body: formData,
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error((err as any).message ?? 'Failed to upload resource')
  }
  return response.json()
}

export async function deleteResource(id: string): Promise<void> {
  const response = await apiFetch(`${API_BASE_URL}/resources/${id}`, { method: 'DELETE' })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error((err as any).message ?? 'Failed to delete resource')
  }
}
