import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ExternalLink, CheckCircle, AlertCircle } from "lucide-react";

export default function GoogleDriveSetup() {
  const [authUrl, setAuthUrl] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const getAuthUrl = async () => {
    setLoading(true);
    setError("");
    
    try {
      const response = await fetch("/api/google-auth-url");
      const data = await response.json();
      
      if (response.ok) {
        setAuthUrl(data.authUrl);
      } else {
        setError(data.message || "Failed to get authorization URL");
      }
    } catch (err) {
      setError("Network error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 to-pink-50 p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">Google Drive Setup</h1>
          <p className="text-gray-600">Connect your Google Drive to enable photo uploads</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ExternalLink className="h-5 w-5" />
              Authorization Required
            </CardTitle>
            <CardDescription>
              To enable Google Drive integration, you need to authorize this application to access your Google Drive account.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This is a one-time setup. After authorization, wedding guests will be able to upload photos directly to your Google Drive.
              </AlertDescription>
            </Alert>

            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Getting OAuth errors?</strong> Common issues include redirect URI mismatch and access denied (403).{" "}
                <a href="/google-drive-instructions" target="_blank" rel="noopener noreferrer" className="underline font-medium">
                  Click here for detailed troubleshooting guide
                </a>
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              <h3 className="font-semibold">Setup Steps:</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
                <li>Click "Get Authorization URL" below</li>
                <li>Click the generated link to open Google's authorization page</li>
                <li>Sign in with your Google account and grant permissions</li>
                <li>You'll be redirected back with a success message</li>
                <li>The system will provide you with a refresh token to save</li>
              </ol>
            </div>

            <div className="space-y-3">
              <Button 
                onClick={getAuthUrl} 
                disabled={loading}
                className="w-full"
              >
                {loading ? "Getting Authorization URL..." : "Get Authorization URL"}
              </Button>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {authUrl && (
                <div className="space-y-3">
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      Authorization URL generated successfully! Click the link below to proceed.
                    </AlertDescription>
                  </Alert>
                  
                  <Button asChild className="w-full">
                    <a href={authUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Authorize Google Drive Access
                    </a>
                  </Button>

                  <p className="text-xs text-gray-500 text-center">
                    This will open in a new tab. After authorization, you'll get instructions to complete the setup.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>After Authorization</CardTitle>
            <CardDescription>
              Once you complete the authorization, you'll need to add the refresh token to your environment variables.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              The authorization callback will provide you with a <code className="bg-gray-100 px-1 py-0.5 rounded">GOOGLE_REFRESH_TOKEN</code> that needs to be added to your environment variables. After adding it, restart the application to enable Google Drive uploads.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}