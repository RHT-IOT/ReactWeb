"use client";
// Map3DComponent.jsx
import React, { useState, useEffect, useMemo, useRef, useCallback, Suspense } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, Html, useGLTF, Environment } from "@react-three/drei";
import * as THREE from "three";
import * as d3 from "d3-geo";
import { useAuth } from "react-oidc-context";
import { LatestDashboard } from "../components/DashboardGauges";
import LatestLineChart from "../components/LatestLineChart";
import { getIMEIList, createLatestDpPoller, DeviceInfo, fetchWithAuthRetry } from "../lib/aws";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point as turfPoint } from "@turf/helpers";

import Image from 'next/image';
import { asset } from '../lib/asset';
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
        <lineSegments key={`border-${idx}`} geometry={borderGeom}>
          <lineBasicMaterial color="white" />
        </lineSegments>
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
      precision mediump float;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      uniform vec3 uGlowColor;
      uniform float uTime;
      uniform float uStrength;
      void main() {
        float fres = pow(1.0 - max(dot(normalize(vNormal), normalize(vViewDir)), 0.0), 2.0);
        float pulse = 0.6 + 0.4 * sin(uTime * 2.0);
        float alpha = fres * pulse * uStrength;
        gl_FragColor = vec4(uGlowColor, alpha);
      }
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

type LngLatTuple = [number, number];
interface MarkerProps {
  name: string;
  lngLat: LngLatTuple;
  onSelectName?: (name: string) => void;
  onClearSelection?: () => void;
  isSelected?: boolean;
  radius?: number;
}

function Marker({ name, lngLat, onSelectName, onClearSelection, isSelected, radius = 3 }: MarkerProps) {
  const [hovered, setHovered] = useState(false);
  const [x, y] = useMemo(() => (projection(lngLat) ?? [0, 0]) as [number, number], [lngLat]);
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

interface MarkersProps {
  onSelectName?: (name: string) => void;
  onClearSelection?: () => void;
  selectedName?: string;
}

function Markers({ onSelectName, onClearSelection, selectedName }: MarkersProps) {
  const [radius, setRadius] = useState(3);
  const points = useMemo(() => {
    return [
      { name: "Hong Kong", lngLat: [114.1694, 22.3193] as LngLatTuple },
      { name: "Macau", lngLat: [113.5439, 22.1987] as LngLatTuple }
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
  const [selectedMeshNames, setSelectedMeshNames] = useState<string[]>([]);
  const [detailModelLoaded, setDetailModelLoaded] = useState<boolean>(false);
  const [panelVisible, setPanelVisible] = useState<boolean>(true);
  const [imeiList, setImeiList] = useState<DeviceInfo[]>([]);
  const [IMEI, setIMEI] = useState<string>("");
  const [deviceMap, setDeviceMap] = useState<any>({});
  const [visibleDevices, setVisibleDevices] = useState<DeviceInfo[]>([]);
  const pollerRef = useRef<any>(null);
  const chartHistoryRef = useRef<Record<string, { timestamps: string[]; seriesMap: Record<string, number[]> }>>({});
  const [historyVersion, setHistoryVersion] = useState<number>(0);
  // Hydrate chart history from sessionStorage once to survive auth refresh/remounts
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = window.sessionStorage.getItem('chartHistoryStore');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === 'object') {
            chartHistoryRef.current = parsed;
          }
        }
      }
    } catch {}
  }, []);
  const getIdTokenAsync = useCallback(async () => {
    try {
      const fn: any = (auth as any)?.signinSilent;
      if (typeof fn === 'function') {
        const user = await fn();
        const tk = (user as any)?.id_token;
        if (tk) return tk;
      }
    } catch {}
    return auth?.user?.id_token || "";
  }, [auth?.user?.id_token]);
  
  const [allowedByDeviceId, setAllowedByDeviceId] = useState<Record<string, string[]>>({});
  const [allowedDeviceTypes3D, setAllowedDeviceTypes3D] = useState<string[]>([]);
  const [selectedDeviceTypes3D, setSelectedDeviceTypes3D] = useState<string[]>([]);
  // Track whether Ctrl/Shift is pressed to enable multi-select interactions
  const [multiKeyDown, setMultiKeyDown] = useState<boolean>(false);
  const [multiIMEI, setMultiIMEI] = useState<boolean>(false);
  const [rtDevice3D, setRtDevice3D] = useState<string>("");
  const [updateIntervalMs, setUpdateIntervalMs] = useState<number>(300000);
  const [maxPoints3D, setMaxPoints3D] = useState<number>(10);
  const [selectedDataTypes3D, setSelectedDataTypes3D] = useState<string[]>([]);
  const availableDataTypes3D = useMemo(() => {
    const meta = new Set(["Timestamp", "DeviceID", "DeviceType"]);
    const types = (selectedDeviceTypes3D && selectedDeviceTypes3D.length > 0)
      ? selectedDeviceTypes3D
      : (deviceMap && typeof deviceMap === 'object' ? Object.keys(deviceMap) : []);
    const union = new Set<string>();
    types.forEach((t) => {
      const entry = deviceMap?.[t];
      if (!entry || typeof entry !== 'object') return;
      Object.keys(entry).forEach((k) => {
        if (!meta.has(k) && typeof entry[k] === 'number') union.add(k);
      });
    });
    return Array.from(union);
  }, [deviceMap, selectedDeviceTypes3D]);

  // Listen for Ctrl/Shift to toggle multi-select mode for meshes and dropdown
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Meta') {
        setMultiKeyDown(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Meta') {
        setMultiKeyDown(false);
      }
    };
    const onBlur = () => setMultiKeyDown(false);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  useEffect(() => {
    setSelectedDataTypes3D(prev => {
      const allowedSet = new Set(availableDataTypes3D);
      const hadSelection = prev.length > 0;
      const intersection = prev.filter(d => allowedSet.has(d));
      if (!hadSelection) return availableDataTypes3D;
      if (intersection.length === 0) return prev;
      if (intersection.length === prev.length) return prev;
      return intersection;
    });
  }, [availableDataTypes3D]);

  // Note: history is appended uniformly inside the poller callbacks (success and error)

  // Track region based on selected label (keep region when selecting POIs)
  useEffect(() => {
    const hkLocal = new Set(["CMA", "HKSTP"]);
    const moLocal = new Set(["BOCDSS", "BOCYH"]);
    if (selectedLabel == null) {
      setCurrentRegion("China");
      setMode("map");
      setPanelVisible(true);
      setMultiIMEI(false);
    } else if (selectedLabel === "Hong Kong") {
      setCurrentRegion("Hong Kong");
      setMode("region");
      setPanelVisible(true);
      setMultiIMEI(false);
    } else if (selectedLabel === "Macau") {
      setCurrentRegion("Macau");
      setMode("region");
      setPanelVisible(true);
      setMultiIMEI(false);
    } else if (selectedLabel === "BOCYH") {
      setCurrentRegion("Macau");
      setMode("detail");
      setDetailModelLoaded(false);
      setPanelVisible(true);
      setMultiIMEI(false);
    } else if (selectedLabel === "BOCDSS") {
      setCurrentRegion("Macau");
      setMode("detail");
      setDetailModelLoaded(false);
      setPanelVisible(true);
      setMultiIMEI(false);
    }else if (selectedLabel === "屯门区") {
      setCurrentRegion("TuenMun");
      setMode("detail");
      setDetailModelLoaded(false);
      setPanelVisible(true);
      setMultiIMEI(true);
    }else if (selectedLabel === "广东省") {
      setCurrentRegion("GuangDong");
      setMode("region");
      setDetailModelLoaded(false);
      setPanelVisible(true);
      setMultiIMEI(true);
    }else if (selectedLabel === "广州市") {
      setCurrentRegion("GuangZhou");
      setMode("region");
      setDetailModelLoaded(false);
      setPanelVisible(true);
      setMultiIMEI(true);
    }else if (selectedLabel === "南沙区") {
      setCurrentRegion("Spray");
      setMode("detail");
      setDetailModelLoaded(false);
      setPanelVisible(true);
      setMultiIMEI(true);
    } else {
      // keep current region and return to map mode
      setMode("region");
      setMultiIMEI(false);
    }
    console.log(selectedLabel);
  }, [selectedLabel]);

  // Swap map JSON when the region changes (guard to prevent re-render loop)
  useEffect(() => {
    const next =
      currentRegion === "Hong Kong" ? "HongKong.json" :
      currentRegion === "Macau" ? "Macau.json" :
      currentRegion === "GuangZhou" ? "GuangZhouProvince.json" :
      currentRegion === "GuangDong" ? "GuangDong.json" :
      "China.json";
    if (mapFile !== next) {
      setMapFile(next);
    }
  }, [currentRegion, mapFile]);

  // Load geojson for current mapFile
  useEffect(() => {
    let cancelled = false;
    fetch(asset(`/3dmodel/${mapFile}`))
      .then(res => {
        if (!res.ok) throw new Error(`Failed to load ${mapFile}`);
        return res.json();
      })
      .then(data => { if (!cancelled) setGeojson(data); })
      .catch(err => {
        console.error("GeoJSON load error:", err);
        if (!cancelled && mapFile !== "China.json") {
          // Fallback to China.json if specific file missing
          fetch(asset('/3dmodel/China.json'))
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
    getIMEIList(auth.user.profile.email, auth.user?.id_token, getIdTokenAsync)
      .then(list => {
        const items = Array.isArray(list.items) ? list.items : [];
        const devAccess = Array.isArray(list.dev_access) ? list.dev_access : [];
        setImeiList(items);
        const firstIMEI = String(items?.[0]?.DeviceID || "");
        setIMEI(firstIMEI);
        const map: Record<string, string[]> = {};
        for (let i = 0; i < items.length; i++) {
          const imei = String(items[i]?.DeviceID);
          const allowed = Array.isArray(devAccess?.[i]) ? devAccess[i].map(String) : [];
          map[imei] = allowed;
        }
        setAllowedByDeviceId(map);
        setAllowedDeviceTypes3D(map[firstIMEI] || []);
      })
      .catch(err => console.error("3D getIMEIList error:", err));
  }, [auth.isAuthenticated, auth.user?.id_token, auth.user?.profile?.email, getIdTokenAsync]);

  // Start latest DP poller when IMEI available
  useEffect(() => {
    if ((!multiIMEI && !IMEI) || !auth?.user?.id_token) return;
    if (pollerRef.current) {
      try { pollerRef.current.stop(); } catch {}
      pollerRef.current = null;
    }

    const handleResult = (result: { deviceMap: Record<string, any> }) => {
        // Append a uniform timestamp for all device types, then update deviceMap
        const store = chartHistoryRef.current;
        const meta = new Set(["Timestamp", "DeviceID", "DeviceType"]);
        const nowMs = Date.now();
        const rounded = Math.floor(nowMs / updateIntervalMs) * updateIntervalMs;
        const tickTs = new Date(rounded).toISOString().split('.')[0].replace('T', ' ');
        const types = Object.keys(result.deviceMap || {});
        types.forEach((dt) => {
          const entry = (result.deviceMap as any)[dt];
          if (!entry || typeof entry !== 'object') return;
          const existing = store[dt] || { timestamps: [], seriesMap: {} };
          const nextTimestamps = [...existing.timestamps, tickTs];
          const trimmedTimestamps = nextTimestamps.length > maxPoints3D ? nextTimestamps.slice(nextTimestamps.length - maxPoints3D) : nextTimestamps;
          const nextSeries: Record<string, number[]> = { ...existing.seriesMap };
          // Union of existing keys and current numeric fields
          const currentKeys = Object.keys(entry).filter(k => !meta.has(k) && typeof entry[k] === 'number');
          const unionKeys = new Set<string>([...Object.keys(nextSeries), ...currentKeys]);
          unionKeys.forEach((k) => {
            const arr = nextSeries[k] ? [...nextSeries[k]] : [];
            const val = entry[k];
            if (typeof val === 'number' && Number.isFinite(val)) {
              arr.push(Number(val));
            } else {
              // carry forward last known value; if none, append NaN to keep length consistent
              const last = arr.length > 0 ? arr[arr.length - 1] : NaN;
              arr.push(last);
            }
            nextSeries[k] = arr.length > maxPoints3D ? arr.slice(arr.length - maxPoints3D) : arr;
          });
          store[dt] = { timestamps: trimmedTimestamps, seriesMap: nextSeries };
        });
        try {
          if (typeof window !== 'undefined') {
            window.sessionStorage.setItem('chartHistoryStore', JSON.stringify(store));
          }
        } catch {}
        setHistoryVersion(v => v + 1);
        setDeviceMap(result.deviceMap);
    };

    const handleError = (_err: any) => {
        // On error, still append a tick with carry-forward values for all known device types
        const store = chartHistoryRef.current;
        const nowMs = Date.now();
        const rounded = Math.floor(nowMs / updateIntervalMs) * updateIntervalMs;
        const tickTs = new Date(rounded).toISOString().split('.')[0].replace('T', ' ');
        const types = Object.keys(store || {});
        types.forEach((dt) => {
          const existing = store[dt] || { timestamps: [], seriesMap: {} };
          const nextTimestamps = [...existing.timestamps, tickTs];
          const trimmedTimestamps = nextTimestamps.length > maxPoints3D ? nextTimestamps.slice(nextTimestamps.length - maxPoints3D) : nextTimestamps;
          const nextSeries: Record<string, number[]> = {};
          Object.keys(existing.seriesMap || {}).forEach((k) => {
            const arr = existing.seriesMap[k] ? [...existing.seriesMap[k]] : [];
            const last = arr.length > 0 ? arr[arr.length - 1] : NaN;
            arr.push(last);
            nextSeries[k] = arr.length > maxPoints3D ? arr.slice(arr.length - maxPoints3D) : arr;
          });
          store[dt] = { timestamps: trimmedTimestamps, seriesMap: nextSeries };
        });
        try {
          if (typeof window !== 'undefined') {
            window.sessionStorage.setItem('chartHistoryStore', JSON.stringify(store));
          }
        } catch {}
        setHistoryVersion(v => v + 1);
    };

    if (currentRegion === "Spray") {
        let timer: any = null;
        let currentToken = auth.user.id_token;
        const tick = async () => {
             try {
                 const res = await fetchWithAuthRetry(
                     "https://6ts7sjoaw6.execute-api.ap-southeast-2.amazonaws.com/test/NS_get_avg",
                     {}, 
                     currentToken, 
                     getIdTokenAsync
                 );
                 const data = await res.json();
                 let parsed = data;
                 if (data.body && typeof data.body === 'string') {
                     try { parsed = JSON.parse(data.body); } catch {}
                 }
                 if (Array.isArray(parsed)) {
                    const map: Record<string, any> = {};
                    parsed.forEach((p: any) => {
                        const key = p.DeviceType || p.name || p.id || p.DeviceID;
                        if (key) map[String(key)] = p;
                    });
                    if (Object.keys(map).length > 0) parsed = map;
                 }
                 handleResult({ deviceMap: parsed });
             } catch (e) {
                 handleError(e);
             }
        };
        
        tick();
        timer = window.setInterval(tick, updateIntervalMs);
        
        pollerRef.current = {
            stop: () => { if (timer) window.clearInterval(timer); },
            start: () => {}
        } as any;
        
    } else {
        const targetIMEI = multiIMEI ? ["866597079361000", "863013070187264"] : IMEI;
        const poller = createLatestDpPoller({
          IMEI: targetIMEI,
          idToken: auth.user.id_token,
          getIdToken: getIdTokenAsync,
          intervalMs: updateIntervalMs,
          callback: handleResult,
          errorCallback: handleError,
        });
        pollerRef.current = poller;
        poller.start();
    }
    return () => {
      if (pollerRef.current) {
        try { pollerRef.current.stop(); } catch {}
        pollerRef.current = null;
      }
    };
  }, [IMEI, multiIMEI, auth.user?.id_token, updateIntervalMs, currentRegion]);

  // Bubble selection to parent if requested
  useEffect(() => {
    onMeshSelected?.(selectedMeshName || null);
  }, [selectedMeshName, onMeshSelected]);

  // Update allowed device types when IMEI changes
  useEffect(() => {
    if (currentRegion === "Spray") {
        setAllowedDeviceTypes3D(['East', 'West', 'South', 'North', 'Inlet1', 'Inlet2', 'Inlet3', 'Inlet4','Weather','Elec_Meter']);
    } else if (multiIMEI) {
      const allowed = ["866597079361000", "863013070187264"].flatMap(imei => allowedByDeviceId[imei] || []);
      // In multi-IMEI mode, the keys in deviceMap will be prefixed (e.g. IMEI_Type)
      // We need to anticipate this or just allow the raw types from allowedByDeviceId?
      // Actually, createLatestDpPoller creates keys like "IMEI_Type".
      // But allowedByDeviceId contains raw types like "Type".
      // We probably should rely on what's in deviceMap for the dropdown in this mode, 
      // or construct the expected keys.
      // For now, let's just use the raw types combined with IMEI if we want to be precise, 
      // but let's see how realtimeDeviceOptions3D works.
      
      // realtimeDeviceOptions3D filters deviceMap keys.
      // deviceMap keys are "IMEI_Type".
      // allowedDeviceTypes3D usually contains "Type" (from getIMEIList).
      
      // If deviceMap has "866..._Controller", and allowedDeviceTypes3D has "Controller".
      // realtimeDeviceOptions3D:
      // return allowed?.length ? keys.filter(k => allowed.includes(k)) : keys;
      
      // "Controller" does not include "866..._Controller".
      // So realtimeDeviceOptions3D will be empty if we just put "Controller" in allowedDeviceTypes3D.
      
      // We need to put the expected prefixed keys into allowedDeviceTypes3D, OR
      // adjust realtimeDeviceOptions3D logic.
      
      // Adjusting realtimeDeviceOptions3D seems safer/better.
      setAllowedDeviceTypes3D(allowed); 
    } else {
      setAllowedDeviceTypes3D(allowedByDeviceId[String(IMEI)] || []);
    }
  }, [IMEI, allowedByDeviceId, multiIMEI, currentRegion]);

  // Compute realtime device options filtered by dev_access
  const realtimeDeviceOptions3D = useMemo(() => {
    const keys = deviceMap && typeof deviceMap === "object" ? Object.keys(deviceMap) : [];
    const allowed = Array.isArray(allowedDeviceTypes3D) ? allowedDeviceTypes3D : [];
    if (!allowed.length) return keys;
    
    // If multiIMEI, we might need fuzzy match or prefix match if allowed list doesn't have prefixes
    if (multiIMEI) {
        // allowed has ["Controller", ...], keys have ["IMEI_Controller", ...]
        return keys.filter(k => {
            // check if k ends with any of the allowed types (preceded by _)
            return allowed.some(a => k.endsWith(`_${a}`) || k === a);
        });
    }

    return keys.filter(k => allowed.includes(k));
  }, [deviceMap, allowedDeviceTypes3D, multiIMEI]);

  // Check if a mesh name maps to an allowed realtime device option
  const isMeshAllowed = useCallback((name: string | null) => {
    if (!name) return false;

    if (currentRegion === "Spray") {
         const allowed = ['East', 'West', 'South', 'North', 'Inlet1', 'Inlet2', 'Inlet3', 'Inlet4','Weather','Elec_Meter'];
         return allowed.includes(name);
    }

    // Special case for Multi-IMEI (e.g. TuenMun)
    if (multiIMEI) {
      const allowed = ["866597079361000", "863013070187264"];
      return allowed.includes(name);
    }

    const opts = realtimeDeviceOptions3D;
    if (!opts || opts.length === 0) return false;
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const meshNorm = norm(name);
    if (opts.includes(name)) return true;
    return !!opts.find(o => {
      const on = norm(o);
      return on.includes(meshNorm) || meshNorm.includes(on);
    });
  }, [realtimeDeviceOptions3D, multiIMEI, currentRegion]);

  // When a mesh is clicked, select single or multi depending on Ctrl/Shift keys
  const handleMeshSelected = useCallback((name: string | null) => {
    if (!name) { setSelectedMeshName(null); return; }
    // Gate selection: only allow if mesh maps to an allowed device type
    if (!isMeshAllowed(name)) return;
    setSelectedMeshName(name);
    setSelectedMeshNames((prev) => {
      if (multiKeyDown) {
        if (prev.includes(name)) {
          return prev.filter((n) => n !== name);
        }
        return [...prev, name];
      }
      return [name];
    });
    const opts = realtimeDeviceOptions3D;
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const meshNorm = norm(name);
    let next: string | null = null;
    if (opts.includes(name)) {
      next = name;
    } else {
      next = opts.find(o => {
        const on = norm(o);
        return on.includes(meshNorm) || meshNorm.includes(on);
      }) || null;
    }
    const chosen = next || opts[0];
    setRtDevice3D(chosen);
    setSelectedDeviceTypes3D(prev => {
      if (multiKeyDown) {
        const set = new Set(prev);
        if (set.has(chosen)) set.delete(chosen); else set.add(chosen);
        return Array.from(set);
      }
      // Without Ctrl/Shift, switch to single selection
      return [chosen];
    });
  }, [realtimeDeviceOptions3D, isMeshAllowed, multiKeyDown]);

  // Keep multi-select in sync with available options and select a sensible default
  useEffect(() => {
    const opts = realtimeDeviceOptions3D;
    if (!opts || opts.length === 0) { setRtDevice3D(""); setSelectedDeviceTypes3D([]); return; }
    // Sync multi-select with options, preserving prior selections when possible
    setSelectedDeviceTypes3D(prev => {
      const allowedSet = new Set(opts);
      const intersection = prev.filter(d => allowedSet.has(d));
      const next = intersection.length > 0 ? intersection : opts;
      const same = prev.length === next.length && prev.every(v => next.includes(v));
      return same ? prev : next;
    });
    // Maintain rtDevice3D as last selected or fallback
    if (!rtDevice3D || !opts.includes(rtDevice3D)) {
      if (selectedMeshName && opts.includes(selectedMeshName)) {
        setRtDevice3D(selectedMeshName);
      } else {
        setRtDevice3D(opts[0]);
      }
    }
  }, [realtimeDeviceOptions3D, selectedMeshName]);

  if (!geojson) return <div>Loading…</div>;
  const backMainMap = () => {
    setCurrentRegion("China");
    setMode("map");
  };
  return (
    <div style={{ display: "flex", width: "100%", height: "100vh" }}>
      <div style={{ flex: "1 1 auto", position: "relative" ,width: "70%",}}>
        <div style={{ position: "absolute", top: 16, left: 16, zIndex: 1, padding: "8px 12px", borderRadius: 8 }}>
          <button className="brand-button" onClick={backMainMap}>Back to main map</button>
        </div>
        <div style={{ position: "absolute", top: 70, left: 16, zIndex: 1, padding: "8px 12px", borderRadius: 8, backgroundColor: "rgba(0, 0, 0, 0)" }}>
        <a href={asset('/login')}>
          <Image src={asset('/2d.png')} alt="Latest" width={36} height={36} />
        </a>
        </div>
        <Canvas
          camera={{ position: [33.4, -202.9, 447.9], fov: 45 }}
          onCreated={({ gl }) => {
            // Align renderer with glTF viewer defaults for correct texture appearance
            gl.outputColorSpace = THREE.SRGBColorSpace;
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.0;
          }}
        >
          <CanvasDecor mode={mode} currentRegion={currentRegion} />
          {/* Add environment lighting for PBR materials to look correct */}
          <Environment preset="warehouse" background={false} />
          <ambientLight intensity={1.5} />
          {/* <directionalLight position={[0, 200, 0]} intensity={1.0} /> */}
          {/* Bottom fill light to brighten underside of the scene */}
          {/* <directionalLight position={[0, -200, 0]} intensity={2.5}/> */}
           {mode !== "detail" && <MapScene geojson={geojson} controlsRef={controlsRef} onSelectName={setSelectedLabel} selectedName={selectedLabel} region={currentRegion} devices={imeiList} onSelectIMEI={setIMEI} showPillars={mode === "region"} showMarkers={mode === "map"} onFilteredDevices={setVisibleDevices} />}
          {mode === "detail" && selectedLabel === "BOCYH" && (
            <Suspense fallback={<Html center><div className="r3d-loader" /><div style={{ marginTop: 8, color: "#fff" }}>Loading model…</div></Html>}>
              <CMADetail
                glbName={asset('/3dmodel/1403.glb')}
                controlsRef={controlsRef}
                onMeshSelected={handleMeshSelected}
                selectedMeshNames={selectedMeshNames}
                isMeshAllowed={isMeshAllowed}
                onModelLoaded={() => setDetailModelLoaded(true)}
                showInlineChart={!panelVisible}
                chartDeviceMap={deviceMap}
                chartDeviceTypes={selectedDeviceTypes3D.length > 0 ? selectedDeviceTypes3D : Object.keys(deviceMap)}
                chartDataTypes={selectedDataTypes3D}
                chartMaxPoints={maxPoints3D}
                chartHistoryRef={chartHistoryRef}
                historyVersion={historyVersion}
              />
            </Suspense>
          )}
          {mode === "detail" && selectedLabel === "BOCDSS" && (
            <Suspense fallback={<Html center><div className="r3d-loader" /><div style={{ marginTop: 8, color: "#fff" }}>Loading model…</div></Html>}>
              <CMADetail
                glbName={asset('/3dmodel/CMA+.glb')}
                controlsRef={controlsRef}
                onMeshSelected={handleMeshSelected}
                selectedMeshNames={selectedMeshNames}
                isMeshAllowed={isMeshAllowed}
                onModelLoaded={() => setDetailModelLoaded(true)}
                showInlineChart={!panelVisible}
                chartDeviceMap={deviceMap}
                chartDeviceTypes={selectedDeviceTypes3D}
                chartDataTypes={selectedDataTypes3D}
                chartMaxPoints={maxPoints3D}
                chartHistoryRef={chartHistoryRef}
                historyVersion={historyVersion}
              />
            </Suspense>
          )}
          {mode === "detail" && selectedLabel === "屯门区" && (
            <Suspense fallback={<Html center><div className="r3d-loader" /><div style={{ marginTop: 8, color: "#fff" }}>Loading model…</div></Html>}>
              <MultiIMEI
                glbName={asset('/3dmodel/NCCO.glb')}
                controlsRef={controlsRef}
                onMeshSelected={handleMeshSelected}
                selectedMeshNames={selectedMeshNames}
                isMeshAllowed={isMeshAllowed}
                onModelLoaded={() => setDetailModelLoaded(true)}
                showInlineChart={!panelVisible}
                chartDeviceMap={deviceMap}
                chartDeviceTypes={selectedDeviceTypes3D}
                chartDataTypes={selectedDataTypes3D}
                chartMaxPoints={maxPoints3D}
                chartHistoryRef={chartHistoryRef}
                historyVersion={historyVersion}
              />
            </Suspense>
          )}{mode === "detail" && selectedLabel === "南沙区" && (
            <Suspense fallback={<Html center><div className="r3d-loader" /><div style={{ marginTop: 8, color: "#fff" }}>Loading model…</div></Html>}>
              <MultiIMEI
                glbName={asset('/3dmodel/spray.glb')}
                controlsRef={controlsRef}
                onMeshSelected={handleMeshSelected}
                selectedMeshNames={selectedMeshNames}
                isMeshAllowed={isMeshAllowed}
                onModelLoaded={() => setDetailModelLoaded(true)}
                showInlineChart={!panelVisible}
                chartDeviceMap={deviceMap}
                chartDeviceTypes={selectedDeviceTypes3D}
                chartDataTypes={selectedDataTypes3D}
                chartMaxPoints={maxPoints3D}
                chartHistoryRef={chartHistoryRef}
                historyVersion={historyVersion}
              />
            </Suspense>
          )}
          <CameraInit
            controlsRef={controlsRef}
            initial={{ position: [33.4, -202.9, 447.9], radius: 494.5, alphaDeg: 1.0, betaDeg: 116.2 }}
          />
          <OrbitControls ref={controlsRef} enableDamping dampingFactor={0.08} />
        </Canvas>
      </div>
      {mode === "detail" && detailModelLoaded && panelVisible && (
        <div style={{ flex: "0 0 400px", width: 400, minWidth: 320, flexShrink: 0, background: "rgba(1, 7, 22, 0.9)", color: "#fff", padding: 12, overflowY: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ fontWeight: 700 }}>Detail Metrics</div>
            <button
              onClick={() => setPanelVisible(false)}
              title="Hide panel"
              style={{ background: "rgba(255,255,255,0.1)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 4, padding: "4px 8px", cursor: "pointer" }}
            >
              →
            </button>
          </div>
          {IMEI ? (
            selectedMeshNames.length > 0 ? (
              <>
                <div style={{ marginBottom: 12 }}>
                  <div className="control-row" style={{ marginBottom: 8}}>
                    <label style={{ marginRight: 8 }}>Realtime Devices:</label>
                    <select
                      multiple
                      value={selectedDeviceTypes3D}
                      onChange={(e) => {
                        const selected = Array.from(e.target.selectedOptions).map(o => o.value);
                        setSelectedDeviceTypes3D(selected);
                        const last = selected[selected.length - 1];
                        if (last) setRtDevice3D(last);
                      }}
                      size={Math.min(6, Math.max(2, realtimeDeviceOptions3D.length))}
                      style={{ background: "rgba(255, 255, 255, 0.9)", color: "rgba(0, 0, 0, 0.9)", minWidth: 220 }}
                    >
                      {realtimeDeviceOptions3D.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                    <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
                      Tip: Use Ctrl/Shift to multi-select. Click meshes to toggle.
                    </div>
                  </div>
                  <div className="control-row" style={{ marginBottom: 8 }}>
                    <label style={{ marginRight: 8, display: "block" }}>Data Types:</label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                      {availableDataTypes3D.map((t) => {
                        const checked = selectedDataTypes3D.includes(t);
                        return (
                          <label key={t} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.9)", color: "rgba(0,0,0,0.9)", padding: "6px 8px", borderRadius: 6 }}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                setSelectedDataTypes3D(prev => {
                                  const set = new Set(prev);
                                  if (e.target.checked) set.add(t); else set.delete(t);
                                  return Array.from(set);
                                });
                              }}
                            />
                            {t}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <div className="control-row" style={{ marginBottom: 8 }}>
                    <label style={{ marginRight: 8 }}>Update Interval:</label>
                    <select
                      value={String(updateIntervalMs)}
                      onChange={(e) => setUpdateIntervalMs(Number(e.target.value))}
                      style={{ background: "rgba(255, 255, 255, 0.9)", color: "rgba(0, 0, 0, 0.9)"}}
                    >
                      <option value={10000}>10s</option>
                      <option value={30000}>30s</option>
                      <option value={60000}>1 min</option>
                      <option value={300000}>5 min</option>
                    </select>
                  </div>
                  <div className="control-row">
                    <label style={{ marginRight: 8 }}>Max Points:</label>
                    <input
                      type="number"
                      min={5}
                      max={500}
                      step={5}
                      value={maxPoints3D}
                      onChange={(e) => setMaxPoints3D(Math.max(1, Number(e.target.value) || 10))}
                      style={{background: "rgba(255, 255, 255, 0.9)", color: "rgba(0, 0, 0, 0.9)"}}
                    />
                  </div>
                </div>
                {selectedDeviceTypes3D && selectedDeviceTypes3D.length > 0 ? (
                  selectedDeviceTypes3D.map((dt) => (
                    <React.Fragment key={dt}>
                      <LatestDashboard deviceMap={deviceMap} device={[dt]} dataType={selectedDataTypes3D} compact />
                      <LatestLineChart deviceMap={deviceMap} deviceType={dt} dataType={selectedDataTypes3D} maxPoints={maxPoints3D} title="Realtime Line Chart" height={180} historyRef={chartHistoryRef} version={historyVersion} />
                    </React.Fragment>
                  ))
                ) : (
                  <div>Select one or more device types to view metrics</div>
                )}
              </>
            ) : (
              <div>Click a model mesh to show gauges and chart</div>
            )
          ) : (
            <div>No IMEI available for this user</div>
          )}
        </div>
      )}
      {mode === "detail" && detailModelLoaded && !panelVisible && (
        <button
          onClick={() => setPanelVisible(true)}
          title="Show panel"
          style={{ position: "fixed", right: 0, top: "50%", transform: "translateY(-50%)", zIndex: 1000, background: "rgba(1, 7, 22, 0.9)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)", borderRight: "none", borderRadius: "6px 0 0 6px", padding: "10px 12px", cursor: "pointer" }}
        >
          ←
        </button>
      )}
    </div>
  );
}

function CameraInit({ controlsRef, initial }: { controlsRef: any; initial: { position: [number, number, number]; radius: number; alphaDeg: number; betaDeg: number } }) {
  const { camera, size } = useThree();
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
function CMADetail({glbName, controlsRef, onMeshSelected, selectedMeshNames = [], isMeshAllowed, onModelLoaded, showInlineChart = false, chartDeviceMap, chartDeviceTypes, chartDataTypes = [], chartMaxPoints = 10,historyVersion, chartHistoryRef }: { glbName?: string; controlsRef: any; onMeshSelected?: (name: string | null) => void; selectedMeshNames?: string[]; isMeshAllowed?: (name: string) => boolean; onModelLoaded?: () => void; showInlineChart?: boolean; chartDeviceMap?: any; chartDeviceTypes?: string[]; chartDataTypes?: string[]; chartMaxPoints?: number; historyVersion?:number; chartHistoryRef?: React.MutableRefObject<Record<string, { timestamps: string[]; seriesMap: Record<string, number[]> }>> }) {
  const { camera, size } = useThree();
  const gltf: any = useGLTF(glbName);
  const groupRef = useRef<THREE.Group>(null);
  const [glows, setGlows] = useState<{ name: string; center: [number, number, number]; radius: number }[]>([]);
  const chartPosRef = useRef<Record<string, [number, number, number]>>({});
  const [chartPosVersion, setChartPosVersion] = useState(0);
  const dragRef = useRef<{ key: string; base: [number, number, number]; startX: number; startY: number; pointerId?: number } | null>(null);
  
  useEffect(() => {
    if (!gltf?.scene) return;
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
    onModelLoaded?.();
  }, [gltf, controlsRef, camera]);

  // Force all materials' metalness to 0 for non-metallic look
  useEffect(() => {
    if (!gltf?.scene) return;
    try {
      gltf.scene.traverse((obj: any) => {
        const mat = (obj as any)?.material;
        if (!mat) return;
        if (Array.isArray(mat)) {
          mat.forEach((m: any) => {
            if (typeof m.metalness === 'number') { m.metalness = 0.0; m.needsUpdate = true; }
          });
        } else if (typeof mat.metalness === 'number') {
          mat.metalness = 0.0;
          mat.needsUpdate = true;
        }
      });
    } catch {}
  }, [gltf]);

  useEffect(() => {
    const res: { name: string; center: [number, number, number]; radius: number }[] = [];
    if (!gltf?.scene) { setGlows([]); return; }
    selectedMeshNames.forEach((n) => {
      const obj = gltf.scene.getObjectByName?.(n);
      if (!obj) return;
      const box = new THREE.Box3().setFromObject(obj);
      const sphere = new THREE.Sphere();
      box.getBoundingSphere(sphere);
      const worldCenter = sphere.center.clone();
      const localCenter = worldCenter.clone();
      if (groupRef.current) {
        groupRef.current.worldToLocal(localCenter);
      }
      res.push({ name: n, center: [localCenter.x, localCenter.y, localCenter.z], radius: sphere.radius });
    });
    setGlows(res);
  }, [selectedMeshNames, gltf]);

  return (
    <group ref={groupRef}>
      {gltf?.scene && (
      <primitive
        object={gltf.scene}
        onPointerDown={(e) => {
          e.stopPropagation();
          const obj = e.object as THREE.Object3D;
          const meshName = (obj as any)?.name || "Unnamed";
          if (isMeshAllowed && !isMeshAllowed(meshName)) {
            return;
          }
          onMeshSelected?.(meshName);
        }}
      />)}
      {glows.map((g) => (
        <GlowShell key={g.name} center={g.center} radius={g.radius} />
      ))}
      {glows.length > 0 && showInlineChart && chartDeviceMap && chartDeviceTypes && chartDeviceTypes.length > 0 && (() => {
        const placed: { box: { minX: number; minY: number; maxX: number; maxY: number }; pos: [number, number, number]; dt: string }[] = [];
        const BOX_W = 200;
        const BOX_H = 140;
        const stepX = 24;
        const stepY = 18;
        const project = (p: THREE.Vector3) => {
          const v = p.clone().project(camera);
          return [(v.x * 0.5 + 0.5) * size.width, (-v.y * 0.5 + 0.5) * size.height] as [number, number];
        };
        const worldOffset = (base: THREE.Vector3, dx: number, dy: number) => {
          const f = new THREE.Vector3();
          camera.getWorldDirection(f);
          const u = camera.up.clone().normalize();
          const r = new THREE.Vector3().crossVectors(f, u).normalize();
          const p0 = project(base);
          const pR = project(base.clone().add(r.clone().multiplyScalar(1)));
          const pU = project(base.clone().add(u.clone().multiplyScalar(1)));
          const pxPerUnitX = Math.max(1e-3, Math.abs(pR[0] - p0[0]));
          const pxPerUnitY = Math.max(1e-3, Math.abs(pU[1] - p0[1]));
          const wx = dx / pxPerUnitX;
          const wy = dy / pxPerUnitY;
          return base.clone().add(r.multiplyScalar(wx)).add(u.multiplyScalar(wy));
        };
        const overlaps = (a: { minX: number; minY: number; maxX: number; maxY: number }) => {
          for (const b of placed) {
            if (!(a.maxX < b.box.minX || a.minX > b.box.maxX || a.maxY < b.box.minY || a.minY > b.box.maxY)) return true;
          }
          return false;
        };
        const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
        glows.forEach((g) => {
          const meshNorm = norm(g.name);
          const dt = chartDeviceTypes.find((d) => {
            const dn = norm(d);
            return dn.includes(meshNorm) || meshNorm.includes(dn);
          }) || chartDeviceTypes[0];
          const base = new THREE.Vector3(g.center[0], g.center[1] + g.radius * 0.9, g.center[2]);
          let dx = 0;
          let dy = 0;
          let posWorld = base;
          const override = chartPosRef.current[dt];
          if (override) {
            const [sx, sy] = project(new THREE.Vector3(override[0], override[1], override[2]));
            const box = { minX: sx - BOX_W / 2, minY: sy - BOX_H / 2, maxX: sx + BOX_W / 2, maxY: sy + BOX_H / 2 };
            placed.push({ box, pos: [override[0], -override[1], override[2]], dt });
            return;
          }
          for (let t = 0; t < 50; t++) {
            posWorld = worldOffset(base, dx, dy);
            const [sx, sy] = project(posWorld);
            const box = { minX: sx - BOX_W / 2, minY: sy - BOX_H / 2, maxX: sx + BOX_W / 2, maxY: sy + BOX_H / 2 };
            if (!overlaps(box)) { placed.push({ box, pos: [posWorld.x, posWorld.y, posWorld.z], dt }); break; }
            const k = t + 1;
            const sign = k % 2 === 0 ? -1 : 1;
            dx = sign * Math.ceil(k / 2) * stepX;
            if (k % 4 === 0) dy += stepY;
          }
          if (placed.length === 0) {
            const [sx, sy] = project(posWorld);
            const box = { minX: sx - BOX_W / 2, minY: sy - BOX_H / 2, maxX: sx + BOX_W / 2, maxY: sy + BOX_H / 2 };
            placed.push({ box, pos: [posWorld.x, posWorld.y, posWorld.z], dt });
          }
        });
        return placed.map((p, idx) => {
          const base = new THREE.Vector3(p.pos[0], p.pos[1], p.pos[2]);
          const handleWorld = worldOffset(base, -BOX_W / 2 - 14, -BOX_H / 2 - 14);
          const onDown = (e: any) => {
            e.stopPropagation();
            if (e.button !== 0) return;
            try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch {}
            dragRef.current = { key: p.dt, base: chartPosRef.current[p.dt] || p.pos, startX: e.clientX, startY: e.clientY, pointerId: e.pointerId } as any;
          };
          const onMove = (e: any) => {
            if (!dragRef.current) return;
            if (e.buttons !== 1) return;
            if (dragRef.current.pointerId !== undefined && e.pointerId !== dragRef.current.pointerId) return;
            e.stopPropagation();
            const d = dragRef.current as any;
            const dx2 = e.clientX - d.startX;
            const dy2 = e.clientY - d.startY;
            const next = worldOffset(new THREE.Vector3(d.base[0], d.base[1], d.base[2]), dx2, dy2);
            chartPosRef.current[d.key] = [next.x, next.y, next.z];
            setChartPosVersion(v => v + 1);
          };
          const onUp = (e: any) => {
            e.stopPropagation();
            try { e.currentTarget.releasePointerCapture?.(e.pointerId); } catch {}
            dragRef.current = null;
          };
          const onLeave = (e: any) => {
            if (!dragRef.current) return;
            try { e.currentTarget.releasePointerCapture?.(e.pointerId); } catch {}
            dragRef.current = null;
          };
          return (
            <React.Fragment key={`frag-${idx}`}>
              <Html center position={p.pos} style={{ pointerEvents: "none", userSelect: "none" }}>
                <div style={{ transform: "scale(0.6)", transformOrigin: "top center" }}>
                  <div style={{ width: 450, maxWidth: 450, background: "rgba(0,0,0,0.8)", color: "#fff", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 12, padding: 6, boxShadow: "0 6px 16px rgba(0,0,0,0.4)", fontSize: 14, lineHeight: 1.35 }}>
                    <div style={{ marginBottom: 6 }}>
                      <LatestDashboard deviceMap={chartDeviceMap} device={[p.dt]} dataType={chartDataTypes} compact />
                    </div>
                    <LatestLineChart
                      deviceMap={chartDeviceMap}
                      deviceType={p.dt}
                      dataType={chartDataTypes}
                      maxPoints={chartMaxPoints}
                      title="Realtime Line Chart"
                      height={120}
                      historyRef={chartHistoryRef}
                      version={historyVersion}
                    />
                  </div>
                </div>
              </Html>
              <Html center position={[handleWorld.x, handleWorld.y, handleWorld.z]} style={{ pointerEvents: "auto" }}>
                <div onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onLeave} style={{ width: 16, height: 16, borderRadius: 8, background: "#66ccff", boxShadow: "0 0 8px rgba(102,204,255,0.8)", cursor: "grab" }} />
              </Html>
            </React.Fragment>
          );
        });
      })()}
    </group>
  );
}
function MultiIMEI({glbName, controlsRef, onMeshSelected, selectedMeshNames = [], isMeshAllowed, onModelLoaded, showInlineChart = false, chartDeviceMap, chartDeviceTypes, chartDataTypes = [], chartMaxPoints = 10,historyVersion, chartHistoryRef }: { glbName?: string; controlsRef: any; onMeshSelected?: (name: string | null) => void; selectedMeshNames?: string[]; isMeshAllowed?: (name: string) => boolean; onModelLoaded?: () => void; showInlineChart?: boolean; chartDeviceMap?: any; chartDeviceTypes?: string[]; chartDataTypes?: string[]; chartMaxPoints?: number; historyVersion?:number; chartHistoryRef?: React.MutableRefObject<Record<string, { timestamps: string[]; seriesMap: Record<string, number[]> }>> }) {
  const { camera, size } = useThree();
  const gltf: any = useGLTF(glbName);
  const groupRef = useRef<THREE.Group>(null);
  const [glows, setGlows] = useState<{ name: string; center: [number, number, number]; radius: number }[]>([]);
  const chartPosRef = useRef<Record<string, [number, number, number]>>({});
  const [chartPosVersion, setChartPosVersion] = useState(0);
  const dragRef = useRef<{ key: string; base: [number, number, number]; startX: number; startY: number; pointerId?: number } | null>(null);
  
  useEffect(() => {
    if (!gltf?.scene) return;
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
    onModelLoaded?.();
  }, [gltf, controlsRef, camera]);

  // Force all materials' metalness to 0 for non-metallic look
  useEffect(() => {
    if (!gltf?.scene) return;
    try {
      gltf.scene.traverse((obj: any) => {
        const mat = (obj as any)?.material;
        if (!mat) return;
        if (Array.isArray(mat)) {
          mat.forEach((m: any) => {
            if (typeof m.metalness === 'number') { m.metalness = 0.0; m.needsUpdate = true; }
          });
        } else if (typeof mat.metalness === 'number') {
          mat.metalness = 0.0;
          mat.needsUpdate = true;
        }
      });
    } catch {}
  }, [gltf]);

  useEffect(() => {
    const res: { name: string; center: [number, number, number]; radius: number }[] = [];
    if (!gltf?.scene) { setGlows([]); return; }
    selectedMeshNames.forEach((n) => {
      const obj = gltf.scene.getObjectByName?.(n);
      if (!obj) return;
      const box = new THREE.Box3().setFromObject(obj);
      const sphere = new THREE.Sphere();
      box.getBoundingSphere(sphere);
      const worldCenter = sphere.center.clone();
      const localCenter = worldCenter.clone();
      if (groupRef.current) {
        groupRef.current.worldToLocal(localCenter);
      }
      res.push({ name: n, center: [localCenter.x, localCenter.y, localCenter.z], radius: sphere.radius });
    });
    setGlows(res);
    
    console.log("Selected mesh:", isMeshAllowed);
  }, [selectedMeshNames, gltf]);

  return (
    <group ref={groupRef}>
      {gltf?.scene && (
      <primitive
        object={gltf.scene}
        onPointerDown={(e) => {
          e.stopPropagation();
          const obj = e.object as THREE.Object3D;
          const meshName = (obj as any)?.name || "Unnamed";
          if (isMeshAllowed && !isMeshAllowed(meshName)) {
            return;
          }
          onMeshSelected?.(meshName);
        }}
      />)}
      {glows.map((g) => (
        <GlowShell key={g.name} center={g.center} radius={g.radius} />
      ))}
      {glows.length > 0 && showInlineChart && chartDeviceMap && chartDeviceTypes && chartDeviceTypes.length > 0 && (() => {
        const placed: { box: { minX: number; minY: number; maxX: number; maxY: number }; pos: [number, number, number]; dt: string }[] = [];
        const BOX_W = 200;
        const BOX_H = 140;
        const stepX = 24;
        const stepY = 18;
        const project = (p: THREE.Vector3) => {
          const v = p.clone().project(camera);
          return [(v.x * 0.5 + 0.5) * size.width, (-v.y * 0.5 + 0.5) * size.height] as [number, number];
        };
        const worldOffset = (base: THREE.Vector3, dx: number, dy: number) => {
          const f = new THREE.Vector3();
          camera.getWorldDirection(f);
          const u = camera.up.clone().normalize();
          const r = new THREE.Vector3().crossVectors(f, u).normalize();
          const p0 = project(base);
          const pR = project(base.clone().add(r.clone().multiplyScalar(1)));
          const pU = project(base.clone().add(u.clone().multiplyScalar(1)));
          const pxPerUnitX = Math.max(1e-3, Math.abs(pR[0] - p0[0]));
          const pxPerUnitY = Math.max(1e-3, Math.abs(pU[1] - p0[1]));
          const wx = dx / pxPerUnitX;
          const wy = dy / pxPerUnitY;
          return base.clone().add(r.multiplyScalar(wx)).add(u.multiplyScalar(wy));
        };
        const overlaps = (a: { minX: number; minY: number; maxX: number; maxY: number }) => {
          for (const b of placed) {
            if (!(a.maxX < b.box.minX || a.minX > b.box.maxX || a.maxY < b.box.minY || a.minY > b.box.maxY)) return true;
          }
          return false;
        };
        const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
        glows.forEach((g) => {
          const meshNorm = norm(g.name);
          const dt = chartDeviceTypes.find((d) => {
            const dn = norm(d);
            return dn.includes(meshNorm) || meshNorm.includes(dn);
          }) || chartDeviceTypes[0];
          const base = new THREE.Vector3(g.center[0], g.center[1] + g.radius * 0.9, g.center[2]);
          let dx = 0;
          let dy = 0;
          let posWorld = base;
          const override = chartPosRef.current[dt];
          if (override) {
            const [sx, sy] = project(new THREE.Vector3(override[0], override[1], override[2]));
            const box = { minX: sx - BOX_W / 2, minY: sy - BOX_H / 2, maxX: sx + BOX_W / 2, maxY: sy + BOX_H / 2 };
            placed.push({ box, pos: [override[0], -override[1], override[2]], dt });
            return;
          }
          for (let t = 0; t < 50; t++) {
            posWorld = worldOffset(base, dx, dy);
            const [sx, sy] = project(posWorld);
            const box = { minX: sx - BOX_W / 2, minY: sy - BOX_H / 2, maxX: sx + BOX_W / 2, maxY: sy + BOX_H / 2 };
            if (!overlaps(box)) { placed.push({ box, pos: [posWorld.x, posWorld.y, posWorld.z], dt }); break; }
            const k = t + 1;
            const sign = k % 2 === 0 ? -1 : 1;
            dx = sign * Math.ceil(k / 2) * stepX;
            if (k % 4 === 0) dy += stepY;
          }
          if (placed.length === 0) {
            const [sx, sy] = project(posWorld);
            const box = { minX: sx - BOX_W / 2, minY: sy - BOX_H / 2, maxX: sx + BOX_W / 2, maxY: sy + BOX_H / 2 };
            placed.push({ box, pos: [posWorld.x, posWorld.y, posWorld.z], dt });
          }
        });
        return placed.map((p, idx) => {
          const base = new THREE.Vector3(p.pos[0], p.pos[1], p.pos[2]);
          const handleWorld = worldOffset(base, -BOX_W / 2 - 14, -BOX_H / 2 - 14);
          const onDown = (e: any) => {
            e.stopPropagation();
            if (e.button !== 0) return;
            try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch {}
            dragRef.current = { key: p.dt, base: chartPosRef.current[p.dt] || p.pos, startX: e.clientX, startY: e.clientY, pointerId: e.pointerId } as any;
          };
          const onMove = (e: any) => {
            if (!dragRef.current) return;
            if (e.buttons !== 1) return;
            if (dragRef.current.pointerId !== undefined && e.pointerId !== dragRef.current.pointerId) return;
            e.stopPropagation();
            const d = dragRef.current as any;
            const dx2 = e.clientX - d.startX;
            const dy2 = e.clientY - d.startY;
            const next = worldOffset(new THREE.Vector3(d.base[0], d.base[1], d.base[2]), dx2, dy2);
            chartPosRef.current[d.key] = [next.x, next.y, next.z];
            setChartPosVersion(v => v + 1);
          };
          const onUp = (e: any) => {
            e.stopPropagation();
            try { e.currentTarget.releasePointerCapture?.(e.pointerId); } catch {}
            dragRef.current = null;
          };
          const onLeave = (e: any) => {
            if (!dragRef.current) return;
            try { e.currentTarget.releasePointerCapture?.(e.pointerId); } catch {}
            dragRef.current = null;
          };
          return (
            <React.Fragment key={`frag-${idx}`}>
              <Html center position={p.pos} style={{ pointerEvents: "none", userSelect: "none" }}>
                <div style={{ transform: "scale(0.6)", transformOrigin: "top center" }}>
                  <div style={{ width: 450, maxWidth: 450, background: "rgba(0,0,0,0.8)", color: "#fff", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 12, padding: 6, boxShadow: "0 6px 16px rgba(0,0,0,0.4)", fontSize: 14, lineHeight: 1.35 }}>
                    <div style={{ marginBottom: 6 }}>
                      <LatestDashboard deviceMap={chartDeviceMap} device={[p.dt]} dataType={chartDataTypes} compact />
                    </div>
                    <LatestLineChart
                      deviceMap={chartDeviceMap}
                      deviceType={p.dt}
                      dataType={chartDataTypes}
                      maxPoints={chartMaxPoints}
                      title="Realtime Line Chart"
                      height={120}
                      historyRef={chartHistoryRef}
                      version={historyVersion}
                    />
                  </div>
                </div>
              </Html>
              <Html center position={[handleWorld.x, handleWorld.y, handleWorld.z]} style={{ pointerEvents: "auto" }}>
                <div onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onLeave} style={{ width: 16, height: 16, borderRadius: 8, background: "#66ccff", boxShadow: "0 0 8px rgba(102,204,255,0.8)", cursor: "grab" }} />
              </Html>
            </React.Fragment>
          );
        });
      })()}
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
  const isDetail = mode === "detail";
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
