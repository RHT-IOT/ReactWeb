"use client";
import OidcProvider from "./OidcProvider";
import "./globals.css";
import "./themes/theme-a.css";
import "./themes/theme-b.css";
import "./themes/theme-c.css";
import { usePathname } from "next/navigation";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideFooter = pathname?.startsWith("/3d");
  return (
    <html lang="en">
      <body className="theme-a mode-light">
        <OidcProvider>{children}</OidcProvider>
        {!hideFooter && (
        <footer className="footer">
          {/* Theme A footer (RHT) */}
          <div className="footer-inner footer-a footer-variant">
            <div className="footer-top">
              <div className="footer-brand-name">RHT Industries Ltd.</div>
              <nav className="footer-links">
                <a href="/about" className="footer-link">About Us</a>
                <a href="/contact" className="footer-link">Contact Us</a>
              </nav>
            </div>
            <div className="footer-contact">
              <div>© 2023 by RHT Industries Limited</div>
              <div>Wireless Centre, 208-209, 3 Science Park E Ave, Sha Tin</div>
              <div>Customer Service Hotline: (852) 3895 8488</div>
              <div>Repair Hotline: (852) 3895 8438</div>
              <div>Partnership Inquiries: (852) 2417 0075</div>
            </div>
            <div className="footer-icons">
              <a className="footer-icon" href="tel:+85238958488" aria-label="Phone">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.08 4.18 2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.72 12.94 12.94 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8 9a16 16 0 0 0 7 7l.36-.26a2 2 0 0 1 2.11-.45 12.94 12.94 0 0 0 2.81.7A2 2 0 0 1 22 16.92Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </a>
              <a className="footer-icon" href="mailto:info@rht-industries.com" aria-label="Email">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="m22 6-10 7L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </a>
              <a className="footer-icon" href="#" aria-label="YouTube">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29.16 29.16 0 0 0 1 12a29.16 29.16 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29.16 29.16 0 0 0 23 12a29.16 29.16 0 0 0-.46-5.58Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="m10 15 5-3-5-3v6Z" fill="currentColor"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Theme B footer (CMA Testing-style) */}
          <div className="footer-inner footer-b footer-variant">
            <div className="footer-heading">Hong Kong Head Office</div>
            <div className="footer-address">
              Room 1302, Yan Hing Centre, 9–13 Wong Chuk Yeung<br/>
              Street, Fo Tan, Sha Tin, N.T. Hong Kong
            </div>
            <div className="footer-contact-grid">
              <div className="contact-item">
                <svg className="contact-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.08 4.18 2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.72 12.94 12.94 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8 9a16 16 0 0 0 7 7l.36-.26a2 2 0 0 1 2.11-.45 12.94 12.94 0 0 0 2.81.7A2 2 0 0 1 22 16.92Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>(+852) 2698 8198</span>
              </div>
              <div className="contact-item">
                <svg className="contact-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M8 10h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <span>(+852) 6321 7993</span>
              </div>
              <div className="contact-item">
                <svg className="contact-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="3" y="4" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2"/>
                  <path d="M3 8h18" stroke="currentColor" strokeWidth="2"/>
                  <rect x="7" y="12" width="6" height="4" stroke="currentColor" strokeWidth="2"/>
                </svg>
                <span>(+852) 2695 4177</span>
              </div>
              <div className="contact-item">
                <svg className="contact-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="m22 6-10 7L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>info@cmatesting.org</span>
              </div>
            </div>
          </div>

          {/* Placeholder for Theme C footer (can customize later) */}
          <div className="footer-inner footer-c footer-variant">
            <div className="footer-top">
              <div className="footer-brand-name">Natsense</div>
              <nav className="footer-links">
                <a href="/about" className="footer-link">About</a>
                <a href="/contact" className="footer-link">Contact</a>
              </nav>
            </div>
            <div className="footer-contact">© 2024 Natsense. All rights reserved.</div>
          </div>
        </footer>
        )}
      </body>
    </html>
  );
}
