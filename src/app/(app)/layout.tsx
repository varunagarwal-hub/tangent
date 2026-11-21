import { Suspense } from "react";
import { getPersona } from "@/lib/session";
import { AppHeader } from "@/components/tangent/app-header";
import { Logo } from "@/components/brand/logo";

async function Header() {
  const p = await getPersona();
  return <AppHeader persona={{ key: p.key, name: p.name, role: p.role }} />;
}

function HeaderFallback() {
  return (
    <div className="mx-auto flex h-14 w-full max-w-6xl items-center px-4">
      <Logo />
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Suspense fallback={<HeaderFallback />}>
        <Header />
      </Suspense>
      <main className="mx-auto w-full max-w-6xl flex-1 overflow-x-clip px-4 pb-24 pt-6 sm:pt-8">{children}</main>
    </div>
  );
}
