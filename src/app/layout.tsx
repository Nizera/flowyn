import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { GlobalPixels } from "@/components/GlobalPixels";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  style: ["italic"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Flowyn — Checkout para infoprodutores com custo previsivel",
  description: "Venda infoprodutos com checkout transparente, entrega automatica, recebimento via Asaas e taxa Flowyn zero por venda. R$ 49/mes fixo.",
  icons: {
    icon: [
      { url: "/brand/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/brand/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/favicon.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/brand/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${playfair.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <GlobalPixels />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
