import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

interface UploadSheetProps {
  open: boolean;
  onClose: () => void;
}

const UploadSheet = ({ open, onClose }: UploadSheetProps) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [guestName, setGuestName] = useState("");
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files[0]) handleFiles(e.dataTransfer.files);
  };

  const handleFiles = (files: FileList) => {
    setSelectedFiles(Array.from(files).slice(0, 10));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;
    setUploading(true);
    const formData = new FormData();
    selectedFiles.forEach((f) => formData.append("files", f));
    if (guestName.trim()) formData.append("guestName", guestName.trim());

    try {
      const res = await fetch("/api/upload-to-drive", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const result = await res.json();
      toast({
        title: "Photos shared! ❤️",
        description: `Shared ${result.successCount} photo(s) to the wedding memories`,
      });
      setSelectedFiles([]);
      setGuestName("");
      onClose();
    } catch {
      toast({
        title: "Upload failed",
        description: "Couldn't share your photos. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" data-testid="upload-sheet">
      <div
        className="absolute inset-0 bg-black/50"
        data-testid="upload-sheet-backdrop"
        onClick={onClose}
      />
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl p-6 max-h-[85vh] overflow-y-auto shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Share Your Photos</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-gray-500 hover:text-gray-700 text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <Input
          placeholder="Your name (optional)"
          value={guestName}
          onChange={(e) => setGuestName(e.target.value)}
          className="mb-4"
        />

        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
            dragActive
              ? "border-rose-400 bg-rose-50"
              : "border-gray-300 hover:border-rose-300 hover:bg-gray-50"
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*"
            className="hidden"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
          {selectedFiles.length > 0 ? (
            <div>
              <p className="font-medium text-gray-900">
                {selectedFiles.length} file(s) ready
              </p>
              {selectedFiles.slice(0, 3).map((f, i) => (
                <p key={i} className="text-sm text-gray-500">
                  {f.name}
                </p>
              ))}
              {selectedFiles.length > 3 && (
                <p className="text-sm text-gray-500">
                  ...and {selectedFiles.length - 3} more
                </p>
              )}
            </div>
          ) : (
            <div>
              <p className="text-gray-600 mb-3">
                Drop photos here or click to browse
              </p>
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                Choose Photos
              </Button>
            </div>
          )}
        </div>

        {selectedFiles.length > 0 && (
          <Button
            onClick={handleUpload}
            disabled={uploading}
            className="mt-4 w-full bg-rose-500 hover:bg-rose-600"
          >
            {uploading
              ? "Sharing..."
              : `Share ${selectedFiles.length} Photo${selectedFiles.length !== 1 ? "s" : ""}`}
          </Button>
        )}
      </div>
    </div>
  );
};

export default UploadSheet;
