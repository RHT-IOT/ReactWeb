"use client";

import Map3DComponent from "./three";
// import MyBabylonScene from "./babylon";
// import GeoJsonBabylonMap from "./bbmap";
// import EchartMap from "./echart";

// src/App.js
import React, { useEffect } from 'react';

function ThreeDApp() {
    // Apply saved theme and mode so background matches other pages
    useEffect(() => {
        const savedTheme = (typeof window !== 'undefined' && localStorage.getItem('theme-name')) as 'theme-a' | 'theme-b' | 'theme-c' | null;
        const savedMode = (typeof window !== 'undefined' && localStorage.getItem('mode-name')) as 'mode-light' | 'mode-dark' | null;
        const cls = document.body.classList;
        cls.remove('theme-a', 'theme-b', 'theme-c', 'mode-light', 'mode-dark');
        cls.add(savedTheme || 'theme-a');
        cls.add(savedMode || 'mode-light');
        cls.add('no-footer');
        return () => { cls.remove('no-footer'); };
    }, []);
    return (
      <div style={{ position: 'fixed', inset: 0, height: '100svh' }}>
        <Map3DComponent />
      </div>
    );
}

export default ThreeDApp;
