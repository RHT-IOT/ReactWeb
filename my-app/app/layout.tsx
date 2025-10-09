import OidcProvider from "./OidcProvider";
import "./globals.css";
import "./themes/theme-a.css";
import "./themes/theme-b.css";
import "./themes/theme-c.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="theme-a mode-light">
        <OidcProvider>{children}</OidcProvider>
      </body>
    </html>
  );
}
