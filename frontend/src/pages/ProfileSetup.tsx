import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchMe, saveProfile } from '../api/character'

export default function ProfileSetup() {
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [avatar, setAvatar] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchMe()
      .then((user) => {
        setDisplayName(user.displayName ?? '')
        setBio(user.bio ?? '')
        setAvatar(user.avatar ?? '')
      })
      .catch(() => setError('Failed to load profile'))
      .finally(() => setLoading(false))
  }, [])

  async function handleContinue() {
    if (!displayName.trim()) {
      setError('Display name is required')
      return
    }
    setSaving(true)
    setError('')
    try {
      await saveProfile({ displayName: displayName.trim(), bio: bio.trim() || undefined })
      navigate('/CharacterCreation')
    } catch (e: any) {
      setError(e.message ?? 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return null

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-[480px] bg-neutral_contrast border-b-8 border-r-8 border-l-4 border-t-4 border-black p-6 sm:p-8">
      <h1 className="font-pressStart text-sm text-contrast">Your Profile</h1>

      {avatar && (
        <img
          src={avatar}
          alt="avatar"
          className="w-20 h-20 rounded-full border-4 border-black object-cover"
        />
      )}

      <div className="flex flex-col gap-1 w-full">
        <label className="font-pressStart text-xs text-contrast">Display Name</label>
        <input
          value={displayName}
          onChange={(e) => { setDisplayName(e.target.value); setError('') }}
          maxLength={50}
          className="px-3 py-2 text-sm font-pressStart focus:outline-none border-b-4 border-r-4 border-l-2 border-t-2 border-black w-full"
        />
      </div>

      <div className="flex flex-col gap-1 w-full">
        <label className="font-pressStart text-xs text-contrast">Bio <span className="opacity-50">(optional)</span></label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={300}
          rows={3}
          className="px-3 py-2 text-sm font-pressStart focus:outline-none border-b-4 border-r-4 border-l-2 border-t-2 border-black w-full resize-none"
        />
      </div>

      {error && <p className="text-red-500 text-xs font-pressStart">{error}</p>}

      <button
        onClick={handleContinue}
        disabled={saving}
        className="px-6 py-3 bg-black text-white font-pressStart text-xs disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Continue →'}
      </button>
    </div>
  )
}
