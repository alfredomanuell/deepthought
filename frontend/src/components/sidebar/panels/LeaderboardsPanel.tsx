import { useEffect, useState } from 'react'
import {
  fetchLeaderboard,
  type LeaderboardEntry,
  type LeaderboardKind,
} from '../../../api/leaderboard'

const TABS: { id: LeaderboardKind; label: string }[] = [
  { id: 'xp',           label: 'XP' },
  { id: 'level',        label: 'Level' },
  { id: 'achievements', label: 'Badges' },
]

function valueOf(entry: LeaderboardEntry, kind: LeaderboardKind): string {
  if (kind === 'xp') return entry.xp.toLocaleString()
  if (kind === 'level') return entry.level.toFixed(2)
  return String(entry.achievementCount ?? 0)
}

export default function LeaderboardsPanel() {
  const [kind, setKind] = useState<LeaderboardKind>('xp')
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [myPosition, setMyPosition] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchLeaderboard(kind, page)
      .then((res) => {
        setEntries(res.data)
        setMyPosition(res.meta.currentUserPosition)
        setTotalPages(res.meta.totalPages)
      })
      .catch(() => setEntries([]))
      .finally(() => setLoading(false))
  }, [kind, page])

  function selectKind(next: LeaderboardKind) {
    setKind(next)
    setPage(1)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b-4 border-black shrink-0">
        <span className="font-pressStart text-xs text-contrast">Leaderboards</span>
      </div>

      <div className="flex border-b-4 border-black shrink-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => selectKind(t.id)}
            className={`flex-1 px-2 py-2 font-pressStart text-[9px] ${
              kind === t.id ? 'bg-black/40 text-contrast' : 'text-white/50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <p className="font-pressStart text-[10px] text-white/50">Loading...</p>
          </div>
        )}

        {!loading && entries.length === 0 && (
          <div className="flex items-center justify-center py-8 px-4">
            <p className="font-pressStart text-[10px] text-white/40 text-center">
              No entries yet.
            </p>
          </div>
        )}

        {!loading && entries.map((entry) => (
          <div
            key={entry.id}
            className="px-3 py-2 border-b-2 border-black/40 flex items-center gap-2"
          >
            <span className="font-pressStart text-[10px] text-secundary w-8 shrink-0">
              #{entry.position}
            </span>
            <div className="flex flex-col flex-1 min-w-0">
              <span className="font-pressStart text-[10px] text-white truncate">
                {entry.displayName}
              </span>
              <span className="font-pressStart text-[8px] text-white/40 truncate">
                @{entry.login}{entry.campus ? ` · ${entry.campus}` : ''}
              </span>
            </div>
            <span className="font-pressStart text-[10px] text-contrast shrink-0">
              {valueOf(entry, kind)}
            </span>
          </div>
        ))}
      </div>

      <div className="px-3 py-2 border-t-4 border-black shrink-0 flex items-center justify-between">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
          className="font-pressStart text-[9px] text-white/60 disabled:opacity-30"
        >
          ← Prev
        </button>
        <span className="font-pressStart text-[9px] text-contrast">
          {myPosition ? `You: #${myPosition}` : ''}
        </span>
        <button
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
          className="font-pressStart text-[9px] text-white/60 disabled:opacity-30"
        >
          Next →
        </button>
      </div>
    </div>
  )
}
