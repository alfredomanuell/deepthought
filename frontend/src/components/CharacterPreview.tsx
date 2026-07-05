import { useEffect, useRef } from 'react'
import type { CharacterLayers } from '../api/character'

interface Props {
  layers: CharacterLayers
  frameWidth?: number
  frameHeight?: number
}

const LAYER_ORDER: (keyof CharacterLayers)[] = ['skin', 'eyes', 'hair', 'clothes', 'accessory']
const DIRECTIONS = ['NW', 'NE', 'SW', 'SE'] as const
const FRAME_INDEX: Record<typeof DIRECTIONS[number], number> = { NW: 0, NE: 1, SW: 2, SE: 3 }

export default function CharacterPreview({ layers, frameWidth = 64, frameHeight = 64 }: Props) {
  const canvasRefs = {
    NW: useRef<HTMLCanvasElement>(null),
    NE: useRef<HTMLCanvasElement>(null),
    SW: useRef<HTMLCanvasElement>(null),
    SE: useRef<HTMLCanvasElement>(null),
  }

  useEffect(() => {
    const images: HTMLImageElement[] = []
    let cancelled = false

    async function draw() {
      // Load all layer images
      const loaded = await Promise.all(
        LAYER_ORDER.map((layer) => {
          return new Promise<HTMLImageElement>((resolve) => {
            const img = new Image()
            images.push(img)
            img.onload = () => resolve(img)
            img.onerror = () => resolve(img) // treat missing as transparent
            img.src = `/assets/character/layers/${layer}/${layers[layer]}.png`
          })
        })
      )

      if (cancelled) return

      for (const dir of DIRECTIONS) {
        const canvas = canvasRefs[dir].current
        if (!canvas) continue
        const ctx = canvas.getContext('2d')
        if (!ctx) continue
        ctx.clearRect(0, 0, frameWidth, frameHeight)
        const frameX = FRAME_INDEX[dir] * frameWidth
        for (const img of loaded) {
          if (img.naturalWidth > 0) {
            ctx.drawImage(img, frameX, 0, frameWidth, frameHeight, 0, 0, frameWidth, frameHeight)
          }
        }
      }
    }

    draw()
    return () => { cancelled = true }
  }, [layers, frameWidth, frameHeight])

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="grid grid-cols-2 gap-3">
        {DIRECTIONS.map((dir) => (
          <div key={dir} className="flex flex-col items-center gap-1">
            <canvas
              ref={canvasRefs[dir]}
              width={frameWidth}
              height={frameHeight}
              className="border-2 border-black"
              style={{ imageRendering: 'pixelated', width: frameWidth * 2, height: frameHeight * 2 }}
            />
            <span className="font-pressStart text-xs">{dir}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
