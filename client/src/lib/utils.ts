import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Injects Cloudinary's f_auto and q_auto transformations into any Cloudinary
 * video URL so it is automatically compressed and served in the best format
 * for every device and connection.
 *
 * - Already-transformed URLs are returned unchanged.
 * - Non-Cloudinary URLs (local /uploads/…, external, etc.) pass through untouched.
 */
export function toCloudinaryVideoUrl(src: string): string {
  if (!src) return src;
  if (!src.includes("res.cloudinary.com")) return src;
  
  // HLS .m3u8 URLs — mat chhuo, as-is return karo
  if (src.includes(".m3u8")) return src;
  
  // Already transformed
  if (src.includes("f_auto") || src.includes("q_auto")) return src;

  // Insert transformations right after /upload/
  return src.replace("/upload/", "/upload/f_auto,q_auto/");
}
