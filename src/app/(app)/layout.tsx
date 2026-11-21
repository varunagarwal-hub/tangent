import { Suspense } from "react";
import { getPersona } from "@/lib/session";
import { AppHeader } from "@/components/tangent/app-header";
import { Logo } from "@/components/brand/logo";
import { Toaster } from "@/components/ui/sonner";
import { WelcomeTour } from "@/components/tangent/welcome/welcome-tour";
import { DemoGuide } from "@/components/tangent/demo-guide/demo-guide";

async function Header() {
  const p = await getPersona();
  return <AppHeader persona={{ key: p.key, name: p.name, role: p.role }} />;
}

/** Separate boundary from the header so the guide doesn't shift the header's generated ids (hydration). */
async function Guide() {
  const p = await getPersona();
  return <DemoGuide persona={p.key} />;
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
      <Suspense fallback={null}>
        <Guide />
      </Suspense>
      <WelcomeTour />
      <Toaster position="top-center" richColors />
    </div>
  );
}
