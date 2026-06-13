import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-muted/30 px-4">
      <FileQuestion className="h-16 w-16 text-muted-foreground" />
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-semibold">Page not found</h1>
        <p className="text-muted-foreground max-w-sm">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Link href="/">
          <Button variant="outline">Home</Button>
        </Link>
        <Link href="/docs">
          <Button variant="outline">Help & docs</Button>
        </Link>
        <Link href="/login">
          <Button variant="outline">Log in</Button>
        </Link>
        <Link href="/overview">
          <Button>Dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
