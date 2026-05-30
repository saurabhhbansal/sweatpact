"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Cropper from "react-easy-crop";
import { Check, X } from "lucide-react";
import type { Area } from "./crop-utils";
import { getCroppedBlob } from "./crop-utils";

export function AvatarCropper({
  imageSrc,
  onCropped,
  onCancel,
  busy = false,
}: {
  imageSrc: string;
  onCropped: (blob: Blob) => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  const [crop, setCrop] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Portal target — only available after hydration.
  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll while the cropper is open so the page underneath
  // doesn't scroll on touch drag.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  async function handleConfirm() {
    if (!croppedAreaPixels) return;
    setProcessing(true);
    try {
      const blob = await getCroppedBlob(imageSrc, croppedAreaPixels, 512, 0.85);
      onCropped(blob);
    } finally {
      setProcessing(false);
    }
  }

  const working = busy || processing;

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-black">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-3"
              style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <button
          type="button"
          onClick={onCancel}
          disabled={working}
          aria-label="Cancel"
          className="flex h-10 w-10 items-center justify-center rounded-full text-white/80 transition hover:bg-white/[0.08] disabled:opacity-50"
        >
          <X className="h-5 w-5" />
        </button>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/80">
          Crop photo
        </p>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={working || !croppedAreaPixels}
          aria-label="Save"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-black transition hover:bg-white/90 disabled:opacity-40"
        >
          <Check className="h-5 w-5" />
        </button>
      </header>

      {/* Crop area — fills all available height */}
      <div className="relative flex-1 bg-black">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={1}
          cropShape="round"
          showGrid={false}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
          objectFit="contain"
        />
      </div>

      {/* Footer: zoom slider + Save (also tappable for clarity) */}
      <footer
        className="shrink-0 border-t border-white/10 px-5 pt-4 pb-5"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1.25rem)" }}
      >
        <div className="mb-3 flex items-center gap-3">
          <span className="text-[11px] uppercase tracking-[0.18em] text-white/45">Zoom</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            disabled={working}
            className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-white/15 accent-white disabled:opacity-50"
          />
        </div>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={working || !croppedAreaPixels}
          className="flex h-12 w-full items-center justify-center rounded-full bg-white px-5 text-base font-semibold text-black transition hover:bg-white/90 disabled:opacity-40"
        >
          {processing ? "Processing…" : busy ? "Uploading…" : "Use photo"}
        </button>
        <p className="mt-2 text-center text-[11px] text-white/40">
          Drag to reposition · pinch to zoom
        </p>
      </footer>
    </div>,
    document.body
  );
}
