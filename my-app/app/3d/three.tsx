"use client";
// Map3DComponent.jsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Html, useGLTF } from "@react-three/drei";
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

function FurnitureModel({ position = [0, 0, 10], scale = 0.08 }) {
  const gltf: any = useGLTF("/3dmodel/Furniture.glb");
  return <primitive object={gltf.scene} position={position as any} scale={scale as any} />;
}
// Optionally preload to avoid a slight delay on first click
// (safe to leave as a comment if not desired)
// (useGLTF as any).preload?.("/3dmodel/Furniture.glb");

function Region({ feature, onClick, isSelected, onSelectName }) {
  const shapes = useMemo(() => getShapes(feature), [feature]);
  const geometries = useMemo(() => {
    return shapes.map(
      shape =>
        new THREE.ExtrudeGeometry(shape, {
          depth: 5, // thickness in Z
          bevelEnabled: false
        })
    );
  }, [shapes]);

  // White border lines for region outline (top face)
  const borders = useMemo(() => {
    return shapes.map(shape => {
      const pts = shape.getPoints(256);
      const vecs = pts.map(p => new THREE.Vector3(p.x, p.y, 5.05));
      if (vecs.length > 0) vecs.push(vecs[0].clone()); // close loop
      const g = new THREE.BufferGeometry();
      g.setFromPoints(vecs);
      return g;
    });
  }, [shapes]);

  const labelPos = useMemo(() => {
    let pos = new THREE.Vector3(0, 0, 6);
    let largestArea = -Infinity;
    geometries.forEach(geo => {
      geo.computeBoundingBox();
      const bb = geo.boundingBox;
      if (!bb) return;
      const area = (bb.max.x - bb.min.x) * (bb.max.y - bb.min.y);
      const center = new THREE.Vector3();
      bb.getCenter(center);
      if (area > largestArea) {
        largestArea = area;
        pos = new THREE.Vector3(center.x, center.y, 6);
      }
    });
    return pos;
  }, [geometries]);

  const [hovered, setHovered] = useState(false);

  return (
    <group>
      {geometries.map((geometry, idx) => (
        <mesh
          key={idx}
          geometry={geometry}
          onClick={() => { onClick?.(feature); onSelectName?.(feature.properties?.name ?? "Unknown"); }}
          onPointerOver={() => setHovered(true)}
          onPointerOut={() => setHovered(false)}
        >
          <meshStandardMaterial
            color={isSelected ? "rgb(27, 194, 63)" : hovered ? "rgb(29, 88, 175)" : "rgb(37, 158, 206)"}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
      {borders.map((borderGeom, idx) => (
        <line key={`border-${idx}`} geometry={borderGeom} raycast={null}>
          <lineBasicMaterial color="white" />
        </line>
      ))}
      {(hovered || isSelected) && (
        <Html
          center
          position={[labelPos.x, labelPos.y, labelPos.z]}
          style={{
            font: "12px/1.2 system-ui",
            color: "#fff",
            background: "rgba(0,0,0,0.6)",
            padding: "2px 6px",
            borderRadius: "4px",
            pointerEvents: "none",
            whiteSpace: "nowrap"
          }}
        >
          {feature.properties?.name ?? "Unnamed"}
        </Html>
      )}
    </group>
  );
}

function Marker({ name, lngLat, onSelectName, onClearSelection, isSelected, radius = 3 }) {
  const [hovered, setHovered] = useState(false);
  const [x, y] = useMemo(() => projection(lngLat), [lngLat]);
  return (
    <group position={[x, -y, 5]}>
      <mesh
        onClick={(e) => { e.stopPropagation(); onSelectName?.(name); }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
        onPointerOut={(e) => { e.stopPropagation(); setHovered(false); }}
      >
        <sphereGeometry args={[radius, 32, 32]} />
        <meshStandardMaterial
          color={isSelected ? "rgb(250, 148, 53)" : hovered ? "rgb(194, 60, 60)" : "rgb(255, 0, 0)"}
          side={THREE.DoubleSide}
        />
      </mesh>
      {hovered && (
        <Html
          center
          position={[0, 0, 1]}
          style={{
            font: "12px/1.2 system-ui",
            color: "#fff",
            background: "rgba(0,0,0,0.6)",
            padding: "2px 6px",
            borderRadius: "4px",
            pointerEvents: "none",
            whiteSpace: "nowrap"
          }}
        >
          {name}
        </Html>
      )}
      {/* In detail mode we render furniture separately; keep marker simple */}
    </group>
  );
}

function Markers({ onSelectName, onClearSelection, selectedName }) {
  const [radius, setRadius] = useState(3);
  const points = useMemo(() => {
    const hkNames = new Set(["Hong Kong", "CMA", "HKSTP"]);
    const moNames = new Set(["Macau", "BOCDSS", "BOCYH"]);
    if (hkNames.has(selectedName)) {
      return [
        { name: "CMA", lngLat: [114.1899591, 22.3975198] },
        { name: "HKSTP", lngLat: [114.2143757, 22.424446] }
      ];
    }
    if (moNames.has(selectedName)) {
      return [
        { name: "BOCDSS", lngLat: [113.5430407, 22.202699] },
        { name: "BOCYH", lngLat: [113.5467654, 22.2109068] }
      ];
    }
    return [
      { name: "Hong Kong", lngLat: [114.1694, 22.3193] },
      { name: "Macau", lngLat: [113.5439, 22.1987] }
    ];
  }, [selectedName]);

  return (
    <group>
      {points.map(p => (
        <Marker
          key={p.name}
          name={p.name}
          lngLat={p.lngLat}
          onSelectName={onSelectName}
          onClearSelection={onClearSelection}
          isSelected={selectedName === p.name}
          radius={selectedName === "Hong Kong" ? 0.07 : selectedName === "Macau" ? 0.03 : selectedName === "China"? 3}
        />
      ))}
    </group>
  );
}

function MapScene({ geojson, controlsRef, onSelectName, selectedName }) {
  const mapGroupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();

  useEffect(() => {
    // Center the orbit controls on the map's bounding sphere
    if (!mapGroupRef.current || !controlsRef?.current) return;
    // Wait for children to mount
    const id = requestAnimationFrame(() => {
      const box = new THREE.Box3().setFromObject(mapGroupRef.current!);
      const sphere = new THREE.Sphere();
      box.getBoundingSphere(sphere);
      const center = sphere.center;
      // Set controls target and camera position
      controlsRef.current.target.copy(center);
      controlsRef.current.update();

      camera.position.set(center.x, center.y + sphere.radius * 0.6, center.z + sphere.radius * 2.2);
      camera.near = Math.max(0.1, sphere.radius / 100);
      camera.far = Math.max(1000, sphere.radius * 100);
      camera.updateProjectionMatrix();
    });
    return () => cancelAnimationFrame(id);
  }, [geojson, controlsRef, camera]);

  return (
    <group ref={mapGroupRef}>
      {geojson.features.map((feature, i) => (
        <Region
          key={i}
          feature={feature}
          onClick={undefined}
          onSelectName={onSelectName}
          isSelected={selectedName === feature.properties.name}
        />
      ))}
      <Markers onSelectName={onSelectName} selectedName={selectedName} />
    </group>
  );
}

export default function Map3DComponent() {
  const [geojson, setGeojson] = useState(null);
  const controlsRef = useRef<any>(null);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [mapFile, setMapFile] = useState<string>("China.json");
  const [currentRegion, setCurrentRegion] = useState<string>("China");
  const [mode, setMode] = useState<"map" | "detail">("map");
  const [selectedMeshName, setSelectedMeshName] = useState<string | null>(null);

  // Track region based on selected label (keep region when selecting POIs)
  useEffect(() => {
    const hkNames = new Set(["Hong Kong", "CMA", "HKSTP"]);
    const moNames = new Set(["Macau", "BOCDSS", "BOCYH"]);
    if (selectedLabel == null) {
      setCurrentRegion("China");
      setMode("map");
    } else if (hkNames.has(selectedLabel)) {
      setCurrentRegion("Hong Kong");
      setMode(selectedLabel === "BOCYH" ? "detail" : "map");
    } else if (moNames.has(selectedLabel)) {
      setCurrentRegion("Macau");
      setMode(selectedLabel === "BOCYH" ? "detail" : "map");
    }
  }, [selectedLabel]);

  // Swap map JSON when the region changes (guard to prevent re-render loop)
  useEffect(() => {
    const next =
      currentRegion === "Hong Kong" ? "HongKong.json" :
      currentRegion === "Macau" ? "Macau.json" :
      "China.json";
    if (mapFile !== next) {
      setMapFile(next);
    }
  }, [currentRegion, mapFile]);

  // Load geojson for current mapFile
  useEffect(() => {
    let cancelled = false;
    fetch(`/3dmodel/${mapFile}`)
      .then(res => {
        if (!res.ok) throw new Error(`Failed to load ${mapFile}`);
        return res.json();
      })
      .then(data => { if (!cancelled) setGeojson(data); })
      .catch(err => {
        console.error("GeoJSON load error:", err);
        if (!cancelled && mapFile !== "China.json") {
          // Fallback to China.json if specific file missing
          fetch('/3dmodel/China.json')
            .then(r => r.json())
            .then(setGeojson)
            .catch(e => console.error("Fallback load error:", e));
        }
      });
    return () => { cancelled = true; };
  }, [mapFile]);

  if (!geojson) return <div>Loading…</div>;

  return (
    <div style={{ width: "100%", height: "100vh", position: "relative" }}>
      <div style={{ position: "absolute", top: 16, left: 16, zIndex: 10, background: "rgba(0,0,0,0.6)", color: "#fff", padding: "8px 12px", borderRadius: 8 }}>
        Selected: {selectedLabel ?? "(none)"} {selectedMeshName ? `• Mesh: ${selectedMeshName}` : ""}
      </div>
      <Canvas camera={{ position: [1500, 500, 800], fov: 45 }}>
      <ambientLight intensity={0.5} />
      <directionalLight position={[100, 100, 200]} intensity={0.8} />
      {mode === "map" ? (
        <MapScene geojson={geojson} controlsRef={controlsRef} onSelectName={setSelectedLabel} selectedName={selectedLabel} />
      ) : (
        <FurnitureDetail controlsRef={controlsRef} onMeshSelected={setSelectedMeshName} />
      )}
      <OrbitControls ref={controlsRef} enableDamping dampingFactor={0.08} />
      </Canvas>
    </div>
  );
}

function FurnitureDetail({ controlsRef, onMeshSelected }) {
  const { camera } = useThree();
  const gltf: any = useGLTF("/3dmodel/Furniture.glb");

  useEffect(() => {
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const sphere = new THREE.Sphere();
    box.getBoundingSphere(sphere);
    const center = sphere.center;
    controlsRef.current?.target.copy(center);
    controlsRef.current?.update();

    camera.position.set(center.x, center.y + sphere.radius * 0.6, center.z + sphere.radius * 2.2);
    camera.near = Math.max(0.1, sphere.radius / 100);
    camera.far = Math.max(1000, sphere.radius * 100);
    camera.updateProjectionMatrix();
  }, [gltf, controlsRef, camera]);

  return (
    <group>
      <primitive
        object={gltf.scene}
        onPointerDown={(e) => {
          e.stopPropagation();
          const meshName = (e.object as any)?.name || "Unnamed";
          onMeshSelected?.(meshName);
        }}
      />
    </group>
  );
}
