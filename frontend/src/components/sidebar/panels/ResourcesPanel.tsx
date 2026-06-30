import { useEffect, useState } from 'react'
import { fetchProjectCatalog, type ProjectCatalogItem } from '../../../api/projects'
import {
  fetchResources,
  createResource,
  deleteResource,
  type Resource,
  type ResourceType,
} from '../../../api/resources'

const RESOURCE_TYPES: ResourceType[] = ['LINK', 'PDF', 'VIDEO', 'ARTICLE', 'GITHUB', 'OTHER']

const TYPE_LABELS: Record<ResourceType, string> = {
  LINK: 'Link',
  PDF: 'PDF',
  VIDEO: 'Video',
  ARTICLE: 'Article',
  GITHUB: 'GitHub',
  OTHER: 'Other',
}

interface CreateForm {
  title: string
  url: string
  description: string
  type: ResourceType
}

const EMPTY_FORM: CreateForm = { title: '', url: '', description: '', type: 'LINK' }

export default function ResourcesPanel() {
  const [projects, setProjects] = useState<ProjectCatalogItem[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [resources, setResources] = useState<Resource[]>([])
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [loadingResources, setLoadingResources] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        setCurrentUserId(payload.sub ?? null)
      } catch {}
    }

    fetchProjectCatalog()
      .then(list => {
        setProjects(list)
        if (list.length > 0) setSelectedId(list[0].id)
      })
      .catch(() => {})
      .finally(() => setLoadingProjects(false))
  }, [])

  useEffect(() => {
    if (!selectedId) return
    setLoadingResources(true)
    setResources([])
    fetchResources(selectedId)
      .then(setResources)
      .catch(() => {})
      .finally(() => setLoadingResources(false))
  }, [selectedId])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || !form.url.trim()) {
      setFormError('Title and URL are required')
      return
    }
    setSubmitting(true)
    setFormError('')
    try {
      const created = await createResource({
        title: form.title.trim(),
        url: form.url.trim(),
        description: form.description.trim() || undefined,
        type: form.type,
        projectId: selectedId,
      })
      setResources(prev => [created, ...prev])
      setForm(EMPTY_FORM)
      setShowForm(false)
    } catch (err: any) {
      setFormError(err.message ?? 'Failed to create resource')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteResource(id)
      setResources(prev => prev.filter(r => r.id !== id))
    } catch {}
  }

  if (loadingProjects) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="font-pressStart text-[10px] text-white/50">Loading...</p>
      </div>
    )
  }

  if (projects.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-4 py-3 border-b-4 border-black shrink-0">
          <span className="font-pressStart text-xs text-contrast">Resources</span>
        </div>
        <div className="flex-1 flex items-center justify-center px-4">
          <p className="font-pressStart text-[10px] text-white/40 text-center">No projects found.</p>
        </div>
      </div>
    )
  }

  const selectedProject = projects.find(p => p.id === selectedId)

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b-4 border-black shrink-0 flex items-center justify-between">
        <span className="font-pressStart text-xs text-contrast">Resources</span>
        <button
          onClick={() => { setShowForm(v => !v); setFormError('') }}
          className="font-pressStart text-[10px] text-secundary border border-secundary px-2 py-0.5"
        >
          {showForm ? '✕' : '+ Add'}
        </button>
      </div>

      <div className="px-4 pt-3 pb-2 border-b-4 border-black shrink-0">
        <select
          value={selectedId}
          onChange={e => { setSelectedId(e.target.value); setShowForm(false) }}
          className="w-full px-2 py-1.5 bg-black/40 text-white font-pressStart text-[10px] focus:outline-none border-b-2 border-r-2 border-l border-t border-black"
        >
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="flex flex-col gap-2 px-4 py-3 border-b-4 border-black shrink-0">
          <input
            placeholder="Title *"
            value={form.title}
            onChange={e => { setForm(f => ({ ...f, title: e.target.value })); setFormError('') }}
            maxLength={100}
            className="px-2 py-1 bg-white font-pressStart text-[10px] focus:outline-none border-b-2 border-r-2 border-l border-t border-black w-full placeholder:text-black/40"
          />
          <input
            placeholder="URL *"
            value={form.url}
            onChange={e => { setForm(f => ({ ...f, url: e.target.value })); setFormError('') }}
            maxLength={500}
            className="px-2 py-1 bg-white font-pressStart text-[10px] focus:outline-none border-b-2 border-r-2 border-l border-t border-black w-full placeholder:text-black/40"
          />
          <input
            placeholder="Description (optional)"
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            maxLength={500}
            className="px-2 py-1 bg-white font-pressStart text-[10px] focus:outline-none border-b-2 border-r-2 border-l border-t border-black w-full placeholder:text-black/40"
          />
          <select
            value={form.type}
            onChange={e => setForm(f => ({ ...f, type: e.target.value as ResourceType }))}
            className="px-2 py-1 bg-white font-pressStart text-[10px] focus:outline-none border-b-2 border-r-2 border-l border-t border-black w-full"
          >
            {RESOURCE_TYPES.map(t => (
              <option key={t} value={t}>{TYPE_LABELS[t]}</option>
            ))}
          </select>
          {formError && <p className="font-pressStart text-[9px] text-red-400">{formError}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="px-3 py-1.5 bg-contrast text-black font-pressStart text-[10px] disabled:opacity-50 border-b-2 border-r-2 border-l border-t border-black"
          >
            {submitting ? 'Adding...' : `Add to ${selectedProject?.name ?? ''}`}
          </button>
        </form>
      )}

      <div className="flex-1 overflow-y-auto">
        {loadingResources && (
          <div className="flex items-center justify-center py-8">
            <p className="font-pressStart text-[10px] text-white/50">Loading...</p>
          </div>
        )}

        {!loadingResources && resources.length === 0 && (
          <div className="flex items-center justify-center py-8 px-4">
            <p className="font-pressStart text-[10px] text-white/40 text-center">
              No resources yet. Be the first to share one!
            </p>
          </div>
        )}

        {!loadingResources && resources.map(r => (
          <div key={r.id} className="px-4 py-3 border-b-2 border-black/40 flex flex-col gap-1">
            <div className="flex items-start justify-between gap-2">
              <a
                href={/^https?:\/\//i.test(r.url) ? r.url : `https://${r.url}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-pressStart text-[10px] text-contrast hover:text-secundary leading-relaxed flex-1"
              >
                {r.title}
              </a>
              {currentUserId && r.user.id === currentUserId && (
                <button
                  onClick={() => handleDelete(r.id)}
                  className="font-pressStart text-[9px] text-red-400 hover:text-red-300 shrink-0"
                >
                  ✕
                </button>
              )}
            </div>
            {r.description && (
              <p className="font-pressStart text-[9px] text-white/60 leading-relaxed">{r.description}</p>
            )}
            <div className="flex items-center gap-2 mt-0.5">
              <span className="font-pressStart text-[8px] text-secundary border border-secundary/50 px-1">{TYPE_LABELS[r.type]}</span>
              <span className="font-pressStart text-[8px] text-white/40">by {r.user.login}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
