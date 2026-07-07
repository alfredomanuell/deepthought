import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import { fetchMe } from '../../api/character'
import { fetchAnnouncements } from '../../api/announcements'
import { getSocket } from '../../api/socket'
import SidebarNav, { type PanelId } from './SidebarNav'
import ChatPanel          from './panels/ChatPanel'
import FeedbackPanel      from './panels/FeedbackPanel'
import ProfilePanel       from './panels/ProfilePanel'
import AnnouncementsPanel from './panels/AnnouncementsPanel'
import ResourcesPanel     from './panels/ResourcesPanel'
import SocialPanel        from './panels/SocialPanel'
import LeaderboardsPanel  from './panels/LeaderboardsPanel'
import NotificationsPanel from './panels/NotificationsPanel'
import ProjectBoardPanel  from './panels/ProjectBoardPanel'

interface User {
  id: string
  login: string
  displayName: string
  avatar: string | null
  campus: string | null
  coalition: string | null
  level: number
  xp: number
  evalPoints: number
  role: string
  bio: string | null
  achievements?: {
    id: string
    unlockedAt: string
    achievement: {
      title: string
      description: string
      icon: string | null
      xpReward: number
    }
  }[]
}

type CountSetter = (count: number | ((prev: number) => number)) => void

interface PanelContentProps {
  panel: PanelId
  user: User | null
  onUnreadChange: CountSetter
  onAnnouncementsUnreadChange: CountSetter
  onOpenDm: (userId: string) => void
  pendingDmUserId: string | null
  onDmConsumed: () => void
}

function PanelContent({
  panel,
  user,
  onUnreadChange,
  onAnnouncementsUnreadChange,
  onOpenDm,
  pendingDmUserId,
  onDmConsumed,
}: PanelContentProps): ReactElement {
  const uid = user?.id ?? null
  switch (panel) {
    case 'chat':
      return (
        <ChatPanel
          currentUserId={uid}
          pendingDmUserId={pendingDmUserId}
          onDmConsumed={onDmConsumed}
        />
      )
    case 'feedback':      return <FeedbackPanel />
    case 'profile':       return <ProfilePanel user={user} />
    case 'announcements':
      return <AnnouncementsPanel user={user} onUnreadChange={onAnnouncementsUnreadChange} />
    case 'resources':     return <ResourcesPanel />
    case 'projects':
      return <ProjectBoardPanel currentUserId={uid} onOpenDm={onOpenDm} />
    case 'social':
      return <SocialPanel currentUserId={uid} onOpenDm={onOpenDm} />
    case 'leaderboards':  return <LeaderboardsPanel />
    case 'notifications': return <NotificationsPanel onUnreadChange={onUnreadChange} />
    default:
      return (
        <ChatPanel
          currentUserId={uid}
          pendingDmUserId={pendingDmUserId}
          onDmConsumed={onDmConsumed}
        />
      )
  }
}

export default function Sidebar() {
  const [activePanel, setActivePanel] = useState<PanelId>('chat')
  const [exitingPanel, setExitingPanel] = useState<PanelId | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [announcementsUnread, setAnnouncementsUnread] = useState(0)
  const [dmUserId, setDmUserId] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetchMe()
      .then((me) => {
        setUser(me)
        setUnreadCount(me.unreadNotifications ?? 0)
      })
      .catch(() => {})

    fetchAnnouncements()
      .then((list) => setAnnouncementsUnread(list.filter((a) => !a.isRead).length))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const socket = getSocket()
    const onNotification = () => setUnreadCount((c) => c + 1)
    const onAnnouncement = () => setAnnouncementsUnread((c) => c + 1)
    socket?.on('notification:new', onNotification)
    socket?.on('announcement:new', onAnnouncement)
    return () => {
      socket?.off('notification:new', onNotification)
      socket?.off('announcement:new', onAnnouncement)
    }
  }, [])

  function switchTo(panel: PanelId) {
    if (panel === activePanel) {
      setPanelOpen((o) => !o)
      return
    }
    if (exitTimer.current) clearTimeout(exitTimer.current)
    setExitingPanel(activePanel)
    setActivePanel(panel)
    setPanelOpen(true)
    exitTimer.current = setTimeout(() => setExitingPanel(null), 160)
  }

  const openDmWith = useCallback((userId: string) => {
    setDmUserId(userId)
    setPanelOpen(true)
    setActivePanel((current) => {
      if (current === 'chat') return current
      if (exitTimer.current) clearTimeout(exitTimer.current)
      setExitingPanel(current)
      exitTimer.current = setTimeout(() => setExitingPanel(null), 160)
      return 'chat'
    })
  }, [])

  const dmConsumed = useCallback(() => setDmUserId(null), [])

  const panelProps = {
    user,
    onUnreadChange: setUnreadCount as CountSetter,
    onAnnouncementsUnreadChange: setAnnouncementsUnread as CountSetter,
    onOpenDm: openDmWith,
    pendingDmUserId: dmUserId,
    onDmConsumed: dmConsumed,
  }

  return (
    <div className="absolute top-0 right-0 bottom-0 flex flex-row z-20">
      <SidebarNav
        activePanel={activePanel}
        onSelect={switchTo}
        unreadCount={unreadCount}
        announcementsUnread={announcementsUnread}
        isAdmin={user?.role === 'ADMIN'}
      />

      <div className={`${panelOpen ? '' : 'hidden'} lg:block relative w-72 max-w-[calc(100vw-4rem)] h-full overflow-hidden bg-neutral_contrast border-l-4 border-black`}>
        <button
          onClick={() => setPanelOpen(false)}
          className="absolute top-1 right-1 z-30 lg:hidden font-pressStart text-xs text-white/60 hover:text-white px-1"
          aria-label="Close panel"
        >
          ×
        </button>
        {exitingPanel !== null && (
          <div
            key={`exit-${exitingPanel}`}
            className="absolute inset-0 animate-slide-out-left z-10 pointer-events-none"
          >
            <PanelContent panel={exitingPanel} {...panelProps} />
          </div>
        )}
        <div
          key={activePanel}
          className={`absolute inset-0 ${exitingPanel !== null ? 'animate-slide-in-from-left' : ''}`}
        >
          <PanelContent panel={activePanel} {...panelProps} />
        </div>
      </div>
    </div>
  )
}
