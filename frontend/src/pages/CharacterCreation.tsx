import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { saveCharacter, fetchMe } from '../api/character'
import type { CharacterLayers } from '../api/character'
import CharacterPreview from '../components/CharacterPreview'

interface Manifest {
  frameWidth: number
  frameHeight: number
  layers: Record<keyof CharacterLayers, string[]>
}

const LAYER_LABELS: Record<keyof CharacterLayers, string> = {
  skin: 'Skin',
  eyes: 'Eyes',
  hair: 'Hair',
  clothes: 'Clothes',
  accessory: 'Accessory',
}

const DEFAULT_LAYERS: CharacterLayers = {
  skin: 'light',
  eyes: 'blue',
  hair: 'black_short',
  clothes: 'tshirt_white',
  accessory: 'none',
}

interface Profile {
  login: string
  displayName: string
  avatar: string | null
  campus: string | null
  coalition: string | null
  level: number
  evalPoints: number
}

export default function CharacterCreation() {
  const navigate = useNavigate()
  const [manifest, setManifest] = useState<Manifest | null>(null)
  const [layers, setLayers] = useState<CharacterLayers>(DEFAULT_LAYERS)
  const [activeLayer, setActiveLayer] = useState<keyof CharacterLayers>('skin')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [tosAccepted, setTosAccepted] = useState(false)

  useEffect(() => {
    fetch('/assets/character/manifest.json')
      .then((r) => r.json())
      .then((m: Manifest) => {
        setManifest(m)
        const defaults: CharacterLayers = { ...DEFAULT_LAYERS }
        for (const layer of Object.keys(m.layers) as (keyof CharacterLayers)[]) {
          if (m.layers[layer]?.length) defaults[layer] = m.layers[layer][0]
        }
        setLayers(defaults)
      })
      .catch(() => setManifest({ frameWidth: 64, frameHeight: 64, layers: {} as any }))

    fetchMe()
      .then((user) => {
        if (user.characterLayers) setLayers(user.characterLayers)
        setProfile({
          login: user.login,
          displayName: user.displayName,
          avatar: user.avatar,
          campus: user.campus,
          coalition: user.coalition,
          level: user.level,
          evalPoints: user.evalPoints,
        })
      })
      .catch(() => {})
      .finally(() => setProfileLoading(false))
  }, [])

  function selectVariant(variant: string) {
    setLayers((prev) => ({ ...prev, [activeLayer]: variant }))
  }

  async function handleConfirm() {
    setSaving(true)
    setError('')
    try {
      await saveCharacter(layers)
      navigate('/Game')
    } catch (e: any) {
      setError(e.message ?? 'Failed to save character')
    } finally {
      setSaving(false)
    }
  }

  if (!manifest) return null

  const options = manifest.layers[activeLayer] ?? []

  const initials = profile
    ? profile.displayName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : ''

  return (
    <div className="flex flex-col gap-6 w-full max-w-2xl bg-neutral_contrast border-b-8 border-r-8 border-l-4 border-t-4 border-black p-4 sm:p-6">

      {/* 42 profile header */}
      {profileLoading ? (
        <div className="h-16 bg-black opacity-10 animate-pulse rounded" />
      ) : profile ? (
        <div className="flex items-center gap-4 border-b-4 border-black pb-4">
          {profile.avatar ? (
            <img
              src={profile.avatar}
              alt={profile.login}
              className="w-14 h-14 border-4 border-black object-cover"
            />
          ) : (
            <div className="w-14 h-14 border-4 border-black bg-black text-white flex items-center justify-center font-pressStart text-xs">
              {initials}
            </div>
          )}
          <div className="flex flex-col gap-1 min-w-0">
            <p className="font-pressStart text-xs text-contrast break-words">
              {profile.login}
              <span className="opacity-50 ml-3">{profile.displayName}</span>
            </p>
            <p className="font-pressStart text-xs text-contrast opacity-60">
              {profile.campus ?? '—'} · {profile.coalition ?? '—'} · Lvl {profile.level.toFixed(2)}
            </p>
            <p className="font-pressStart text-xs text-contrast opacity-40">
              Avaluation pts: {profile.evalPoints}
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col-reverse sm:flex-row gap-6">

      {/* Left: layer selector */}
      <div className="flex flex-col gap-4 w-full sm:w-48">
        <h1 className="font-pressStart text-xs text-contrast">Character</h1>

        {/* Layer tabs */}
        <div className="flex flex-col gap-1">
          {(Object.keys(LAYER_LABELS) as (keyof CharacterLayers)[]).map((layer) => (
            <button
              key={layer}
              onClick={() => setActiveLayer(layer)}
              className={`px-3 py-2 text-left font-pressStart text-xs border-b-4 border-r-4 border-l-2 border-t-2 border-black transition-colors ${
                activeLayer === layer ? 'bg-black text-white' : 'bg-transparent text-contrast'
              }`}
            >
              {LAYER_LABELS[layer]}
            </button>
          ))}
        </div>

        {/* Variant options for active layer */}
        <div className="flex flex-col gap-1 mt-2">
          {options.map((variant) => (
            <button
              key={variant}
              onClick={() => selectVariant(variant)}
              className={`px-3 py-2 text-left font-pressStart text-xs border-b-2 border-r-2 border-black capitalize transition-colors ${
                layers[activeLayer] === variant
                  ? 'bg-black text-white'
                  : 'bg-transparent text-contrast hover:bg-black hover:text-white'
              }`}
            >
              {variant.replace(/_/g, ' ')}
            </button>
          ))}
        </div>

        {error && <p className="text-red-500 text-xs font-pressStart">{error}</p>}

        <label className="mt-auto flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={tosAccepted}
            onChange={(e) => setTosAccepted(e.target.checked)}
            className="mt-0.5 accent-black"
          />
          <p className="font-pressStart text-xs text-contrast leading-relaxed">
            I read the{' '}
            <a
              href="/ToS"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:opacity-60"
            >
              Terms of Service
            </a>
          </p>
        </label>

        <button
          onClick={handleConfirm}
          disabled={saving || !tosAccepted}
          className="px-4 py-3 bg-black text-white font-pressStart text-xs disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Confirm ✓'}
        </button>
      </div>

      {/* Right: live preview */}
      <div className="flex flex-col items-center justify-center gap-4">
        <p className="font-pressStart text-xs text-contrast opacity-60">Preview</p>
        <CharacterPreview
          layers={layers}
          frameWidth={manifest.frameWidth}
          frameHeight={manifest.frameHeight}
        />
      </div>

      </div>
    </div>
  )
}
