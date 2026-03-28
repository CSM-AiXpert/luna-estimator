"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, Wand2, Check, X, AlertCircle } from "lucide-react"
import Image from "next/image"

interface AiVisualizerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  imageUrl: string
  imageName: string
  roomId: string
  onApply?: (outputUrl: string, wallColor: string, trimColor: string) => void
}

type State = "idle" | "loading" | "success" | "error"

export function AiVisualizerModal({
  open,
  onOpenChange,
  imageUrl,
  imageName,
  roomId,
  onApply,
}: AiVisualizerModalProps) {
  const [wallColor, setWallColor] = useState("#5B8C5A")
  const [trimColor, setTrimColor] = useState("#FFFFFF")
  const [state, setState] = useState<State>("idle")
  const [outputUrl, setOutputUrl] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleGenerate() {
    setState("loading")
    setOutputUrl(null)
    setErrorMessage(null)

    try {
      const res = await fetch("/api/ai-visualizer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl,
          wallColor,
          trimColor,
          roomId,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? "AI Visualizer failed to process this image.")
      }

      const data = await res.json()
      setOutputUrl(data.outputUrl)
      setState("success")
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "AI Visualizer failed to process this image.")
      setState("error")
    }
  }

  function handleApply() {
    if (outputUrl && onApply) {
      onApply(outputUrl, wallColor, trimColor)
      onOpenChange(false)
    }
  }

  function handleDiscard() {
    onOpenChange(false)
  }

  function handleReset() {
    setState("idle")
    setOutputUrl(null)
    setErrorMessage(null)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-[#fab52e]" />
            AI Visualizer
          </DialogTitle>
          <DialogDescription>{imageName}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Image preview */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-white/40 mb-2">Original</p>
              <div className="relative aspect-video rounded-lg overflow-hidden bg-white/5 border border-white/10">
                <Image
                  src={imageUrl}
                  alt="Original"
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            </div>
            <div>
              <p className="text-xs text-white/40 mb-2">Preview</p>
              <div className="relative aspect-video rounded-lg overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center">
                {state === "loading" && (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-[#fab52e]" />
                    <p className="text-xs text-white/40">Generating preview...</p>
                  </div>
                )}
                {state === "success" && outputUrl && (
                  <Image
                    src={outputUrl}
                    alt="Generated preview"
                    fill
                    className="object-cover"
                    unoptimized
                  />
                )}
                {state === "error" && (
                  <div className="flex flex-col items-center gap-2 text-red-400">
                    <AlertCircle className="h-8 w-8" />
                    <p className="text-xs text-red-400/70">Generation failed</p>
                  </div>
                )}
                {state === "idle" && (
                  <p className="text-xs text-white/20">Select colors and generate</p>
                )}
              </div>
            </div>
          </div>

          {/* Color pickers */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Wall Color</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={wallColor}
                  onChange={(e) => setWallColor(e.target.value)}
                  className="h-10 w-16 rounded-lg border border-white/10 cursor-pointer"
                />
                <Input
                  value={wallColor}
                  onChange={(e) => setWallColor(e.target.value)}
                  className="flex-1 font-mono text-sm"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Trim Color</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={trimColor}
                  onChange={(e) => setTrimColor(e.target.value)}
                  className="h-10 w-16 rounded-lg border border-white/10 cursor-pointer"
                />
                <Input
                  value={trimColor}
                  onChange={(e) => setTrimColor(e.target.value)}
                  className="flex-1 font-mono text-sm"
                />
              </div>
            </div>
          </div>

          {state === "error" && errorMessage && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {errorMessage}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {state === "idle" && (
            <>
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleGenerate}>
                <Wand2 className="h-4 w-4" />
                Generate Preview
              </Button>
            </>
          )}
          {state === "loading" && (
            <Button disabled>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating...
            </Button>
          )}
          {state === "success" && (
            <>
              <Button variant="secondary" onClick={handleReset}>
                Try Different Colors
              </Button>
              <Button variant="secondary" onClick={handleDiscard}>
                <X className="h-4 w-4" />
                Discard
              </Button>
              <Button onClick={handleApply}>
                <Check className="h-4 w-4" />
                Apply to Room
              </Button>
            </>
          )}
          {state === "error" && (
            <>
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button onClick={handleReset}>
                Try Again
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
