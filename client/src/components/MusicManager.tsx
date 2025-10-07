import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Music } from "lucide-react";

interface MusicManagerProps {
  onAutoLogout: (error: Error) => void;
}

const MusicManager = ({ onAutoLogout }: MusicManagerProps) => {
  const { toast } = useToast();
  const [musicUploading, setMusicUploading] = useState(false);

  const { data: musicData } = useQuery<{ musicUrl: string }>({
    queryKey: ['/api/settings/music'],
    retry: (failureCount, error) => {
      if (error.message.includes("401") || error.message.includes("Unauthorized")) {
        onAutoLogout(error);
        return false;
      }
      return failureCount < 3;
    },
  });

  const musicUploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await apiRequest('POST', '/api/admin/settings/music-upload', formData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings/music'] });
      setMusicUploading(false);
      toast({
        title: "Success",
        description: "Background music uploaded successfully",
      });
    },
    onError: (error: Error) => {
      setMusicUploading(false);
      onAutoLogout(error);
      toast({
        title: "Error",
        description: `Failed to upload music: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const handleMusicUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
      toast({
        title: "Error",
        description: "Please select a valid audio file",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "File size must be less than 20MB",
        variant: "destructive",
      });
      return;
    }

    setMusicUploading(true);
    musicUploadMutation.mutate(file);
  };

  return (
    <div className="space-y-6">
      <div className="border rounded-lg p-4 bg-gray-50">
        <h3 className="font-semibold mb-2">Current Background Music</h3>
        <audio 
          controls 
          className="w-full"
          src={musicData?.musicUrl || '/music/wedding-piano.mp3'}
          data-testid="audio-preview"
        >
          Your browser does not support the audio element.
        </audio>
      </div>

      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-2">
            <Music className="h-12 w-12 text-gray-400" />
            <h3 className="font-semibold text-lg">Upload New Music</h3>
            <p className="text-sm text-gray-600 text-center">
              Supported formats: MP3, WAV, OGG (max 20MB)
            </p>
          </div>
          <div className="flex flex-col items-center gap-3">
            <input
              type="file"
              accept="audio/*"
              id="music-upload"
              className="hidden"
              data-testid="input-music-file"
              onChange={handleMusicUpload}
            />
            <Button
              asChild
              className="w-full sm:w-auto"
              data-testid="button-upload-music"
            >
              <label htmlFor="music-upload" className="cursor-pointer">
                Choose Music File
              </label>
            </Button>
            {musicUploading && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading music...
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-blue-50 p-4 rounded-lg">
        <h4 className="font-semibold text-sm text-blue-900 mb-2">Tips:</h4>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>Choose a song that reflects your wedding theme</li>
          <li>Keep volume moderate for better user experience</li>
          <li>Consider instrumental or soft music</li>
          <li>Test the music on different devices</li>
        </ul>
      </div>
    </div>
  );
};

export default MusicManager;
