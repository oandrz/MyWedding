package service

import (
	"bytes"
	"image"
	"image/jpeg"
	"strings"

	// Register decoders for common formats
	_ "image/gif"
	_ "image/png"

	"github.com/disintegration/imaging"
)

// OptimizedImage holds the result of thumbnail generation.
type OptimizedImage struct {
	ThumbnailBuffer      []byte
	ThumbnailContentType string
}

// OptimizeImage generates a thumbnail from the input image buffer.
// Default: 600px width, JPEG quality 80.
func OptimizeImage(data []byte, width int, quality int) (*OptimizedImage, error) {
	if width == 0 {
		width = 600
	}
	if quality == 0 {
		quality = 80
	}

	src, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, err
	}

	// Resize to width, maintain aspect ratio, don't enlarge
	bounds := src.Bounds()
	if bounds.Dx() <= width {
		width = bounds.Dx()
	}

	thumb := imaging.Resize(src, width, 0, imaging.Lanczos)

	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, thumb, &jpeg.Options{Quality: quality}); err != nil {
		return nil, err
	}

	return &OptimizedImage{
		ThumbnailBuffer:      buf.Bytes(),
		ThumbnailContentType: "image/jpeg",
	}, nil
}

// GenerateThumbnailFilename creates a thumbnail filename from the original.
func GenerateThumbnailFilename(original string) string {
	lastDot := strings.LastIndex(original, ".")
	if lastDot > 0 {
		return original[:lastDot] + "-thumb.jpg"
	}
	return original + "-thumb.jpg"
}
