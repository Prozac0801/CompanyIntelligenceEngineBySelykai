import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import "./auth-workspace.css";
import "./intelligence-v03.css";
import "./intelligence-v04.css";
import "./intelligence-v041.css";
import "./premium-ui.css";
import { getSiteUrl } from "@/lib/site-config";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: {
    default: "Selykai — Company Intelligence",
    template: "%s · Selykai",
  },
  description:
    "Comprenez une entreprise avant de la contacter grâce à une intelligence multi-source, sourcée et explicable.",
  applicationName: "Selykai",
  category: "technology",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: "/",
    siteName: "Selykai",
    title: "Selykai — Company Intelligence",
    description:
      "Faits, signaux, momentum et prochaine action : l’intelligence entreprise sourcée pour décider avec confiance.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Selykai — Company Intelligence",
    description:
      "Comprenez une entreprise avant de la contacter grâce à une intelligence multi-source et explicable.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="fr">
      <body className={`${jakarta.variable} ${mono.variable}`}>{children}</body>
    </html>
  );
}
