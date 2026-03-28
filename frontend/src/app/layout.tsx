import type { Metadata } from "next"
import "./globals.css"
import { Providers } from "@/components/providers"

export const metadata: Metadata = {
  title: "Luna Estimator | AI-Powered Construction Estimates",
  description: "Professional drywall and paint estimation powered by AI. Upload photos, get detailed material takeoffs and cost estimates in minutes.",
  icons: {
    icon: [
      {
        url: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%2300d4ff'/><text y='.9em' font-size='70' x='50%' text-anchor='middle' dominant-baseline='middle' dy='.1em' fill='white' font-family='system-ui' font-weight='bold'>L</text></svg>",
        type: "image/svg+xml",
      },
    ],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-[#0a0e1a] text-white min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
