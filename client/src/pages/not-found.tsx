import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <h1 className="text-2xl font-bold text-foreground">404 Page Not Found</h1>
          </div>

          <p className="mt-4 text-sm text-muted-foreground mb-6">
            We couldn't find the page you were looking for.
          </p>
          
          <Link href="/">
            <button className="bg-primary text-primary-foreground font-montserrat px-4 py-2 rounded text-sm">
              Return to Home Page
            </button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
