"use client";
// Map3DComponent.jsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, Html, useGLTF, useProgress } from "@react-three/drei";
import * as THREE from "three";
import * as d3 from "d3-geo";
import { useAuth } from "react-oidc-context";
import { LatestDashboard } from "../components/DashboardGauges";
import LatestLineChart from "../components/LatestLineChart";
import { getIMEIList, createLatestDpPoller, DeviceInfo } from "../lib/aws";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point as turfPoint } from "@turf/helpers";

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

function Region({ feature, onClick, isSelected, onSelectName, hoverScaleZ = 3 }: { feature: any; onClick?: (f: any) => void; isSelected?: boolean; onSelectName?: (name: string) => void; hoverScaleZ?: number }) {
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
          scale={[1, 1, hovered ? hoverScaleZ : 1]}
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

function GradientPillar({ height = 60, radius = 50, topColor = "#ff4040", bottomColor = "#ff9c3d", opacity = 0.85, glow = false, glowColor = "#2f7cff", glowScale = 1.6, glowStrength = 1.0, onClick, onPointerOver, onPointerOut }: { height?: number; radius?: number; topColor?: string; bottomColor?: string; opacity?: number; glow?: boolean; glowColor?: string; glowScale?: number; glowStrength?: number; onClick?: (e: any) => void; onPointerOver?: (e: any) => void; onPointerOut?: (e: any) => void; }) {
  const materialRef = React.useRef<THREE.ShaderMaterial>(null);
  const geometry = React.useMemo(() => new THREE.CylinderGeometry(radius, radius, height, 32, 1, true), [radius, height]);
  const shaderMaterial = React.useMemo(() => new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTopColor: { value: new THREE.Color(topColor) },
      uBottomColor: { value: new THREE.Color(bottomColor) },
      uOpacity: { value: opacity },
      uTime: { value: 0 }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform vec3 uTopColor;
      uniform vec3 uBottomColor;
      uniform float uOpacity;
      uniform float uTime;
      void main() {
        float grad = clamp(vUv.y, 0.0, 1.0);
        float pulse = 0.5 + 0.5 * sin(uTime + vUv.y * 6.2831);
        grad = clamp(grad * (0.75 + 0.25 * pulse), 0.0, 1.0);
        vec3 col = mix(uBottomColor, uTopColor, grad);
        float alpha = uOpacity * grad;
        gl_FragColor = vec4(col, alpha);
      }
    `
  }), [topColor, bottomColor, opacity]);

  const glowGeometry = React.useMemo(() => new THREE.CylinderGeometry(radius , radius, height + 2, 32, 1, true), [radius, height, glowScale]);
  const glowMaterial = React.useMemo(() => new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uGlowColor: { value: new THREE.Color(glowColor) },
      uTime: { value: 0 },
      uStrength: { value: glowStrength }
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main(){
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vViewDir = normalize(-mvPosition.xyz);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vNormal;
      varying vec3 vViewDir;
      uniform vec3 uGlowColor;
      uniform float uTime;
      uniform float uStrength;
      float fres = pow(1.0 - max(dot(vNormal, vViewDir), 0.0), 2.0);
      float pulse = 0.6 + 0.4 * sin(uTime * 2.0);
      float alpha = fres * pulse * uStrength;
      gl_FragColor = vec4(uGlowColor, alpha);
    `
  }), [glowColor, glowStrength]);

  useFrame((_, delta) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value += delta * 2.0;
    }
    glowMaterial.uniforms.uTime.value += delta;
  });

  return (
    <group>
      <mesh
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, 0, height / 2]}
        geometry={geometry}
        material={shaderMaterial}
        onClick={onClick}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
        ref={(m) => {
          if (m) materialRef.current = m.material as THREE.ShaderMaterial;
        }}
      />
      {glow && (
        <mesh
          rotation={[Math.PI / 2, 0, 0]}
          position={[0, 0, (height + 2) / 2]}
          geometry={glowGeometry}
          material={glowMaterial}
        />
      )}
    </group>
  );
}

function Marker({ name, lngLat, onSelectName, onClearSelection, isSelected, radius = 3 }) {
  const [hovered, setHovered] = useState(false);
  const [x, y] = useMemo(() => projection(lngLat), [lngLat]);
  const isLocal = useMemo(() => ["CMA", "HKSTP", "BOCDSS", "BOCYH"].includes(name), [name]);
  const pillarHeight = (name === "Hong Kong" || name === "Macau") ? 80 : 20;
  const baseRadius = radius && radius > 0 ? (name !== "Hong Kong" && name !== "Macau") ? 0.02: radius : (isLocal ? 1.0 : 1.2);
  const pillarRadius = baseRadius * (hovered ? 1.3 : 1.0);
  const top = hovered ? "#2291ff" : (isSelected ? "rgb(250, 148, 53)" : "rgb(255, 0, 0)");
  const bottom = hovered ? "#66c2ff" : "#ffcf99";
  return (
    <group position={[x, -y, 5]}>
      <GradientPillar
        height={pillarHeight}
        radius={pillarRadius}
        topColor={top}
        bottomColor={bottom}
        opacity={100}
        glow={true}
        glowColor="#2f7cff"
        glowScale={hovered ? 1.6 : 1.4}
        glowStrength={hovered ? 1.2 : 0.8}
        onClick={(e) => { e.stopPropagation(); onSelectName?.(name); }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
        onPointerOut={(e) => { e.stopPropagation(); setHovered(false); }}
      />
      {(hovered || isSelected) && (
        <Html
          center
          position={[0, 0, 2]}
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
    </group>
  );
}

function Markers({ onSelectName, onClearSelection, selectedName }) {
  const [radius, setRadius] = useState(3);
  const points = useMemo(() => {
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
          radius={p.name === "Hong Kong" || p.name === "Macau" ? 1.2 : 1.0}
        />
      ))}
    </group>
  );
}

// Device pillars rendered from IMEI list coordinates
function DevicePillar({ device, selectedIMEI, onSelectIMEI, radius = 3 ,onSelectName}: { device: DeviceInfo; selectedIMEI?: string; onSelectIMEI: (imei: string) => void; radius?: number ;onSelectName?:any}) {
  const [hovered, setHovered] = useState(false);
  const name = device.Location || String(device.DeviceID);
  const pillarHeight = (name === "Hong Kong" || name === "Macau") ? 80 : 20;
  const baseRadius = radius && radius > 0 ? (name !== "Hong Kong" && name !== "Macau") ? 0.02 : radius : 1.0;
  const pillarRadius = baseRadius * (hovered ? 1.3 : 1.0);
  const isSelected = selectedIMEI === String(device.DeviceID);
  const top = hovered ? "#2291ff" : (isSelected ? "rgb(250, 148, 53)" : "rgb(255, 0, 0)");
  const bottom = hovered ? "#66c2ff" : "#ffcf99";
  const pos = useMemo(() => {
    const lat = Number(device.Coordinate?.[0]);
    const lng = Number(device.Coordinate?.[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [0, 0, 0] as [number, number, number];
    const [x, y] = projection([lng, lat]);
    return [x, -y, 5] as [number, number, number];
  }, [device.Coordinate]);
  return (
    <group position={pos}>
      <GradientPillar
        height={pillarHeight}
        radius={pillarRadius}
        topColor={top}
        bottomColor={bottom}
        opacity={100}
        glow={true}
        glowColor="#2f7cff"
        glowScale={hovered ? 1.6 : 1.4}
        glowStrength={hovered ? 1.2 : 0.8}
        onClick={(e: any) => { e.stopPropagation(); onSelectIMEI(String(device.DeviceID)); onSelectName(device.Location);}}
        onPointerOver={(e: any) => { e.stopPropagation(); setHovered(true); }}
        onPointerOut={(e: any) => { e.stopPropagation(); setHovered(false); }}
      />
      {(hovered || isSelected) && (
        <Html
          center
          position={[0, 0, 2]}
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
    </group>
  );
}

function DevicePillars({ devices, selectedIMEI, onSelectIMEI, onSelectName }: { devices: DeviceInfo[]; selectedIMEI?: string; onSelectIMEI: (imei: string) => void ; onSelectName?: any}) {
  if (!devices || devices.length === 0) return null;
  return (
    <group>
      {devices.map((d) => (
        <DevicePillar key={String(d.DeviceID)} device={d} selectedIMEI={selectedIMEI} onSelectIMEI={onSelectIMEI} onSelectName={onSelectName} />
      ))}
    </group>
  );
}
function MapScene({ geojson, controlsRef, onSelectName, selectedName, region, devices, onSelectIMEI, showMarkers = false, showPillars = false, onFilteredDevices }: { geojson: any; controlsRef: any; onSelectName: (name: string | null) => void; selectedName: string | null; region: string; devices?: DeviceInfo[]; onSelectIMEI?: (imei: string) => void; showMarkers?: boolean; showPillars?: boolean; onFilteredDevices?: (devs: DeviceInfo[]) => void; }) {
  const mapGroupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const [mapRadius, setMapRadius] = useState(0);
  const hoverScaleZ = useMemo(() => {
    return THREE.MathUtils.clamp(1.5 + mapRadius / 800, 1.5, 6.0);
  }, [mapRadius]);

  useEffect(() => {
    if (!mapGroupRef.current || !controlsRef?.current) return;
    const id = requestAnimationFrame(() => {
      const group = mapGroupRef.current!;
      const box = new THREE.Box3().setFromObject(group);
      const sphere = new THREE.Sphere();
      box.getBoundingSphere(sphere);
      const center = sphere.center.clone();
      group.position.set(group.position.x - center.x, group.position.y - center.y, group.position.z);
      const box2 = new THREE.Box3().setFromObject(group);
      const sphere2 = new THREE.Sphere();
      box2.getBoundingSphere(sphere2);
      const newCenter = sphere2.center;
      setMapRadius(sphere2.radius);
      controlsRef.current.target.copy(newCenter);
      controlsRef.current.update();
      camera.position.set(newCenter.x, newCenter.y + sphere2.radius * 0.6, newCenter.z + sphere2.radius * 2.2);
      camera.near = Math.max(0.1, sphere2.radius / 100);
      camera.far = Math.max(1000, sphere2.radius * 100);
      camera.updateProjectionMatrix();
    });
    return () => cancelAnimationFrame(id);
  }, [geojson, controlsRef, camera]);

  // Filter devices to those within current geojson region boundaries
  const fcForFilter = useMemo(() => {
    if (!geojson) return null;
    const feats = (geojson.features || []).filter((f: any) => {
      const name = String(f?.properties?.name || "").toLowerCase();
      if (region === "Hong Kong") return name.includes("hong kong") || name.includes("hksar") || name.includes("hk");
      if (region === "Macau") return name.includes("macau") || name.includes("macao");
      return true; // China or other: allow all
    });
    return { type: "FeatureCollection", features: feats.length > 0 ? feats : (geojson.features || []) } as any;
  }, [geojson, region]);
  
  const filteredDevices = useMemo(() => {
    if (!devices || !fcForFilter) return [] as DeviceInfo[];
    try {
      // Prefer robust Turf point-in-polygon across MultiPolygon/Polygon
      return devices.filter(d => {
        const lat = Number(d.Coordinate?.[0]);
        const lon = Number(d.Coordinate?.[1]);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
        const p = turfPoint([lon, lat]);
        const feats = (fcForFilter as any).features || [];
        for (let i = 0; i < feats.length; i++) {
          try {
            if (booleanPointInPolygon(p, feats[i])) return true;
          } catch {}
        }
        return false;
      });
    } catch (e) {
      // Fallback to d3.geoContains (if available), then bbox
      try {
        return devices.filter(d => {
          const lat = Number(d.Coordinate?.[0]);
          const lon = Number(d.Coordinate?.[1]);
          return Number.isFinite(lat) && Number.isFinite(lon) && d3.geoContains(fcForFilter as any, [lon, lat]);
        });
      } catch (e2) {
        try {
          const [[minLon, minLat], [maxLon, maxLat]] = d3.geoBounds(fcForFilter as any);
          return devices.filter(d => {
            const lat = Number(d.Coordinate?.[0]);
            const lon = Number(d.Coordinate?.[1]);
            return Number.isFinite(lat) && Number.isFinite(lon) && lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat;
          });
        } catch (e3) {
          console.warn('Region filter failed; hiding pillars', e3);
          return [] as DeviceInfo[];
        }
      }
    }
  }, [devices, fcForFilter]);

  useEffect(() => {
    onFilteredDevices?.(filteredDevices);
  }, [filteredDevices, onFilteredDevices]);
  return (
    <group ref={mapGroupRef} scale={region === "Hong Kong" || region === "Macau" ? [6, 6, 1] : [1, 1, 1]}>
      {geojson.features.map((feature, i) => (
        <Region
          key={i}
          feature={feature}
          onClick={undefined}
          onSelectName={onSelectName}
          isSelected={selectedName === feature.properties.name}
          hoverScaleZ={hoverScaleZ}
        />
      ))}
      {showMarkers && <Markers onSelectName={onSelectName} selectedName={selectedName} />}
      {showPillars && filteredDevices && onSelectIMEI && (
        <DevicePillars devices={filteredDevices} selectedIMEI={undefined} onSelectIMEI={onSelectIMEI} onSelectName={onSelectName} />
      )}
    </group>
  );
}

export default function Map3DComponent({ onMeshSelected }: { onMeshSelected?: (name: string | null) => void }) {
  const auth = useAuth();
  const [geojson, setGeojson] = useState(null);
  const controlsRef = useRef<any>(null);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [mapFile, setMapFile] = useState<string>("China.json");
  const [currentRegion, setCurrentRegion] = useState<string>("China");
  const [mode, setMode] = useState<"map" | "region" | "detail">("map");
  const [selectedMeshName, setSelectedMeshName] = useState<string | null>(null);
  const [imeiList, setImeiList] = useState<DeviceInfo[]>([]);
  const [IMEI, setIMEI] = useState<string>("");
  const [deviceMap, setDeviceMap] = useState<any>({});
  const [visibleDevices, setVisibleDevices] = useState<DeviceInfo[]>([]);
  const pollerRef = useRef<any>(null);

  // Track region based on selected label (keep region when selecting POIs)
  useEffect(() => {
    const hkLocal = new Set(["CMA", "HKSTP"]);
    const moLocal = new Set(["BOCDSS", "BOCYH"]);
    if (selectedLabel == null) {
      setCurrentRegion("China");
      setMode("map");
    } else if (selectedLabel === "Hong Kong") {
      setCurrentRegion("Hong Kong");
      setMode("region");
    } else if (selectedLabel === "Macau") {
      setCurrentRegion("Macau");
      setMode("region");
    } else if (selectedLabel === "BOCYH") {
      setCurrentRegion("Macau");
      setMode("detail");
    } else {
      // keep current region and return to map mode
      setMode("map");
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

  // Fetch IMEI list and set default IMEI
  useEffect(() => {
    if (!auth.isAuthenticated || !auth.user?.id_token || !auth.user?.profile?.email) return;
    getIMEIList(auth.user.profile.email, auth.user?.id_token)
      .then(list => { setImeiList(list); setIMEI(String(list?.[0]?.DeviceID || "")); })
      .catch(err => console.error("3D getIMEIList error:", err));
  }, [auth.isAuthenticated, auth.user?.id_token, auth.user?.profile?.email]);

  // Start latest DP poller when IMEI available
  useEffect(() => {
    if (!IMEI || !auth?.user?.id_token) return;
    if (pollerRef.current) {
      try { pollerRef.current.stop(); } catch {}
      pollerRef.current = null;
    }
    const poller = createLatestDpPoller({
      IMEI,
      idToken: auth.user.id_token,
      intervalMs: 5 * 60 * 1000,
      callback: (result) => {
        setDeviceMap(result.deviceMap);
      },
    });
    pollerRef.current = poller;
    poller.start();
    return () => {
      if (pollerRef.current) {
        try { pollerRef.current.stop(); } catch {}
        pollerRef.current = null;
      }
    };
  }, [IMEI, auth.user?.id_token]);

  // Bubble selection to parent if requested
  useEffect(() => {
    onMeshSelected?.(selectedMeshName || null);
  }, [selectedMeshName, onMeshSelected]);

  if (!geojson) return <div>Loading…</div>;

  return (
    <div style={{ display: "flex", width: "100%", height: "100vh" }}>
      <div style={{ flex: "1 1 auto", position: "relative" ,width: "70%",}}>
        <div style={{ position: "absolute", top: 16, left: 16, zIndex: 10, background: "rgba(0,0,0,0.6)", color: "#fff", padding: "8px 12px", borderRadius: 8 }}>
          Selected: {selectedLabel ?? "(none)"} {selectedMeshName ? `• Mesh: ${selectedMeshName}` : ""}
        </div>
        <Canvas camera={{ position: [33.4, -202.9, 447.9], fov: 45 }}>
          <CanvasDecor mode={mode} currentRegion={currentRegion} />
          <ambientLight intensity={0.5} />
          <directionalLight position={[100, 100, 200]} intensity={0.8} />
           {mode !== "detail" && <MapScene geojson={geojson} controlsRef={controlsRef} onSelectName={setSelectedLabel} selectedName={selectedLabel} region={currentRegion} devices={imeiList} onSelectIMEI={setIMEI} showPillars={mode === "region"} showMarkers={mode === "map"} onFilteredDevices={setVisibleDevices} />}
          {mode === "detail" && (
            <FurnitureDetail controlsRef={controlsRef} onMeshSelected={setSelectedMeshName} />
          )}
          <CameraInit
            controlsRef={controlsRef}
            initial={{ position: [33.4, -202.9, 447.9], radius: 494.5, alphaDeg: 1.0, betaDeg: 116.2 }}
          />
          <OrbitControls ref={controlsRef} enableDamping dampingFactor={0.08} />
        </Canvas>
      </div>
      {mode === "detail" && (
        <div style={{ flex: "0 0 400px", width: 400, minWidth: 320, flexShrink: 0, background: "rgba(1, 7, 22, 0.9)", color: "#fff", padding: 12, overflowY: "auto" }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Detail Metrics</div>
          {IMEI ? (
            selectedMeshName ? (
              <>
                <LatestDashboard deviceMap={deviceMap} device={[selectedMeshName]} dataType={[]} compact />
                <LatestLineChart deviceMap={deviceMap} deviceType={selectedMeshName} maxPoints={10} title="Realtime Line Chart" height={180} />
              </>
            ) : (
              <div>Click a model mesh to show gauges and chart</div>
            )
          ) : (
            <div>No IMEI available for this user</div>
          )}
        </div>
      )}
    </div>
  );
}


function CameraInit({ controlsRef, initial }: { controlsRef: any; initial: { position: [number, number, number]; radius: number; alphaDeg: number; betaDeg: number } }) {
  const { camera } = useThree();
  const did = useRef(false);
  useEffect(() => {
    if (did.current) return;
    const raf = requestAnimationFrame(() => {
      if (!controlsRef?.current) return;
      const { position, radius, alphaDeg, betaDeg } = initial;
      const alpha = THREE.MathUtils.degToRad(alphaDeg);
      const beta = THREE.MathUtils.degToRad(betaDeg);
      const sinPhi = Math.sin(beta);
      const cosPhi = Math.cos(beta);
      const sinTheta = Math.sin(alpha);
      const cosTheta = Math.cos(alpha);
      const dx = radius * sinPhi * sinTheta;
      const dy = radius * cosPhi;
      const dz = radius * sinPhi * cosTheta;
      const target = new THREE.Vector3(position[0] - dx, position[1] - dy, position[2] - dz);
      camera.position.set(position[0], position[1], position[2]);
      controlsRef.current.target.copy(target);
      controlsRef.current.update();
      did.current = true;
    });
    return () => cancelAnimationFrame(raf);
  }, [controlsRef, camera, initial]);
  return null;
}

function FurnitureDetail({ controlsRef, onMeshSelected }) {
  const { camera } = useThree();
  const gltf: any = useGLTF("/3dmodel/Furniture.glb");
  const groupRef = useRef<THREE.Group>(null);
  const [glow, setGlow] = useState<{ center: [number, number, number]; radius: number } | null>(null);

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
    <group ref={groupRef}>
      <primitive
        object={gltf.scene}
        onPointerDown={(e) => {
          e.stopPropagation();
          const obj = e.object as THREE.Object3D;
          const meshName = (obj as any)?.name || "Unnamed";
          onMeshSelected?.(meshName);
          // Compute world bounding sphere of selected object
          const box = new THREE.Box3().setFromObject(obj);
          const sphere = new THREE.Sphere();
          box.getBoundingSphere(sphere);
          const worldCenter = sphere.center.clone();
          // Convert to local position relative to FurnitureDetail group
          const localCenter = worldCenter.clone();
          if (groupRef.current) {
            groupRef.current.worldToLocal(localCenter);
          }
          setGlow({ center: [localCenter.x, localCenter.y, localCenter.z], radius: sphere.radius });
        }}
      />
      {glow && <GlowShell center={glow.center} radius={glow.radius} />}
    </group>
  );
}

interface GridOptions {
  position: THREE.Vector3 | [number, number, number];
  gridSize: number;
  gridDivision: number;
  gridColor: number;
  shapeSize: number;
  shapeColor: number;
  pointSize: number;
  pointColor: number;
  pointLayout: { row: number; col: number };
  pointBlending: THREE.Blending;
  diffuse: boolean;
  diffuseSpeed: number;
  diffuseColor: number;
  diffuseWidth: number;
  diffuseDir?: number;
  adaptivePointSize?: boolean;
  minPointSize?: number;
  maxPointSize?: number;
}

const toVector3 = (pos: GridOptions["position"]): [number, number, number] => {
  return Array.isArray(pos) ? (pos as [number, number, number]) : [pos.x, pos.y, pos.z];
};

function SceneBackground({ color = "#0b2d5e" }: { color?: string }) {
  const { scene } = useThree();
  useEffect(() => {
    const prev = scene.background;
    scene.background = new THREE.Color(color);
    return () => {
      scene.background = prev;
    };
  }, [scene, color]);
  return null;
}

function GridBackground({ options }: { options: GridOptions }) {
  const { camera } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const pointsGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const rows = Math.max(2, options.pointLayout.row);
    const cols = Math.max(2, options.pointLayout.col);
    const size = options.gridSize;
    const positions = new Float32Array(rows * cols * 3);
    const x0 = -size / 2;
    const z0 = -size / 2;
    const dx = size / (cols - 1);
    const dz = size / (rows - 1);
    let idx = 0;
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const x = x0 + j * dx;
        const z = z0 + i * dz;
        positions[idx++] = x;
        positions[idx++] = 0.2; // y (XZ -> rotate to XY)
        positions[idx++] = z;
      }
    }
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [options.pointLayout.row, options.pointLayout.col, options.gridSize]);

  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: options.pointBlending ?? THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uBaseColor: { value: new THREE.Color(options.pointColor) },
        uDiffuseColor: { value: new THREE.Color(options.diffuseColor) },
        uSize: { value: options.pointSize },
        uWidth: { value: options.diffuseWidth },
        uSpeed: { value: options.diffuseSpeed },
        uEnable: { value: options.diffuse ? 1.0 : 0.0 },
        uDir: { value: options.diffuseDir ?? 0.0 }
      },
      vertexShader: `
        uniform float uSize;
        varying vec2 vPos;
        void main() {
          vPos = position.xz;
          gl_PointSize = uSize;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision mediump float;
        varying vec2 vPos;
        uniform vec3 uBaseColor;
        uniform vec3 uDiffuseColor;
        uniform float uTime;
        uniform float uWidth;
        uniform float uSpeed;
        uniform float uEnable;
        uniform float uDir;
        void main() {
          vec2 p = gl_PointCoord.xy * 2.0 - 1.0;
          float m = 1.0 - smoothstep(0.95, 1.0, length(p));
          float alpha = 0.8 * m;
          vec3 col = uBaseColor;

          if (uEnable > 0.5) {
            float r = mod(uTime * uSpeed, 2000.0);
            float d;
            if (uDir < 0.5) {
              d = length(vPos);
            } else if (uDir < 1.5) {
              d = abs(vPos.x);
            } else {
              d = abs(vPos.y);
            }
            float glow = smoothstep(r - uWidth, r, d) * (1.0 - smoothstep(r, r + uWidth, d));
            col = mix(col, uDiffuseColor, glow);
            alpha = mix(alpha, 1.0 * m, glow);
          }

          gl_FragColor = vec4(col, alpha);
        }
      `
    });
  }, [options.pointBlending, options.pointColor, options.diffuseColor, options.pointSize, options.diffuseWidth, options.diffuseSpeed, options.diffuse, options.diffuseDir]);

  useFrame((_, delta) => {
    shaderMaterial.uniforms.uTime.value += delta * 60.0;
    // adaptive point size based on camera distance
    if (options.adaptivePointSize && groupRef.current) {
      const worldPos = new THREE.Vector3();
      groupRef.current.getWorldPosition(worldPos);
      const dist = camera.position.distanceTo(worldPos);
      const minS = options.minPointSize ?? 1.5;
      const maxS = options.maxPointSize ?? 5.0;
      const base = options.pointSize;
      const size = THREE.MathUtils.clamp(base * (800 / (dist + 1)), minS, maxS);
      shaderMaterial.uniforms.uSize.value = size;
    }
  });

  const gridColor = useMemo(() => new THREE.Color(options.gridColor), [options.gridColor]);

  return (
    <group ref={groupRef} position={toVector3(options.position)} rotation={[Math.PI / 2, 0, 0]} renderOrder={-1}>
      {/* Grid lines */}
      {/* @ts-ignore */}
      <gridHelper args={[options.gridSize, options.gridDivision, gridColor, gridColor]} />
      {/* Points diffusion layer */}
      {/* @ts-ignore */}
      <points geometry={pointsGeometry} material={shaderMaterial} />
    </group>
  );
}

function CanvasDecor({ mode, currentRegion }: { mode: "map" | "region" | "detail"; currentRegion: string }) {
  const { active } = useProgress();
  const isDetail = mode === "detail";
  const loadingGLB = isDetail && active;
  return (
    <>
      <SceneBackground color={isDetail ? "rgb(197, 197, 197)" : "rgb(1, 7, 22)"} />
      {!isDetail && (
        <GridBackground
          options={{
            position: new THREE.Vector3(0, 0, -1),
            gridSize: (currentRegion === "Hong Kong" || currentRegion === "Macau") ? 160 : 12000,
            gridDivision: (currentRegion === "Hong Kong" || currentRegion === "Macau") ? 32 : 400,
            gridColor: 0x1f3b6b,
            shapeSize: 0,
            shapeColor: 0x2f5fa9,
            pointSize: 2.0,
            pointColor: 0x4aa3ff,
            pointLayout: (currentRegion === "Hong Kong" || currentRegion === "Macau") ? { row: 32 * 4, col: 32 * 4 } : { row: 1600, col: 1600 },
            pointBlending: THREE.AdditiveBlending,
            diffuse: true,
            diffuseSpeed: 10,
            diffuseColor: 0x00ffff,
            diffuseWidth: 30,
            diffuseDir: 0,
            adaptivePointSize: true,
            minPointSize: (currentRegion === "Hong Kong" || currentRegion === "Macau") ? 0.1 : 1.5,
            maxPointSize: 5
          }}
        />
      )}
    </>
  );
}

function CameraHUD({ controlsRef }: { controlsRef: any }) {
  const { camera } = useThree();
  const [info, setInfo] = useState({ x: 0, y: 0, z: 0, r: 0, alpha: 0, beta: 0 });
  useFrame(() => {
    const target = controlsRef?.current?.target ?? new THREE.Vector3(0, 0, 0);
    const delta = new THREE.Vector3().copy(camera.position).sub(target);
    const sph = new THREE.Spherical().setFromVector3(delta);
    setInfo({
      x: Number(camera.position.x.toFixed(1)),
      y: Number(camera.position.y.toFixed(1)),
      z: Number(camera.position.z.toFixed(1)),
      r: Number(sph.radius.toFixed(1)),
      alpha: Number(THREE.MathUtils.radToDeg(sph.theta).toFixed(1)),
      beta: Number(THREE.MathUtils.radToDeg(sph.phi).toFixed(1))
    });
  });
  return (
    <Html transform={false} style={{ position: "absolute", top: 16, right: 16, background: "rgba(0,0,0,0.6)", color: "#fff", padding: "6px 8px", borderRadius: 6, font: "12px/1.2 system-ui" }}>
      {`pos: (${info.x}, ${info.y}, ${info.z}) r: ${info.r} α: ${info.alpha}° β: ${info.beta}°`}
    </Html>
  );
}

function GlowShell({ center, radius, color = new THREE.Color(0x4aa3ff), strength = 1.0 }: { center: [number, number, number]; radius: number; color?: THREE.Color | string | number; strength?: number }) {
  const material = useMemo(() => {
    const col = new THREE.Color(color as any);
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: col },
        uStrength: { value: strength }
      },
      vertexShader: `
        varying vec3 vWorldPos;
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldPos.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision mediump float;
        varying vec3 vWorldPos;
        varying vec3 vNormal;
        uniform vec3 uColor;
        uniform float uStrength;
        uniform float uTime;
        void main() {
          vec3 viewDir = normalize(cameraPosition - vWorldPos);
          float fresnel = pow(1.0 - max(dot(normalize(vNormal), viewDir), 0.0), 3.0);
          float pulse = 0.85 + 0.15 * sin(uTime * 2.0);
          float alpha = fresnel * uStrength * pulse;
          gl_FragColor = vec4(uColor * alpha, alpha);
        }
      `
    });
  }, [color, strength]);
  useFrame((_, delta) => {
    material.uniforms.uTime.value += delta;
  });
  return (
    <mesh position={center as any} material={material}>
      <sphereGeometry args={[radius * 1.08, 48, 48]} />
    </mesh>
  );
}
