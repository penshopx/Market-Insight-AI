import { Link } from "wouter";
import { CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
      <div className="bg-destructive/10 p-6 rounded-full">
        <CircleAlert className="h-16 w-16 text-destructive" />
      </div>
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">404</h1>
        <p className="text-lg text-muted-foreground font-mono">SEKTOR TIDAK DITEMUKAN</p>
      </div>
      <p className="text-sm text-muted-foreground max-w-md">
        Modul yang Anda cari tidak ada atau Anda tidak memiliki akses ke area tersebut.
      </p>
      <Link href="/">
        <Button size="lg" className="mt-4">
          KEMBALI KE DASHBOARD
        </Button>
      </Link>
    </div>
  );
}
