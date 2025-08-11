import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Copy, ExternalLink, AlertTriangle, CheckCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GoogleDriveInstructions() {
  const [currentDomain, setCurrentDomain] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Get the current domain from the browser
    setCurrentDomain(window.location.origin);
  }, []);

  const redirectUri = `${currentDomain}/auth/google/callback`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 to-pink-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">Google Drive OAuth Setup Instructions</h1>
          <p className="text-gray-600">Follow these steps to fix the redirect URI mismatch error</p>
        </div>

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Getting "app is currently being tested" error?</strong> This means you need to add yourself as a test user in Google Cloud Console OAuth consent screen.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-blue-600" />
              Current App Information
            </CardTitle>
            <CardDescription>
              This information is auto-detected from your current environment
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Your App Domain:</label>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-sm px-3 py-1">
                  {currentDomain || "Loading..."}
                </Badge>
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Required Redirect URI:</label>
              <div className="flex items-center gap-2">
                <code className="bg-gray-100 p-2 rounded flex-1 text-sm break-all">
                  {redirectUri}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(redirectUri)}
                  className="shrink-0"
                >
                  {copied ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copied!" : "Copy"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Fix Error 403: access_denied
            </CardTitle>
            <CardDescription>
              If you're getting "access_denied" error, follow these steps to fix OAuth permissions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Badge className="bg-red-100 text-red-800 shrink-0">1</Badge>
                <div>
                  <h3 className="font-semibold">Go to OAuth Consent Screen</h3>
                  <p className="text-sm text-gray-600 mb-2">Click this direct link to open the OAuth consent screen:</p>
                  <Button asChild variant="outline" size="sm" className="mb-2">
                    <a href="https://console.cloud.google.com/apis/credentials/consent" target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open OAuth Consent Screen
                    </a>
                  </Button>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>• Set User Type to "External" (unless you have G Suite)</p>
                    <p>• Fill in required fields: App name, User support email, Developer contact</p>
                    <p>• Save and continue through the scopes (you can skip optional scopes)</p>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Badge className="bg-red-100 text-red-800 shrink-0">2</Badge>
                <div>
                  <h3 className="font-semibold">⚠️ CRITICAL: Add Yourself as Test User</h3>
                  <p className="text-sm text-gray-600 mb-2">This fixes the "app is currently being tested" error:</p>
                  <div className="bg-yellow-50 border border-yellow-200 p-3 rounded mb-2">
                    <p className="text-sm font-medium">In the OAuth consent screen, scroll down to "Test users" section:</p>
                    <div className="text-sm space-y-1 mt-1">
                      <p>1. Click "ADD USERS" button</p>
                      <p>2. Enter your Google account email (the one you're trying to authorize with)</p>
                      <p>3. Click "Save" - this is essential!</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">Without this step, you'll get the "app is currently being tested" error</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Badge className="bg-red-100 text-red-800 shrink-0">3</Badge>
                <div>
                  <h3 className="font-semibold">Verify Required Scopes</h3>
                  <p className="text-sm text-gray-600 mb-2">Make sure these scopes are enabled:</p>
                  <div className="bg-gray-50 p-2 rounded text-sm font-mono">
                    https://www.googleapis.com/auth/drive.file
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Badge className="bg-green-100 text-green-800 shrink-0">4</Badge>
                <div>
                  <h3 className="font-semibold">Try OAuth Again</h3>
                  <p className="text-sm text-gray-600 mb-2">After adding yourself as a test user, try the authorization flow again:</p>
                  <Button asChild variant="outline" size="sm">
                    <a href="/google-drive-setup" target="_blank" rel="noopener noreferrer">
                      Go to OAuth Setup Page
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ExternalLink className="h-5 w-5 text-green-600" />
              Fix Redirect URI Mismatch
            </CardTitle>
            <CardDescription>
              If you're getting redirect_uri_mismatch error, follow these steps
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Badge className="bg-blue-100 text-blue-800 shrink-0">1</Badge>
                <div>
                  <h3 className="font-semibold">Go to Google Cloud Console</h3>
                  <p className="text-sm text-gray-600 mb-2">Open the Google Cloud Console where you created your OAuth application</p>
                  <Button asChild variant="outline" size="sm">
                    <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open Google Cloud Console
                    </a>
                  </Button>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Badge className="bg-blue-100 text-blue-800 shrink-0">2</Badge>
                <div>
                  <h3 className="font-semibold">Select Your Project</h3>
                  <p className="text-sm text-gray-600">Make sure you're in the correct Google Cloud project where you created the OAuth credentials</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Badge className="bg-blue-100 text-blue-800 shrink-0">3</Badge>
                <div>
                  <h3 className="font-semibold">Find Your OAuth 2.0 Client ID</h3>
                  <p className="text-sm text-gray-600">In the Credentials page, click on your OAuth 2.0 Client ID (the one you're using for this app)</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Badge className="bg-blue-100 text-blue-800 shrink-0">4</Badge>
                <div>
                  <h3 className="font-semibold">Add Authorized Redirect URI</h3>
                  <p className="text-sm text-gray-600 mb-2">In the "Authorized redirect URIs" section, add this exact URL:</p>
                  <div className="bg-yellow-50 border border-yellow-200 p-3 rounded">
                    <code className="text-sm font-mono break-all">{redirectUri}</code>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">⚠️ The URL must match exactly, including https:// and the path</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Badge className="bg-blue-100 text-blue-800 shrink-0">5</Badge>
                <div>
                  <h3 className="font-semibold">Save Changes</h3>
                  <p className="text-sm text-gray-600">Click "Save" to update your OAuth configuration</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Badge className="bg-green-100 text-green-800 shrink-0">6</Badge>
                <div>
                  <h3 className="font-semibold">Try OAuth Setup Again</h3>
                  <p className="text-sm text-gray-600 mb-2">Return to your admin dashboard and try the Google Drive setup again</p>
                  <Button asChild variant="outline" size="sm">
                    <a href="/admin" target="_blank" rel="noopener noreferrer">
                      Go to Admin Dashboard
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-orange-600">Alternative: Set Custom Redirect URI</CardTitle>
            <CardDescription>
              If you prefer to use your own domain, you can set a custom redirect URI
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              You can set the <code className="bg-gray-100 px-1 py-0.5 rounded">GOOGLE_REDIRECT_URI</code> environment 
              variable to any URL you prefer, as long as it's also configured in Google Cloud Console.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}