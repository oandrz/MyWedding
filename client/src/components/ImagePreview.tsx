import type { ProcessedImage } from "@/hooks/useImageAnalysis";

interface ImagePreviewProps {
  processedImage: ProcessedImage;
  imageType: "banner" | "gallery" | "bride-profile" | "groom-profile" | "verse-image";
}

function formatFileSize(bytes: number): string {
  const kb = bytes / 1024;
  return kb > 1024 ? `${(kb / 1024).toFixed(1)}MB` : `${Math.round(kb)}KB`;
}

function formatDimensions(width: number, height: number): string {
  return `${width} \u00d7 ${height}px`;
}

export function ImagePreview({ processedImage, imageType }: ImagePreviewProps) {
  const { analysis } = processedImage;

  return (
    <div className="mt-3 p-3 bg-white rounded border text-left">
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <span className="font-medium">Dimensions:</span>
          <div
            className={
              analysis.isOptimalRatio ? "text-green-600" : "text-orange-600"
            }
          >
            {formatDimensions(analysis.width, analysis.height)}
            {analysis.isOptimalRatio ? " \u2713" : " \u26a0"}
          </div>
        </div>
        <div>
          <span className="font-medium">File Size:</span>
          <div
            className={
              analysis.isOptimalSize ? "text-green-600" : "text-orange-600"
            }
          >
            {formatFileSize(analysis.fileSize)}
            {analysis.isOptimalSize ? " \u2713" : " \u26a0"}
          </div>
        </div>
        <div>
          <span className="font-medium">Aspect Ratio:</span>
          <div
            className={
              analysis.isOptimalRatio ? "text-green-600" : "text-orange-600"
            }
          >
            {analysis.aspectRatio.toFixed(2)}:1
            {imageType === "banner" &&
              !analysis.isOptimalRatio &&
              " (16:9 recommended)"}
            {imageType === "gallery" &&
              !analysis.isOptimalRatio &&
              " (1:1 recommended)"}
          </div>
        </div>
        <div>
          <span className="font-medium">Format:</span>
          <div className="text-green-600">
            {processedImage.optimized
              ? "JPEG (optimized)"
              : processedImage.file.type.split("/")[1].toUpperCase()}
          </div>
        </div>
      </div>
    </div>
  );
}
