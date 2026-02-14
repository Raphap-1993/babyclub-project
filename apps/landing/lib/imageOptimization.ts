type OptimizeOptions = {
  width?: number;
  height?: number;
  quality?: number;
};

function isHttpUrl(url: string) {
  return /^https?:\/\//i.test(url);
}

function isLikelySupabaseStorageUrl(url: string) {
  return url.includes(".supabase.co/storage/v1/object/");
}

export function optimizeImageUrl(url?: string | null, options: OptimizeOptions = {}) {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed || !isHttpUrl(trimmed)) return trimmed;
  if (!isLikelySupabaseStorageUrl(trimmed)) return trimmed;

  try {
    const parsed = new URL(trimmed);
    if (options.width && options.width > 0) {
      parsed.searchParams.set("width", String(Math.round(options.width)));
    }
    if (options.height && options.height > 0) {
      parsed.searchParams.set("height", String(Math.round(options.height)));
    }
    if (options.quality && options.quality > 0) {
      parsed.searchParams.set("quality", String(Math.round(options.quality)));
    }
    return parsed.toString();
  } catch {
    return trimmed;
  }
}

export function loadImageDimensions(url?: string | null): Promise<{ width: number; height: number } | null> {
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      } else {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.decoding = "async";
    img.src = url;
  });
}
