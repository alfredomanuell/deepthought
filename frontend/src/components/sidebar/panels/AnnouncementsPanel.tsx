import { useEffect, useState } from 'react'
import { getSocket } from '../../../api/socket'
import {
  fetchAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
  markAnnouncementRead,
  type Announcement,
} from '../../../api/announcements'

interface User {
  role: string
}

interface Props {
  user: User | null
  /** Mantém o badge de anúncios não lidos sincronizado com este painel. */
  onUnreadChange: (count: number | ((prev: number) => number)) => void
}

export default function AnnouncementsPanel({ user, onUnreadChange }: Props) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [pinned, setPinned] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  const isAdmin = user?.role === 'ADMIN'

  useEffect(() => {
    fetchAnnouncements()
      .then((list) => {
        setAnnouncements(list)
        // Fonte de verdade do servidor para o badge
        onUnreadChange(list.filter((a) => !a.isRead).length)
      })
      .catch(() => {})
      .finally(() => setLoading(false))

    // Anúncio novo chega em tempo real com o painel aberto
    const socket = getSocket()
    const onNew = (announcement: Announcement) => {
      setAnnouncements((prev) =>
        prev.some((a) => a.id === announcement.id)
          ? prev
          : [{ ...announcement, isRead: false }, ...prev],
      )
    }
    socket?.on('announcement:new', onNew)
    return () => {
      socket?.off('announcement:new', onNew)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleMarkRead(announcement: Announcement) {
    if (announcement.isRead) return
    try {
      await markAnnouncementRead(announcement.id)
      setAnnouncements((prev) =>
        prev.map((a) => (a.id === announcement.id ? { ...a, isRead: true } : a)),
      )
      onUnreadChange((prev) => Math.max(0, prev - 1))
    } catch {}
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !body.trim()) {
      setFormError('Title and body are required')
      return
    }
    setSubmitting(true)
    setFormError('')
    try {
      const created = await createAnnouncement({ title: title.trim(), body: body.trim(), pinned })
      setAnnouncements(prev =>
        pinned ? [created, ...prev.filter(a => !a.pinned), ...prev.filter(a => a.pinned)] :
        [created, ...prev]
      )
      setTitle('')
      setBody('')
      setPinned(false)
      setShowForm(false)
    } catch (err: any) {
      setFormError(err.message ?? 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteAnnouncement(id)
      setAnnouncements(prev => prev.filter(a => a.id !== id))
    } catch {}
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
    })
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b-4 border-black shrink-0 flex items-center justify-between">
        <span className="font-pressStart text-xs text-contrast">Announcements</span>
        {isAdmin && (
          <button
            onClick={() => { setShowForm(v => !v); setFormError('') }}
            className="font-pressStart text-[10px] text-secundary border border-secundary px-2 py-0.5"
          >
            {showForm ? '✕' : '+ New'}
          </button>
        )}
      </div>

      {isAdmin && showForm && (
        <form onSubmit={handleCreate} className="flex flex-col gap-2 px-4 py-3 border-b-4 border-black shrink-0">
          <input
            placeholder="Title *"
            value={title}
            onChange={e => { setTitle(e.target.value); setFormError('') }}
            maxLength={150}
            className="px-2 py-1 bg-white font-pressStart text-[10px] focus:outline-none border-b-2 border-r-2 border-l border-t border-black w-full placeholder:text-black/40"
          />
          <textarea
            placeholder="Body *"
            value={body}
            onChange={e => { setBody(e.target.value); setFormError('') }}
            maxLength={2000}
            rows={4}
            className="px-2 py-1 bg-white font-pressStart text-[10px] focus:outline-none border-b-2 border-r-2 border-l border-t border-black w-full resize-none placeholder:text-black/40"
          />
          <label className="flex items-center gap-2 font-pressStart text-[10px] text-white">
            <input
              type="checkbox"
              checked={pinned}
              onChange={e => setPinned(e.target.checked)}
              className="w-3 h-3"
            />
            Pin to top
          </label>
          {formError && <p className="font-pressStart text-[9px] text-red-400">{formError}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="px-3 py-1.5 bg-contrast text-black font-pressStart text-[10px] disabled:opacity-50 border-b-2 border-r-2 border-l border-t border-black"
          >
            {submitting ? 'Posting...' : 'Post'}
          </button>
        </form>
      )}

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <p className="font-pressStart text-[10px] text-white/50">Loading...</p>
          </div>
        )}

        {!loading && announcements.length === 0 && (
          <div className="flex items-center justify-center py-8 px-4">
            <p className="font-pressStart text-[10px] text-white/40 text-center leading-relaxed">
              No announcements yet.
            </p>
          </div>
        )}

        {!loading && announcements.map(a => (
          <div
            key={a.id}
            className={`px-4 py-3 border-b-2 border-black/40 flex flex-col gap-1 ${
              a.pinned ? 'bg-contrast/5' : ''
            } ${a.isRead ? 'opacity-60' : ''}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {a.pinned && (
                  <span className="font-pressStart text-[8px] text-secundary shrink-0">📌</span>
                )}
                {!a.isRead && (
                  <span className="w-1.5 h-1.5 bg-red-500 shrink-0" title="Unread" />
                )}
                <p className="font-pressStart text-[10px] text-white leading-relaxed">{a.title}</p>
              </div>
              {isAdmin && (
                <button
                  onClick={() => handleDelete(a.id)}
                  className="font-pressStart text-[9px] text-red-400 hover:text-red-300 shrink-0"
                >
                  ✕
                </button>
              )}
            </div>
            <p className="font-pressStart text-[9px] text-white/70 leading-relaxed">{a.body}</p>
            <div className="flex items-center justify-between mt-0.5">
              <p className="font-pressStart text-[8px] text-white/30">
                {a.author.login} · {formatDate(a.createdAt)}
              </p>
              {!a.isRead && (
                <button
                  onClick={() => handleMarkRead(a)}
                  className="font-pressStart text-[8px] text-secundary hover:opacity-70"
                >
                  mark read
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
