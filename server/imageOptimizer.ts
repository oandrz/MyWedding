import sharp from 'sharp';

export interface OptimizedImageResult {
  originalBuffer: Buffer;
  thumbnailBuffer: Buffer;
  thumbnailContentType: string;
  thumbnailExtension: string;
}

export async function optimizeImage(
  inputBuffer: Buffer,
  options: {
    thumbnailWidth?: number;
    thumbnailQuality?: number;
  } = {}
): Promise<OptimizedImageResult> {
  const { thumbnailWidth = 600, thumbnailQuality = 80 } = options;

  const thumbnailBuffer = await sharp(inputBuffer)
    .resize(thumbnailWidth, null, {
      withoutEnlargement: true,
      fit: 'inside',
    })
    .webp({ quality: thumbnailQuality })
    .toBuffer();

  return {
    originalBuffer: inputBuffer,
    thumbnailBuffer,
    thumbnailContentType: 'image/webp',
    thumbnailExtension: 'webp',
  };
}

export function generateThumbnailFilename(originalFilename: string): string {
  const lastDot = originalFilename.lastIndexOf('.');
  const baseName = lastDot > 0 ? originalFilename.substring(0, lastDot) : originalFilename;
  return `${baseName}-thumb.webp`;
}
