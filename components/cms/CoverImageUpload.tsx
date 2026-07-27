"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { adminUploadCmsImage } from "@/lib/cms";
import { cn } from "@/lib/utils";

interface Props {
  value?: string;
  altValue?: string;
  onChange: (url: string | undefined) => void;
  onAltChange?: (alt: string) => void;
  required?: boolean;
  recommendedSize?: string;
}

export default function CoverImageUpload({
  value,
  altValue,
  onChange,
  onAltChange,
  required,
  recommendedSize,
}: Props) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const ALLOWED_MIMES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
  const MAX_BYTES = 5 * 1024 * 1024;

  const handle = async (file?: File | null) => {
    if (!file) return;
    if (!ALLOWED_MIMES.has(file.type)) {
      toast.error("Unsupported format — use JPEG, PNG, or WebP");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Image exceeds 5MB limit");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setUploading(true);
    try {
      const { url } = await adminUploadCmsImage(file);
      onChange(url);
      toast.success("Cover image uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-rose-900">
          Cover Image {required && <span className="text-rose-500">*</span>}
        </label>
        {value && (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"
          >
            <X size={12} /> Remove
          </button>
        )}
      </div>
      <div
        className={cn(
          "relative rounded-2xl bg-gradient-to-br from-rose-100 via-pink-100 to-orange-100 p-[1.5px] transition-all",
          !value && "hover:from-rose-200 hover:via-pink-200 hover:to-orange-200"
        )}
      >
        <div className="rounded-[calc(1rem-1.5px)] bg-white">
          {value ? (
            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-[calc(1rem-1.5px)]">
              <Image
                src={value}
                alt={altValue?.trim() || "Cover"}
                fill
                className="object-cover"
                unoptimized
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="flex aspect-[16/9] w-full flex-col items-center justify-center gap-2 rounded-[calc(1rem-1.5px)] text-rose-500 transition hover:bg-rose-50/50 disabled:opacity-60"
            >
              {uploading ? <Loader2 className="animate-spin" size={28} /> : <ImagePlus size={28} />}
              <span className="text-sm font-medium">{uploading ? "Uploading…" : "Upload cover image"}</span>
              {recommendedSize && <span className="px-4 text-center text-[11px] text-rose-400">{recommendedSize}</span>}
            </button>
          )}
        </div>
      </div>
      {value && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="text-xs font-medium text-rose-600 hover:text-rose-800 disabled:opacity-50"
        >
          {uploading ? "Uploading…" : "Replace image"}
        </button>
      )}
      {onAltChange && (
        <div className="space-y-1.5 pt-1">
          <label htmlFor="cover-image-alt" className="text-xs font-semibold uppercase tracking-wide text-rose-700">
            Cover alt text
          </label>
          <input
            id="cover-image-alt"
            value={altValue || ""}
            onChange={(e) => onAltChange(e.target.value)}
            placeholder="Describe the image for SEO & accessibility"
            maxLength={200}
            className="w-full rounded-xl border border-pink-200 bg-white/60 px-4 py-2 text-sm outline-none transition focus:border-rose-400 focus:bg-white focus:ring-2 focus:ring-rose-200"
          />
          <p className="text-[11px] text-rose-400">
            {(altValue || "").length}/200 — defaults to the content title if left blank
          </p>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => handle(e.target.files?.[0])}
      />
    </div>
  );
}
