import "@/styles/globals.css";
import "@/styles/base.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Sahayak - Verified Breast Cancer Information Assistant",
  description:
    "Offline multilingual voice and text assistant providing verified breast cancer FAQs in Gujarati, Hindi, and English.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
