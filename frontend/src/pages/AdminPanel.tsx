import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchMe } from '../api/character'
import {
  fetchAdminUsers,
  banUser,
  unbanUser,
  updateUserRole,
  deleteUser,
  type AdminUser,
} from '../api/admin'

export default function AdminPanel() {
  const navigate = useNavigate()
  const [authorized, setAuthorized] = useState(false)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [myId, setMyId] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchMe()
      .then((me) => {
        if (me.role !== 'ADMIN') {
          navigate('/Game', { replace: true })
          return
        }
        setMyId(me.id)
        setAuthorized(true)
      })
      .catch(() => navigate('/', { replace: true }))
  }, [navigate])

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    fetchAdminUsers(page, search.trim())
      .then((res) => {
        setUsers(res.data)
        setTotalPages(res.meta.totalPages)
      })
      .catch((err: any) => setError(err.message ?? 'Failed to load users'))
      .finally(() => setLoading(false))
  }, [page, search])

  useEffect(() => {
    if (!authorized) return
    const timer = setTimeout(load, 300)
    return () => clearTimeout(timer)
  }, [authorized, load])

  async function run(action: () => Promise<void>) {
    try {
      await action()
      load()
    } catch (err: any) {
      setError(err.message ?? 'Action failed')
    }
  }

  function handleDelete(user: AdminUser) {
    if (
      !window.confirm(
        `Permanently delete ${user.login} and all their data? This cannot be undone.`,
      )
    ) {
      return
    }
    run(() => deleteUser(user.id))
  }

  if (!authorized) return null

  return (
    <div className="w-[90vw] max-w-5xl max-h-[90vh] flex flex-col gap-4 bg-neutral_contrast border-b-8 border-r-8 border-l-4 border-t-4 border-black p-3 sm:p-6">
      <div className="flex items-center justify-between">
        <h1 className="font-pressStart text-sm text-contrast">Admin Panel</h1>
        <button
          onClick={() => navigate('/Game')}
          className="font-pressStart text-[10px] text-white/60 hover:text-white"
        >
          ← Back to game
        </button>
      </div>

      <input
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1) }}
        placeholder="Search by login..."
        className="px-3 py-2 bg-white font-pressStart text-xs focus:outline-none border-b-4 border-r-4 border-l-2 border-t-2 border-black w-full sm:w-64"
      />

      {error && <p className="font-pressStart text-[10px] text-red-400">{error}</p>}

      <div className="flex-1 overflow-auto border-2 border-black">
        <table className="w-full min-w-[640px] text-left">
          <thead className="bg-black/60 sticky top-0">
            <tr>
              {['User', 'Campus', 'Level', 'Verified', 'Role', 'Status', 'Actions'].map((h) => (
                <th key={h} className="px-3 py-2 font-pressStart text-[9px] text-contrast uppercase">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center font-pressStart text-[10px] text-white/50">
                  Loading...
                </td>
              </tr>
            )}
            {!loading && users.map((u) => {
              const self = u.id === myId
              return (
                <tr key={u.id} className="border-t border-black/40">
                  <td className="px-3 py-2">
                    <div className="flex flex-col">
                      <span className="font-pressStart text-[10px] text-white">{u.displayName}</span>
                      <span className="font-pressStart text-[8px] text-white/40">@{u.login} · {u.email}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 font-pressStart text-[9px] text-white/70">
                    {u.campus ?? '—'}
                  </td>
                  <td className="px-3 py-2 font-pressStart text-[9px] text-white/70">
                    {u.level.toFixed(1)}
                  </td>
                  <td className="px-3 py-2 font-pressStart text-[9px]">
                    {u.isEmailVerified ? '✓' : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={u.role}
                      disabled={self}
                      onChange={(e) =>
                        run(() => updateUserRole(u.id, e.target.value as AdminUser['role']))
                      }
                      className="px-1 py-0.5 bg-black/40 text-white font-pressStart text-[8px] focus:outline-none border border-black disabled:opacity-40"
                    >
                      {(['USER', 'MODERATOR', 'ADMIN'] as const).map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 font-pressStart text-[9px]">
                    {u.isBanned
                      ? <span className="text-red-400">BANNED</span>
                      : <span className="text-green-400">active</span>}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      {!self && (
                        u.isBanned ? (
                          <button
                            onClick={() => run(() => unbanUser(u.id))}
                            className="font-pressStart text-[8px] text-green-400 border border-green-400/50 px-1.5 py-0.5"
                          >
                            Unban
                          </button>
                        ) : (
                          <button
                            onClick={() => run(() => banUser(u.id))}
                            className="font-pressStart text-[8px] text-yellow-400 border border-yellow-400/50 px-1.5 py-0.5"
                          >
                            Ban
                          </button>
                        )
                      )}
                      {!self && (
                        <button
                          onClick={() => handleDelete(u)}
                          className="font-pressStart text-[8px] text-red-400 border border-red-400/50 px-1.5 py-0.5"
                        >
                          Delete
                        </button>
                      )}
                      {self && (
                        <span className="font-pressStart text-[8px] text-white/30">you</span>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
          className="font-pressStart text-[10px] text-white/60 disabled:opacity-30"
        >
          ← Prev
        </button>
        <span className="font-pressStart text-[9px] text-white/40">
          page {page} / {Math.max(1, totalPages)}
        </span>
        <button
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
          className="font-pressStart text-[10px] text-white/60 disabled:opacity-30"
        >
          Next →
        </button>
      </div>
    </div>
  )
}
