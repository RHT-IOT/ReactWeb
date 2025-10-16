"use client";

import Map3DComponent from "./three";
import MyBabylonScene from "./babylon";
import GeoJsonBabylonMap from "./bbmap";

    // src/App.js
import React from 'react';

function ThreeDApp() {
    return (
    <div>
        <GeoJsonBabylonMap/>
        <p>This is a basic React application.</p>
    </div>
    );
}

export default ThreeDApp;