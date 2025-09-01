import type { Metadata } from "next";
import "@/app/globals.css";
import { TRPCProvider } from "./lib/trpc-client";

export const metadata: Metadata = {
  title: "worse4everyone",
  description: "Is it worse for everyone or just me?",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <TRPCProvider>{children}</TRPCProvider>
      </body>
    </html>
  );
}
