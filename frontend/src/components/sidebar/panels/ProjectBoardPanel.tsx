import { useCallback, useEffect, useState } from 'react'
import {
  fetchOpenHelpRequests,
  fetchProjectBoard,
  fetchProjectCatalog,
  fetchProjectPeers,
  fetchOffers,
  acceptOffer,
  createHelpRequest,
  createHelpOffer,
  type HelpPost,
  type HelpOffer,
  type BoardEntry,
  type ProjectCatalogItem,
  type ProjectPeers,
  type PeerUser,
} from '../../../api/projects'
import { sendFriendRequest } from '../../../api/friendships'

interface Props {
  currentUserId: string | null
  onOpenDm: (userId: string) => void
}

type Tab = 'help' | 'peers'

export default function ProjectBoardPanel({ currentUserId, onOpenDm }: Props) {
  const [tab, setTab] = useState<Tab>('help')

  const [posts, setPosts] = useState<HelpPost[]>([])
  const [loadingPosts, setLoadingPosts] = useState(true)
  const [showPostForm, setShowPostForm] = useState(false)
  const [myProjects, setMyProjects] = useState<BoardEntry[]>([])
  const [formProjectId, setFormProjectId] = useState('')
  const [formTitle, setFormTitle] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formError, setFormError] = useState('')
  const [posting, setPosting] = useState(false)
  const [expandedPost, setExpandedPost] = useState<string | null>(null)
  const [offers, setOffers] = useState<HelpOffer[]>([])
  const [loadingOffers, setLoadingOffers] = useState(false)
  const [rowState, setRowState] = useState<Record<string, string>>({})

  const [catalog, setCatalog] = useState<ProjectCatalogItem[]>([])
  const [peersProjectId, setPeersProjectId] = useState('')
  const [peers, setPeers] = useState<ProjectPeers | null>(null)
  const [loadingPeers, setLoadingPeers] = useState(false)
  const [peerState, setPeerState] = useState<Record<string, string>>({})

  const loadPosts = useCallback(() => {
    setLoadingPosts(true)
    fetchOpenHelpRequests()
      .then((page) => setPosts(page.data))
      .catch(() => setPosts([]))
      .finally(() => setLoadingPosts(false))
  }, [])

  useEffect(loadPosts, [loadPosts])

  useEffect(() => {
    fetchProjectCatalog()
      .then((list) => {
        setCatalog(list)
        if (list.length > 0) setPeersProjectId(list[0].id)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (tab !== 'peers' || !peersProjectId) return
    setLoadingPeers(true)
    setPeers(null)
    fetchProjectPeers(peersProjectId)
      .then(setPeers)
      .catch(() => {})
      .finally(() => setLoadingPeers(false))
  }, [tab, peersProjectId])

  function openPostForm() {
    setShowPostForm((v) => !v)
    setFormError('')
    if (myProjects.length === 0) {
      fetchProjectBoard({ mine: true })
        .then((page) => {
          setMyProjects(page.data)
          if (page.data.length > 0) setFormProjectId(page.data[0].id)
        })
        .catch(() => {})
    }
  }

  async function handlePost() {
    if (!formProjectId) {
      setFormError('Pick a project')
      return
    }
    if (formTitle.trim().length < 5 || formDesc.trim().length < 10) {
      setFormError('Title ≥5 chars, description ≥10')
      return
    }
    setPosting(true)
    setFormError('')
    try {
      await createHelpRequest(formProjectId, formTitle.trim(), formDesc.trim())
      setShowPostForm(false)
      setFormTitle('')
      setFormDesc('')
      loadPosts()
    } catch (err: any) {
      setFormError(err.message ?? 'Failed to post')
    } finally {
      setPosting(false)
    }
  }

  function toggleOffers(post: HelpPost) {
    if (expandedPost === post.userProject.id) {
      setExpandedPost(null)
      return
    }
    setExpandedPost(post.userProject.id)
    setOffers([])
    setLoadingOffers(true)
    fetchOffers(post.userProject.id)
      .then(setOffers)
      .catch(() => setOffers([]))
      .finally(() => setLoadingOffers(false))
  }

  async function handleAcceptOffer(offer: HelpOffer) {
    try {
      const { helper } = await acceptOffer(offer.id)
      loadPosts()
      setExpandedPost(null)
      onOpenDm(helper.id)
    } catch (err: any) {
      setRowState((prev) => ({ ...prev, [offer.id]: err.message ?? 'Failed' }))
    }
  }

  async function handleOfferHelp(post: HelpPost) {
    try {
      await createHelpOffer(post.userProject.id)
      setRowState((prev) => ({ ...prev, [post.id]: 'Offered!' }))
    } catch (err: any) {
      setRowState((prev) => ({ ...prev, [post.id]: err.message ?? 'Failed' }))
    }
  }

  async function handleAddPeer(user: PeerUser) {
    try {
      await sendFriendRequest(user.id)
      setPeerState((prev) => ({ ...prev, [user.id]: 'Sent!' }))
    } catch (err: any) {
      setPeerState((prev) => ({ ...prev, [user.id]: err.message ?? 'Failed' }))
    }
  }

  function PeerSection({ title, users }: { title: string; users: PeerUser[] }) {
    if (users.length === 0) return null
    return (
      <>
        <p className="px-3 pt-3 pb-1 font-pressStart text-[9px] text-contrast uppercase">
          {title} ({users.length})
        </p>
        {users.map((u) => (
          <div
            key={u.id}
            className="px-3 py-2 border-b-2 border-black/40 flex items-center gap-2"
          >
            <div className="flex flex-col flex-1 min-w-0">
              <span className="font-pressStart text-[10px] text-white truncate">
                {u.displayName}
              </span>
              <span className="font-pressStart text-[8px] text-white/40 truncate">
                @{u.login} · Lvl {u.level.toFixed(1)}{u.campus ? ` · ${u.campus}` : ''}
              </span>
            </div>
            {peerState[u.id] ? (
              <span className="font-pressStart text-[8px] text-secundary shrink-0">
                {peerState[u.id]}
              </span>
            ) : (
              <>
                <button
                  onClick={() => handleAddPeer(u)}
                  className="font-pressStart text-[8px] text-secundary border border-secundary/60 px-1.5 py-0.5 shrink-0"
                >
                  + Add
                </button>
                <button
                  onClick={() => onOpenDm(u.id)}
                  className="font-pressStart text-[8px] text-contrast border border-contrast/60 px-1.5 py-0.5 shrink-0"
                >
                  DM
                </button>
              </>
            )}
          </div>
        ))}
      </>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b-4 border-black shrink-0 flex items-center justify-between">
        <span className="font-pressStart text-xs text-contrast">Projects</span>
        {tab === 'help' && (
          <button
            onClick={openPostForm}
            className="font-pressStart text-[10px] text-secundary border border-secundary px-2 py-0.5"
          >
            {showPostForm ? '✕' : '+ Post'}
          </button>
        )}
      </div>

      <div className="flex border-b-4 border-black shrink-0">
        {(
          [
            { id: 'help', label: 'Help wanted' },
            { id: 'peers', label: 'Find peers' },
          ] as { id: Tab; label: string }[]
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 px-2 py-2 font-pressStart text-[9px] ${
              tab === t.id ? 'bg-black/40 text-contrast' : 'text-white/50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab 1: Help wanted ─────────────────────────────── */}
      {tab === 'help' && (
        <>
          {showPostForm && (
            <div className="flex flex-col gap-2 px-3 py-3 border-b-4 border-black shrink-0">
              <select
                value={formProjectId}
                onChange={(e) => setFormProjectId(e.target.value)}
                className="px-2 py-1 bg-white font-pressStart text-[9px] focus:outline-none border border-black"
              >
                {myProjects.length === 0 && <option value="">Loading projects...</option>}
                {myProjects.map((p) => (
                  <option key={p.id} value={p.id}>{p.project.name}</option>
                ))}
              </select>
              <input
                value={formTitle}
                onChange={(e) => { setFormTitle(e.target.value); setFormError('') }}
                placeholder="What do you need help with? *"
                maxLength={100}
                className="px-2 py-1 bg-white font-pressStart text-[9px] focus:outline-none border border-black placeholder:text-black/40"
              />
              <textarea
                value={formDesc}
                onChange={(e) => { setFormDesc(e.target.value); setFormError('') }}
                placeholder="Describe the problem *"
                maxLength={1000}
                rows={3}
                className="px-2 py-1 bg-white font-pressStart text-[9px] focus:outline-none border border-black resize-none placeholder:text-black/40"
              />
              {formError && (
                <p className="font-pressStart text-[8px] text-red-400">{formError}</p>
              )}
              <button
                onClick={handlePost}
                disabled={posting}
                className="px-2 py-1.5 bg-contrast text-black font-pressStart text-[9px] disabled:opacity-50 border border-black self-start"
              >
                {posting ? 'Posting...' : 'Post request'}
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {loadingPosts && (
              <div className="flex items-center justify-center py-8">
                <p className="font-pressStart text-[10px] text-white/50">Loading...</p>
              </div>
            )}

            {!loadingPosts && posts.length === 0 && (
              <div className="flex items-center justify-center py-8 px-4">
                <p className="font-pressStart text-[10px] text-white/40 text-center leading-relaxed">
                  No open help requests. Post one!
                </p>
              </div>
            )}

            {!loadingPosts && posts.map((post) => {
              const own = post.userProject.user.id === currentUserId
              const expanded = expandedPost === post.userProject.id
              return (
                <div
                  key={post.id}
                  className={`px-3 py-2.5 border-b-2 border-black/40 flex flex-col gap-1.5 ${
                    own ? 'bg-contrast/5' : ''
                  }`}
                >
                  <button
                    onClick={own ? () => toggleOffers(post) : undefined}
                    className={`flex flex-col gap-1 text-left ${own ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-pressStart text-[10px] text-white flex-1">
                        {post.title}
                      </span>
                      <span className="font-pressStart text-[8px] text-secundary border border-secundary/50 px-1 shrink-0">
                        {post.userProject.project.name}
                      </span>
                    </div>
                    <p className="font-pressStart text-[9px] text-white/60 leading-relaxed">
                      {post.description}
                    </p>
                    <span className="font-pressStart text-[8px] text-white/40">
                      {own ? 'you — click to see offers' : `@${post.userProject.user.login}`}
                    </span>
                  </button>

                  {!own && (
                    rowState[post.id] ? (
                      <span className="font-pressStart text-[8px] text-secundary">
                        {rowState[post.id]}
                      </span>
                    ) : (
                      <button
                        onClick={() => handleOfferHelp(post)}
                        className="font-pressStart text-[8px] text-green-400 border border-green-400/50 px-1.5 py-0.5 self-start"
                      >
                        Offer help
                      </button>
                    )
                  )}

                  {/* Ofertas recebidas (dono) */}
                  {own && expanded && (
                    <div className="flex flex-col gap-1 mt-1 border-t border-black/40 pt-2">
                      {loadingOffers && (
                        <p className="font-pressStart text-[9px] text-white/50">Loading offers...</p>
                      )}
                      {!loadingOffers && offers.length === 0 && (
                        <p className="font-pressStart text-[9px] text-white/40">
                          No offers yet.
                        </p>
                      )}
                      {!loadingOffers && offers.map((offer) => (
                        <div key={offer.id} className="flex items-center gap-2">
                          <div className="flex flex-col flex-1 min-w-0">
                            <span className="font-pressStart text-[9px] text-white truncate">
                              {offer.helper.displayName}
                              <span className="text-white/40"> @{offer.helper.login}</span>
                            </span>
                            {offer.message && (
                              <span className="font-pressStart text-[8px] text-white/50 truncate">
                                “{offer.message}”
                              </span>
                            )}
                          </div>
                          {rowState[offer.id] ? (
                            <span className="font-pressStart text-[8px] text-red-400 shrink-0">
                              {rowState[offer.id]}
                            </span>
                          ) : (
                            <button
                              onClick={() => handleAcceptOffer(offer)}
                              title="Accept: befriends you and opens the DM"
                              className="font-pressStart text-[8px] text-green-400 border border-green-400/50 px-1.5 py-0.5 shrink-0"
                            >
                              Accept
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ── Tab 2: Find peers por projecto ─────────────────── */}
      {tab === 'peers' && (
        <>
          <div className="px-3 py-2 border-b-4 border-black shrink-0">
            <select
              value={peersProjectId}
              onChange={(e) => setPeersProjectId(e.target.value)}
              className="w-full px-2 py-1.5 bg-black/40 text-white font-pressStart text-[10px] focus:outline-none border-b-2 border-r-2 border-l border-t border-black"
            >
              {catalog.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingPeers && (
              <div className="flex items-center justify-center py-8">
                <p className="font-pressStart text-[10px] text-white/50">Loading...</p>
              </div>
            )}

            {!loadingPeers && peers &&
              peers.doing.length + peers.finished.length + peers.eligible.length === 0 && (
              <div className="flex items-center justify-center py-8 px-4">
                <p className="font-pressStart text-[10px] text-white/40 text-center">
                  Nobody else on this project yet.
                </p>
              </div>
            )}

            {!loadingPeers && peers && (
              <>
                <PeerSection title="Doing it now" users={peers.doing} />
                <PeerSection title="Finished (can help)" users={peers.finished} />
                <PeerSection title="Eligible" users={peers.eligible} />
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
