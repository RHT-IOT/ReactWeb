// Map3DComponent.jsx
import React, { useState, useEffect, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import * as d3 from "d3-geo";

const projection = d3.geoMercator().scale(400).translate([0, 0]);

function coordsToShape(coords) {
  const shape = new THREE.Shape();
  coords.forEach(([lng, lat], i) => {
    const [x, y] = projection([lng, lat]);
    if (i === 0) shape.moveTo(x, -y);
    else shape.lineTo(x, -y);
  });
  return shape;
}

function getShapes(feature) {
  const shapes = [];
  if (feature.geometry.type === "Polygon") {
    shapes.push(coordsToShape(feature.geometry.coordinates[0]));
  } else if (feature.geometry.type === "MultiPolygon") {
    feature.geometry.coordinates.forEach(polygon => {
      shapes.push(coordsToShape(polygon[0]));
    });
  }
  return shapes;
}

function Region({ feature, onClick, isSelected }) {
  const geometries = useMemo(() => {
    return getShapes(feature).map(
      shape =>
        new THREE.ExtrudeGeometry(shape, {
          depth: 5, // thickness in Z
          bevelEnabled: false
        })
    );
  }, [feature]);

  const [hovered, setHovered] = useState(false);

  return geometries.map((geometry, idx) => (
    <mesh
      key={idx}
      geometry={geometry}
      onClick={() => onClick(feature)}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <meshStandardMaterial
        color={isSelected ? "red" : hovered ? "orange" : "lightgray"}
        side={THREE.DoubleSide}
      />
    </mesh>
  ));
}

function MapScene({ geojson }) {
  const [selected, setSelected] = useState(null);
  return (
    <>
      {geojson.features.map((feature, i) => (
        <Region
          key={i}
          feature={feature}
          onClick={setSelected}
          isSelected={selected?.properties?.name === feature.properties.name}
        />
      ))}
    </>
  );
}

export default function Map3DComponent() {
  const [geojson, setGeojson] = useState(null);

  useEffect(() => {
    fetch("/3dmodel/China.json") // file in public/3dmodel/
      .then(res => res.json())
      .then(setGeojson);
  }, []);

  if (!geojson) return <div>Loading…</div>;

  return (
    <div style={{ width: "100%", height: "100vh" }}>
    <Canvas camera={{ position: [1500, 500, 800], fov: 45 }}>
      <ambientLight intensity={0.5} />
      <directionalLight position={[100, 100, 200]} intensity={0.8} />
      <MapScene geojson={geojson} />
      <OrbitControls />
    </Canvas>
    </div>
  );
}
