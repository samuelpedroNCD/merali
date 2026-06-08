import type { Metadata } from "next";
import "./globals.css";
import { cormorant, hanken } from "@/lib/fonts";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: "Merali Lettings",
  description: "Property operations platform — run the entire rental lifecycle in one place.",
};

// Set the persisted theme class before first paint to avoid a flash.
const themeBootstrap = `(function(){try{var t=localStorage.getItem('merali-theme')||'light';document.documentElement.classList.add(t==='dark'?'theme-dark':'theme-light');}catch(e){document.documentElement.classList.add('theme-light');}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${cormorant.variable} ${hanken.variable} h-full`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="min-h-full">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
