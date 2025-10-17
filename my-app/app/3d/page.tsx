"use client";

import Map3DComponent from "./three";
import MyBabylonScene from "./babylon";
import GeoJsonBabylonMap from "./bbmap";
import EchartMap from "./echart";

    // src/App.js
import React from 'react';

function ThreeDApp() {
    return (
    <div>
       <div style={{ width: "100%", height: "100vh" }}><Map3DComponent/></div>
        
        <p>This is a basic React application.</p>
    </div>
    );
}

export default ThreeDApp;