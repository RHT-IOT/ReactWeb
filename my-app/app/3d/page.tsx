"use client";

import Map3DComponent from "./three";
import MyBabylonScene from "./babylon";
import GeoJsonBabylonMap from "./bbmap";
import EchartMap from "./echart";

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
    }, []);
    return (
    <div className="page-container" style={{ paddingTop: 24 }}>
        <div className="brand-header" style={{ display: 'flex', alignItems: 'center', padding: '8px 12px' }}>
            <span className="brand-title">3D View</span>
            <a className="brand-button button-outline" style={{ marginLeft: 'auto' }} href="/login">Back to Dashboard</a>
        </div>
        <div className="panel" style={{ marginTop: 16, padding: 0 }}>
            <div style={{ width: '100%', height: '80vh' }}><Map3DComponent/></div>
        </div>
    </div>
    );
}

export default ThreeDApp;