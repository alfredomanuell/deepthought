import { useEffect, useState } from 'react'
import { searchUsers, type UserSearchResult } from '../../../api/users'
import {
  listFriends,
  listPending,
  listBlockedUsers,
  sendFriendRequest,
  acceptFriendRequest,
  removeFriendship,
  blockUser,
  unblockUser,
  type FriendEntry,
  type PendingLists,
  type BlockedEntry,
} from '../../../api/friendships'

interface Props {
  currentUserId: string | null
  onOpenDm: (userId: string) => void
}

type Tab = 'search' | 'friends'

export default function SocialPanel({ currentUserId, onOpenDm }: Props) {
  const [tab, setTab] = useState<Tab>('friends')

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<UserSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [rowState, setRowState] = useState<Record<string, string>>({})

  const [friends, setFriends] = useState<FriendEntry[]>([])
  const [pending, setPending] = useState<PendingLists>({ incoming: [], outgoing: [] })
  const [blocked, setBlocked] = useState<BlockedEntry[]>([])
  const [loadingFriends, setLoadingFriends] = useState(false)

  useEffect(() => {
    if (tab !== 'search') return
    const term = query.trim()
    if (!term) {
      setResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    const timer = setTimeout(() => {
      searchUsers(term)
        .then((page) => setResults(page.data.filter((u) => u.id !== currentUserId)))
        .catch(() => setResults([]))
        .finally(() => setSearching(false))
    }, 350)
    return () => clearTimeout(timer)
  }, [query, tab, currentUserId])

  function loadFriends() {
    setLoadingFriends(true)
    Promise.all([listFriends(), listPending(), listBlockedUsers()])
      .then(([f, p, b]) => {
        setFriends(f)
        setPending(p)
        setBlocked(b)
      })
      .catch(() => {})
      .finally(() => setLoadingFriends(false))
  }

  useEffect(() => {
    if (tab === 'friends') loadFriends()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  function feedback(userId: string, message: string) {
    setRowState((prev) => ({ ...prev, [userId]: message }))
  }

  async function handleAdd(userId: string) {
    try {
      await sendFriendRequest(userId)
      feedback(userId, 'Request sent!')
    } catch (err: any) {
      feedback(userId, err.message ?? 'Failed')
    }
  }

  async function handleBlock(userId: string) {
    try {
      await blockUser(userId)
      feedback(userId, 'Blocked')
      if (tab === 'friends') loadFriends()
    } catch (err: any) {
      feedback(userId, err.message ?? 'Failed')
    }
  }

  async function handleUnblock(userId: string) {
    try {
      await unblockUser(userId)
      loadFriends()
    } catch {}
  }

  async function handleAccept(friendshipId: string) {
    try {
      await acceptFriendRequest(friendshipId)
      loadFriends()
    } catch {}
  }

  async function handleRemove(friendshipId: string) {
    try {
      await removeFriendship(friendshipId)
      loadFriends()
    } catch {}
  }

  const pendingBadge = pending.incoming.length

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b-4 border-black shrink-0">
        <span className="font-pressStart text-xs text-contrast">Social</span>
      </div>

      <div className="flex border-b-4 border-black shrink-0">
        {(['friends', 'search'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 px-2 py-2 font-pressStart text-[9px] ${
              tab === t ? 'bg-black/40 text-contrast' : 'text-white/50'
            }`}
          >
            {t === 'search'
              ? 'Search'
              : `Friends${pendingBadge > 0 ? ` (${pendingBadge})` : ''}`}
          </button>
        ))}
      </div>

      {tab === 'search' && (
        <>
          <div className="px-3 py-2 border-b-4 border-black shrink-0">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by login..."
              className="w-full px-2 py-1.5 bg-black/40 text-white font-pressStart text-[10px] focus:outline-none border-b-2 border-r-2 border-l border-t border-black placeholder:text-white/30"
            />
          </div>

          <div className="flex-1 overflow-y-auto">
            {!query.trim() && (
              <div className="flex items-center justify-center py-8 px-4">
                <p className="font-pressStart text-[10px] text-white/40 text-center leading-relaxed">
                  Type a login to search for cadets.
                </p>
              </div>
            )}
            {searching && (
              <div className="flex items-center justify-center py-8">
                <p className="font-pressStart text-[10px] text-white/50">Searching...</p>
              </div>
            )}
            {!searching && query.trim() && results.length === 0 && (
              <div className="flex items-center justify-center py-8 px-4">
                <p className="font-pressStart text-[10px] text-white/40 text-center">
                  No users found.
                </p>
              </div>
            )}
            {!searching && results.map((u) => (
              <div
                key={u.id}
                className="px-3 py-2 border-b-2 border-black/40 flex flex-col gap-1.5"
              >
                <div className="flex flex-col min-w-0">
                  <span className="font-pressStart text-[10px] text-white truncate">
                    {u.displayName}
                  </span>
                  <span className="font-pressStart text-[8px] text-white/40 truncate">
                    @{u.login} · Lvl {u.level.toFixed(1)}{u.campus ? ` · ${u.campus}` : ''}
                  </span>
                </div>
                {rowState[u.id] ? (
                  <span className="font-pressStart text-[8px] text-secundary">
                    {rowState[u.id]}
                  </span>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAdd(u.id)}
                      className="font-pressStart text-[8px] text-secundary border border-secundary/60 px-1.5 py-0.5"
                    >
                      + Add
                    </button>
                    <button
                      onClick={() => onOpenDm(u.id)}
                      className="font-pressStart text-[8px] text-contrast border border-contrast/60 px-1.5 py-0.5"
                    >
                      DM
                    </button>
                    <button
                      onClick={() => handleBlock(u.id)}
                      className="font-pressStart text-[8px] text-red-400/70 border border-red-400/40 px-1.5 py-0.5"
                    >
                      Block
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'friends' && (
        <div className="flex-1 overflow-y-auto">
          {loadingFriends && (
            <div className="flex items-center justify-center py-8">
              <p className="font-pressStart text-[10px] text-white/50">Loading...</p>
            </div>
          )}

          {!loadingFriends && pending.incoming.length > 0 && (
            <>
              <p className="px-3 pt-3 pb-1 font-pressStart text-[9px] text-contrast uppercase">
                Requests
              </p>
              {pending.incoming.map((p) => (
                <div
                  key={p.friendshipId}
                  className="px-3 py-2 border-b-2 border-black/40 flex items-center gap-2"
                >
                  <span className="font-pressStart text-[10px] text-white flex-1 truncate">
                    {p.user.displayName}
                  </span>
                  <button
                    onClick={() => handleAccept(p.friendshipId)}
                    className="font-pressStart text-[9px] text-green-400 border border-green-400 px-2 py-0.5"
                  >
                    ✓
                  </button>
                  <button
                    onClick={() => handleRemove(p.friendshipId)}
                    className="font-pressStart text-[9px] text-red-400 border border-red-400 px-2 py-0.5"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </>
          )}

          {!loadingFriends && (
            <>
              <p className="px-3 pt-3 pb-1 font-pressStart text-[9px] text-contrast uppercase">
                Friends ({friends.length})
              </p>
              {friends.length === 0 && (
                <p className="px-3 py-4 font-pressStart text-[10px] text-white/40 text-center">
                  No friends yet. Find cadets in the Search tab!
                </p>
              )}
              {friends.map((f) => (
                <div
                  key={f.friendshipId}
                  className="px-3 py-2 border-b-2 border-black/40 flex items-center gap-2"
                >
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="font-pressStart text-[10px] text-white truncate">
                      {f.friend.displayName}
                    </span>
                    <span className="font-pressStart text-[8px] text-white/40 truncate">
                      @{f.friend.login} · Lvl {f.friend.level.toFixed(1)}
                    </span>
                  </div>
                  <button
                    onClick={() => onOpenDm(f.friend.id)}
                    title="Send message"
                    className="font-pressStart text-[8px] text-contrast border border-contrast/60 px-1.5 py-0.5 shrink-0"
                  >
                    DM
                  </button>
                  <button
                    onClick={() => handleBlock(f.friend.id)}
                    title="Block user"
                    className="font-pressStart text-[8px] text-red-400/70 border border-red-400/40 px-1.5 py-0.5 shrink-0"
                  >
                    Block
                  </button>
                  <button
                    onClick={() => handleRemove(f.friendshipId)}
                    title="Remove friend"
                    className="font-pressStart text-[9px] text-red-400/60 hover:text-red-400 shrink-0"
                  >
                    ✕
                  </button>
                </div>
              ))}

              {pending.outgoing.length > 0 && (
                <>
                  <p className="px-3 pt-3 pb-1 font-pressStart text-[9px] text-contrast uppercase">
                    Sent
                  </p>
                  {pending.outgoing.map((p) => (
                    <div
                      key={p.friendshipId}
                      className="px-3 py-2 border-b-2 border-black/40 flex items-center gap-2"
                    >
                      <span className="font-pressStart text-[10px] text-white/60 flex-1 truncate">
                        {p.user.displayName}
                      </span>
                      <button
                        onClick={() => handleRemove(p.friendshipId)}
                        className="font-pressStart text-[8px] text-white/40 hover:text-red-400"
                      >
                        cancel
                      </button>
                    </div>
                  ))}
                </>
              )}

              {blocked.length > 0 && (
                <>
                  <p className="px-3 pt-3 pb-1 font-pressStart text-[9px] text-contrast uppercase">
                    Blocked
                  </p>
                  {blocked.map((b) => (
                    <div
                      key={b.friendshipId}
                      className="px-3 py-2 border-b-2 border-black/40 flex items-center gap-2"
                    >
                      <span className="font-pressStart text-[10px] text-white/50 flex-1 truncate">
                        {b.user.displayName}
                      </span>
                      <button
                        onClick={() => handleUnblock(b.user.id)}
                        className="font-pressStart text-[8px] text-secundary border border-secundary/50 px-1.5 py-0.5"
                      >
                        Unblock
                      </button>
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
