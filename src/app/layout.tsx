import type { Metadata } from "next";
import { Instrument_Serif, Caveat, JetBrains_Mono } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

const instrument = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});
const caveat = Caveat({ variable: "--font-caveat", subsets: ["latin"] });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Tangent — catches the moment your thinking goes off on a tangent",
  description:
    "An adaptive CAT Quant tutor that reads your rough work, finds the exact line where your thinking went off on a tangent, and rebuilds your prep around it.",
};

// Sets the theme class before paint to avoid a flash.
const themeScript = `try{var t=localStorage.getItem('tangent-theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${instrument.variable} ${caveat.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
