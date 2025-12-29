// App.js
"use client";
import Image from 'next/image';
import { asset } from './lib/asset';
import { useEffect, useState, useMemo } from "react";
import { useAuth } from "react-oidc-context";


function App() {
  const auth = useAuth();
  // Theme state
  const [theme, setTheme] = useState<'theme-a' | 'theme-b' | 'theme-c'>('theme-b');
  const [logoSrc, setLogoSrc] = useState(asset('/logos/logo1.png'));
  const [mode, setMode] = useState<'mode-light' | 'mode-dark'>('mode-light');
  // Dynamic brand title per theme
  const brandTitle = theme === 'theme-a' ? 'RHT Limited' : theme === 'theme-b' ? 'CMA testing' : 'Natsense';

  // Initialize theme & mode from localStorage and apply to body
  useEffect(() => {
    const savedTheme = (typeof window !== 'undefined' && localStorage.getItem('theme-name')) as 'theme-a' | 'theme-b' | 'theme-c' | null;
    const themeToApply = savedTheme || 'theme-a';
    setTheme(themeToApply);
    const logoIndex = themeToApply === 'theme-a' ? 1 : themeToApply === 'theme-b' ? 2 : 3;
    setLogoSrc(asset(`/logos/logo${logoIndex}.png`));

    const savedMode = (typeof window !== 'undefined' && localStorage.getItem('mode-name')) as 'mode-light' | 'mode-dark' | null;
    const modeToApply = savedMode || 'mode-light';
    setMode(modeToApply);

    const cls = document.body.classList;
    cls.remove('theme-a', 'theme-b', 'theme-c', 'mode-light', 'mode-dark');
    cls.add(themeToApply);
    cls.add(modeToApply);
  }, []);

  const handleThemeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as 'theme-a' | 'theme-b' | 'theme-c';
    setTheme(value);
    localStorage.setItem('theme-name', value);
    const logoIndex = value === 'theme-a' ? 1 : value === 'theme-b' ? 2 : 3;
    setLogoSrc(asset(`/logos/logo${logoIndex}.png`));
    const cls = document.body.classList;
    cls.remove('theme-a', 'theme-b', 'theme-c');
    cls.add(value);
  };
  const handleModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as 'mode-light' | 'mode-dark';
    setMode(value);
    localStorage.setItem('mode-name', value);
    const cls = document.body.classList;
    cls.remove('mode-light', 'mode-dark');
    cls.add(value);
  };
 
    
  if (auth.isLoading) {
    return <div>Loading...</div>;
  }

  if (auth.error) {
    return <div>Encountering error... {auth.error.message}</div>;
  }
  if (auth.isAuthenticated) {
    if (typeof window !== 'undefined') {
      window.location.replace('/login');
    }
    return <div>Redirecting to dashboard...</div>;
  }

  return (
    <div className="page-container" style={{ paddingTop: 24 }}>
      <div className="brand-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Image src={logoSrc} alt="Company Logo" width={36} height={36} onError={(e) => { (e.currentTarget as HTMLImageElement).src = asset('/next.svg'); }} />
          <span className="brand-title">{brandTitle}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {/* <select value={theme} onChange={handleThemeChange} className="brand-select">
            <option value="theme-a">Theme A</option>
            <option value="theme-b">Theme B</option>
            <option value="theme-c">Theme C</option>
          </select> */}
          <select value={mode} onChange={handleModeChange} className="brand-select">
            <option value="mode-light">Light</option>
            <option value="mode-dark">Dark</option>
          </select>
        </div>
      </div>

      <section className="hero">
        <h1 className="hero-title">{brandTitle}</h1>
        <div className="hero-actions"> 
          <img
            src={asset('/companyPhoto/RHT2.avif')}
            alt="Company Photo RHT2"
            style={{ width: 'auto', maxWidth: '100%', height: 'auto', display: 'block', margin: '0 auto' }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = asset('/next.svg'); }}
          />
          <img
            src={asset('/companyPhoto/RHT1.avif')}
            alt="Company Photo RHT1"
            style={{ width: 'auto', maxWidth: '100%', height: 'auto', display: 'block', margin: '0 auto' }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = asset('/next.svg'); }}
          />
        </div>
        <p className="hero-subtitle">Sign in to view dashboards, filter data, and export CSV.</p>
        <div className="hero-actions"> 
          <button className="brand-button" onClick={() => auth.signinRedirect()}>Sign in</button>
        </div>
      </section>
    </div>
  );
}

export default App;
