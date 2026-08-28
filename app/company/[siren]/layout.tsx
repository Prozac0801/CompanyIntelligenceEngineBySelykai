import { Suspense, type ReactNode } from "react";
import { CompanyWatchDock } from "./company-watch-dock";

export default async function CompanyLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ siren: string }>;
}) {
  const { siren } = await params;
  if (!/^\d{9}$/.test(siren)) return children;

  return (
    <>
      {children}
      <Suspense fallback={null}>
        <CompanyWatchDock siren={siren} />
      </Suspense>
    </>
  );
}
