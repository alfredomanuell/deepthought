import { useEffect, useRef, useState } from 'react'
import { fetchMe } from '../../api/character'
import SidebarNav, { type PanelId } from './SidebarNav'
import ChatPanel          from './panels/ChatPanel'
import FeedbackPanel      from './panels/FeedbackPanel'
import ProfilePanel       from './panels/ProfilePanel'
import AnnouncementsPanel from './panels/AnnouncementsPanel'
import ResourcesPanel     from './panels/ResourcesPanel'
import FindPeersPanel     from './panels/FindPeersPanel'
import LeaderboardsPanel  from './panels/LeaderboardsPanel'

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
}

function PanelContent({ panel, user }: { panel: PanelId; user: User | null }): JSX.Element {
  switch (panel) {
    case 'chat':          return <ChatPanel />
    case 'feedback':      return <FeedbackPanel />
    case 'profile':       return <ProfilePanel user={user} />
    case 'announcements': return <AnnouncementsPanel user={user} />
    case 'resources':     return <ResourcesPanel />
    case 'findPeers':     return <FindPeersPanel />
    case 'leaderboards':  return <LeaderboardsPanel />
    default:              return <ChatPanel />
  }
}

export default function Sidebar() {
  const [activePanel, setActivePanel] = useState<PanelId>('chat')
  const [exitingPanel, setExitingPanel] = useState<PanelId | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetchMe().then(setUser).catch(() => {})
  }, [])

  function switchTo(panel: PanelId) {
    if (panel === activePanel) return
    if (exitTimer.current) clearTimeout(exitTimer.current)
    setExitingPanel(activePanel)
    setActivePanel(panel)
    exitTimer.current = setTimeout(() => setExitingPanel(null), 160)
  }

  return (
    <div className="absolute top-0 right-0 bottom-0 flex flex-row">
      <SidebarNav activePanel={activePanel} onSelect={switchTo} />

      <div className="relative w-72 h-full overflow-hidden bg-neutral_contrast border-l-4 border-black">
        {exitingPanel !== null && (
          <div
            key={`exit-${exitingPanel}`}
            className="absolute inset-0 animate-slide-out-left z-10 pointer-events-none"
          >
            <PanelContent panel={exitingPanel} user={user} />
          </div>
        )}
        <div
          key={activePanel}
          className={`absolute inset-0 ${exitingPanel !== null ? 'animate-slide-in-from-left' : ''}`}
        >
          <PanelContent panel={activePanel} user={user} />
        </div>
      </div>
    </div>
  )
}
