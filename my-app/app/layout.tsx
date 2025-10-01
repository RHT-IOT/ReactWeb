import OidcProvider from "./OidcProvider";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <OidcProvider>{children}</OidcProvider>
      </body>
    </html>
  );
}
