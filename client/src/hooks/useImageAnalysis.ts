import { useState, useCallback } from "react";

export interface ImageAnalysis {
  width: number;
  height: number;
  aspectRatio: number;
  fileSize: number;
  recommendedRatio: number;
  isOptimalSize: boolean;
  isOptimalRatio: boolean;
  needsCompression: boolean;
}

export interface ProcessedImage {
  file: File;
  analysis: ImageAnalysis;
  optimized?: boolean;
}

type ImageType = "banner" | "gallery" | "bride-profile" | "groom-profile" | "verse-image";

interface OptimizationTargets {
  maxFileSize: number;
  recommendedRatio: number;
  optimalDimensions: Array<{ width: number; height: number }>;
}

function getOptimizationTargets(imageType: ImageType): OptimizationTargets {
  if (imageType === "banner") {
    return {
      maxFileSize: 200 * 1024, // 200KB
      recommendedRatio: 16 / 9,
      optimalDimensions: [
        { width: 1920, height: 1080 },
        { width: 1600, height: 900 },
        { width: 1280, height: 720 },
      ],
    };
  } else if (imageType === "bride-profile" || imageType === "groom-profile") {
    return {
      maxFileSize: 120 * 1024, // 120KB (smaller for profile pics)
      recommendedRatio: 1, // Square 1:1 for circular display
      optimalDimensions: [
        { width: 500, height: 500 },
        { width: 600, height: 600 },
        { width: 800, height: 800 },
      ],
    };
  } else {
    return {
      maxFileSize: 150 * 1024, // 150KB
      recommendedRatio: 1, // Square 1:1
      optimalDimensions: [
        { width: 1080, height: 1080 },
        { width: 1080, height: 1350 },
        { width: 1350, height: 1080 },
      ],
    };
  }
}

function analyzeImage(file: File, imageType: ImageType): Promise<ImageAnalysis> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const targets = getOptimizationTargets(imageType);
      const aspectRatio = img.width / img.height;
      const ratioTolerance = 0.1;

      const analysis: ImageAnalysis = {
        width: img.width,
        height: img.height,
        aspectRatio,
        fileSize: file.size,
        recommendedRatio: targets.recommendedRatio,
        isOptimalSize: file.size <= targets.maxFileSize,
        isOptimalRatio:
          Math.abs(aspectRatio - targets.recommendedRatio) <= ratioTolerance,
        needsCompression: file.size > targets.maxFileSize,
      };

      resolve(analysis);
    };

    img.src = url;
  });
}

function compressImage(file: File, quality: number = 0.8): Promise<File> {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      // Set canvas dimensions
      canvas.width = img.width;
      canvas.height = img.height;

      // Draw image on canvas
      ctx.drawImage(img, 0, 0);

      // Convert to blob with compression
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, {
              type: "image/jpeg", // Convert to JPEG for better compression
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          } else {
            resolve(file); // Fallback to original
          }
        },
        "image/jpeg",
        quality
      );
    };

    img.src = url;
  });
}

interface UseImageAnalysisResult {
  processedImage: ProcessedImage | null;
  isProcessing: boolean;
  optimizeImage: (file: File) => Promise<ProcessedImage>;
  clearProcessedImage: () => void;
}

export function useImageAnalysis(imageType: ImageType): UseImageAnalysisResult {
  const [processedImage, setProcessedImage] = useState<ProcessedImage | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const optimizeImage = useCallback(
    async (file: File): Promise<ProcessedImage> => {
      setIsProcessing(true);

      try {
        const analysis = await analyzeImage(file, imageType);
        let optimizedFile = file;
        let optimized = false;

        // Compress if needed
        if (analysis.needsCompression) {
          const targets = getOptimizationTargets(imageType);

          // Try different quality levels
          let quality = 0.8;
          for (let attempt = 0; attempt < 3; attempt++) {
            optimizedFile = await compressImage(file, quality);
            if (optimizedFile.size <= targets.maxFileSize) break;
            quality -= 0.2;
          }

          optimized = optimizedFile.size < file.size;
        }

        const finalAnalysis =
          optimizedFile !== file
            ? await analyzeImage(optimizedFile, imageType)
            : analysis;

        const result: ProcessedImage = {
          file: optimizedFile,
          analysis: finalAnalysis,
          optimized,
        };

        setProcessedImage(result);
        return result;
      } finally {
        setIsProcessing(false);
      }
    },
    [imageType]
  );

  const clearProcessedImage = useCallback(() => {
    setProcessedImage(null);
  }, []);

  return {
    processedImage,
    isProcessing,
    optimizeImage,
    clearProcessedImage,
  };
}
