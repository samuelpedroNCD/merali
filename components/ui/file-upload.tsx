"use client";

import { useRef, useState } from "react";
import { Upload, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isPublicBucket } from "@/lib/storage";
import { cn } from "@/lib/utils";

// A signed URL minted on upload lives long enough to persist for immediate
// display; private files should be re-signed at render time via resolveStorageUrl.
const UPLOAD_SIGNED_TTL = 60 * 60 * 24 * 365; // 1 year

/**
 * Upload a file to a Supabase Storage bucket. Calls onUploaded with a usable URL
 * and the storage path. Public buckets (avatars, property-photos) get a public
 * URL; private buckets (documents, maintenance, …) get a signed URL — so the
 * component is correct for both. For private files, persist the `path` and
 * re-sign on read with resolveStorageUrl() rather than storing the signed URL.
 */
export function FileUpload({
  bucket,
  onUploaded,
  accept = "image/*",
  label = "Upload",
  className,
}: {
  bucket: string;
  onUploaded: (url: string, path: string) => void;
  accept?: string;
  label?: string;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const safe = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${crypto.randomUUID()}-${safe}`;
      const { error: upErr } = await supabase.storage.from(bucket).upload(path, file);
      if (upErr) {
        setError(upErr.message);
        return;
      }
      let url: string;
      if (isPublicBucket(bucket)) {
        url = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
      } else {
        const { data, error: signErr } = await supabase.storage
          .from(bucket)
          .createSignedUrl(path, UPLOAD_SIGNED_TTL);
        if (signErr || !data) {
          setError(signErr?.message ?? "Could not generate file URL.");
          return;
        }
        url = data.signedUrl;
      }
      onUploaded(url, path);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className={cn(
          "inline-flex h-[42px] items-center gap-2 rounded-md border border-border bg-surface px-4 text-[14px] font-semibold text-text-2 transition-colors hover:bg-surface-2/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-60",
        )}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload strokeWidth={1.6} className="h-[16px] w-[16px]" />}
        {busy ? "Uploading…" : label}
      </button>
      <input ref={inputRef} type="file" accept={accept} onChange={onChange} className="hidden" />
      {error && <p className="mt-1 text-[12.5px] text-[var(--bad)]">{error}</p>}
    </div>
  );
}
