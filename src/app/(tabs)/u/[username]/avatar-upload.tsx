"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { Avatar } from "@/components/avatar";
import { AvatarCropper } from "./avatar-cropper";
import { fileToDataUrl } from "./crop-utils";

// Original file cap — we re-encode after crop so the final upload is much smaller.
const MAX_INPUT_BYTES = 10 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export function AvatarUpload({
  userId,
  username,
  name,
  initialUrl,
}: {
  userId: string;
  username: string | null;
  name: string | null;
  initialUrl: string | null;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setUrl(initialUrl);
  }, [initialUrl]);

  async function onFilePicked(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setErr(null);
    if (!ALLOWED.has(file.type)) {
      setErr("Use JPEG, PNG, or WebP.");
      return;
    }
    if (file.size > MAX_INPUT_BYTES) {
      setErr("Pick a smaller photo (under 10 MB).");
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setImageSrc(dataUrl);
    } catch {
      setErr("Couldn't read that file.");
    }
  }

  async function onCropped(blob: Blob) {
    setBusy(true);
    setErr(null);

    const supabase = createClient();
    const path = `${userId}/avatar.jpg`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, blob, {
        upsert: true,
        cacheControl: "0",
        contentType: "image/jpeg",
      });
    if (uploadError) {
      setBusy(false);
      setErr(uploadError.message);
      return;
    }

    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    const publicUrl = `${pub.publicUrl}?v=${Date.now()}`;

    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ avatar_url: publicUrl }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErr(data.error ?? "Failed to save photo.");
      return;
    }
    setUrl(publicUrl);
    setImageSrc(null);
    startTransition(() => router.refresh());
  }

  function cancelCrop() {
    if (busy) return;
    setImageSrc(null);
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <Avatar url={url} name={name} username={username} size="lg" />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          aria-label="Change photo"
          className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border border-white/30 bg-black text-white transition hover:bg-white hover:text-black disabled:opacity-50"
        >
          <Camera className="h-4 w-4" />
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={onFilePicked}
      />
      {busy ? (
        <p className="text-xs text-white/55">Uploading…</p>
      ) : err ? (
        <p className="text-xs text-white/85">{err}</p>
      ) : null}

      {imageSrc ? (
        <AvatarCropper
          imageSrc={imageSrc}
          onCropped={onCropped}
          onCancel={cancelCrop}
          busy={busy}
        />
      ) : null}
    </div>
  );
}
