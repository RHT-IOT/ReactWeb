import React, { useEffect, useRef, useState } from "react";
import * as BABYLON from "babylonjs";
import "@babylonjs/loaders";
import earcut from "earcut";

// Minimal GeoJSON typing
interface GeoJSONFeature {
  type: "Feature";
  properties: Record<string, any>;
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: any;
  };
}
interface GeoJSON {
  type: "FeatureCollection";
  features: GeoJSONFeature[];
}

// Project lon/lat into Babylon XZ plane
function project([lon, lat]: number[], scale = 100): BABYLON.Vector2 {
  return new BABYLON.Vector2(lon * scale, -lat * scale);
}

// Resolve region name to canonical identifiers
function resolveRegion(name: string): "Hong Kong" | "Macau" | "China" {
  const n = (name || "").toLowerCase();
  if (n.includes("hong") || n.includes("hk") || n.includes("香港")) return "Hong Kong";
  if (n.includes("macau") || n.includes("macao") || n.includes("ao men") || n.includes("澳门")) return "Macau";
  return "China";
}

function buildPolygonMesh(
  scene: BABYLON.Scene,
  name: string,
  rings: number[][]
): BABYLON.Mesh {
  const outer = rings[0].map((pt) => project(pt));
  const holes = rings.slice(1).map((ring) => ring.map((pt) => project(pt)));

  const builder = new BABYLON.PolygonMeshBuilder(name, outer, scene, earcut);
  holes.forEach((h) => builder.addHole(h));

  const mesh = builder.build();
  // Rotate into XZ plane
  mesh.rotation.x = Math.PI / 2;
  return mesh;
}

export default function GeoJsonBabylonMap() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState("Loading…");
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [selectedMeshName, setSelectedMeshName] = useState<string | null>(null);
  const [mapFile, setMapFile] = useState<string>("China.json");
  const [currentRegion, setCurrentRegion] = useState<string>("China");
  const [mode, setMode] = useState<"map" | "detail">("map");
  const highlightRef = useRef<BABYLON.HighlightLayer | null>(null);
  const sceneRef = useRef<BABYLON.Scene | null>(null);
  const engineRef = useRef<BABYLON.Engine | null>(null);
  const cameraRef = useRef<BABYLON.ArcRotateCamera | null>(null);
  const mapRootRef = useRef<BABYLON.TransformNode | null>(null);
  const markersRootRef = useRef<BABYLON.TransformNode | null>(null);
  const furnitureRootRef = useRef<BABYLON.TransformNode | null>(null);
  const pointerHandlerRef = useRef<((pointerInfo: BABYLON.PointerInfo) => void) | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new BABYLON.Engine(canvas, true);
    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0.95, 0.97, 1, 1);
    // Global highlight layer for mesh selection
    const highlight = new BABYLON.HighlightLayer("highlight", scene);
    highlightRef.current = highlight;
    sceneRef.current = scene;
    engineRef.current = engine;

    // Perspective camera
    const camera = new BABYLON.ArcRotateCamera(
      "camera",
      Math.PI / 2,
      0.9,
      2000,
      BABYLON.Vector3.Zero(),
      scene
    );
    camera.lowerBetaLimit = 0.3;
    camera.upperBetaLimit = 1.4;
    camera.wheelPrecision = 50;
    camera.panningSensibility = 50;
    camera.attachControl(canvas, true);
    cameraRef.current = camera;

    new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);

    setStatus("Ready");

    engine.runRenderLoop(() => {
      scene.render();
    });

    const resize = () => engine.resize();
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      // dispose highlight layer explicitly before engine
      highlightRef.current?.dispose();
      highlightRef.current = null;
      engine.dispose();
    };
  }, []);

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
    } else {
      setCurrentRegion("China");
      setMode("map");
    }
  }, [selectedLabel]);

  // Swap map JSON when the region changes
  useEffect(() => {
    const next =
      currentRegion === "Hong Kong" ? "HongKong.json" :
      currentRegion === "Macau" ? "Macau.json" :
      "China.json";
    if (mapFile !== next) setMapFile(next);
  }, [currentRegion, mapFile]);

  // Build scene content when mode/mapFile/selection changes
  useEffect(() => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const highlight = highlightRef.current;
    if (!scene || !camera || !highlight) return;

    // Helper to dispose and clear a root node
    const disposeRoot = (rootRef: React.MutableRefObject<BABYLON.TransformNode | null>) => {
      if (rootRef.current) {
        rootRef.current.dispose(true, true);
        rootRef.current = null;
      }
    };

    // Clear previous content depending on mode
    disposeRoot(mapRootRef);
    disposeRoot(markersRootRef);
    disposeRoot(furnitureRootRef);

    if (mode === "map") {
      // Build map for current mapFile
      (async () => {
        try {
          setStatus(`Loading ${mapFile}…`);
          const res = await fetch(`/3dmodel/${mapFile}`);
          if (!res.ok) throw new Error(`Failed to load ${mapFile}`);
          const data: GeoJSON = await res.json();

          const baseColor = new BABYLON.Color3(0.5, 0.7, 0.9);
          const hoverColor = new BABYLON.Color3(0.9, 0.8, 0.4);
          const selectedColor = new BABYLON.Color3(0.9, 0.4, 0.3);

          const mapRoot = new BABYLON.TransformNode("mapRoot", scene);
          mapRootRef.current = mapRoot;

          let selectedRegionMesh: BABYLON.AbstractMesh | null = null;
          const regionMeshes: BABYLON.Mesh[] = [];
          let hkCenter: BABYLON.Vector3 | null = null;
          let moCenter: BABYLON.Vector3 | null = null;

          data.features.forEach((feature, idx) => {
            const { geometry, properties } = feature;
            const name = properties?.name || `region-${idx}`;

            const mat = new BABYLON.StandardMaterial(`mat-${name}`, scene);
            mat.diffuseColor = baseColor;
            mat.backFaceCulling = false;

            const makeMesh = (rings: number[][], partIndex: number) => {
              const mesh = buildPolygonMesh(scene, `${name}-${partIndex}`, rings);
              mesh.material = mat;
              mesh.metadata = { properties };
              mesh.isPickable = true;
              mesh.parent = mapRoot;

              // Region label (billboard) positioned at mesh center
              const dt = new BABYLON.DynamicTexture(`region-label-${name}`, 512, scene, false);
              dt.hasAlpha = true;
              dt.drawText(name, null, 320, "bold 96px Arial", "white", "transparent", true);
              const labelMat = new BABYLON.StandardMaterial(`mat-region-label-${name}`, scene);
              labelMat.diffuseTexture = dt;
              labelMat.emissiveTexture = dt;
              labelMat.backFaceCulling = false;
              mesh.computeWorldMatrix(true);
              const c = mesh.getBoundingInfo().boundingBox.centerWorld.clone();
              const labelPlane = BABYLON.MeshBuilder.CreatePlane(`region-label-plane-${name}`, { size: 240 }, scene);
              labelPlane.material = labelMat;
              labelPlane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
              labelPlane.position = new BABYLON.Vector3(c.x, c.y + 180, c.z);
              labelPlane.isVisible = false;
              labelPlane.isPickable = false;
              labelPlane.parent = mapRoot;

              // Cache centers for HK/Macau markers placement on China map
              const resolved = resolveRegion(name);
              if (resolved === "Hong Kong") hkCenter = c.clone();
              if (resolved === "Macau") moCenter = c.clone();

              mesh.actionManager = new BABYLON.ActionManager(scene);

              mesh.actionManager.registerAction(
                new BABYLON.ExecuteCodeAction(
                  BABYLON.ActionManager.OnPointerOverTrigger,
                  () => {
                    if (mesh !== selectedRegionMesh) {
                      (mesh.material as BABYLON.StandardMaterial).diffuseColor = hoverColor;
                    }
                    labelPlane.isVisible = true;
                  }
                )
              );

              mesh.actionManager.registerAction(
                new BABYLON.ExecuteCodeAction(
                  BABYLON.ActionManager.OnPointerOutTrigger,
                  () => {
                    if (mesh !== selectedRegionMesh) {
                      (mesh.material as BABYLON.StandardMaterial).diffuseColor = baseColor;
                    }
                    labelPlane.isVisible = false;
                  }
                )
              );

              mesh.actionManager.registerAction(
                new BABYLON.ExecuteCodeAction(
                  BABYLON.ActionManager.OnPickTrigger,
                  () => {
                    if (selectedRegionMesh && selectedRegionMesh !== mesh) {
                      (selectedRegionMesh.material as BABYLON.StandardMaterial).diffuseColor = baseColor;
                    }
                    selectedRegionMesh = mesh;
                    (mesh.material as BABYLON.StandardMaterial).diffuseColor = selectedColor;
                    highlight.removeAllMeshes();
                    highlight.addMesh(mesh, BABYLON.Color3.Yellow());
                    const regionName = properties?.name || mesh.name || "Unnamed";
                    setSelectedLabel(regionName);
                    const r = resolveRegion(regionName);
                    setCurrentRegion(r);
                    setMode("map");
                  }
                )
              );

              regionMeshes.push(mesh);
            };

            if (geometry.type === "Polygon") {
              makeMesh(geometry.coordinates as number[][], 0);
            } else if (geometry.type === "MultiPolygon") {
              (geometry.coordinates as number[][][]).forEach((rings, i) => makeMesh(rings, i));
            }
          });

          // Fit camera to content
          if (regionMeshes.length > 0) {
            const min = new BABYLON.Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
            const max = new BABYLON.Vector3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);
            regionMeshes.forEach((mesh) => {
              const bb = mesh.getBoundingInfo().boundingBox;
              bb.vectorsWorld.forEach((v) => {
                min.minimizeInPlace(v);
                max.maximizeInPlace(v);
              });
            });
            const center = min.add(max).scale(0.5);
            camera.target = center;
            camera.radius = Math.max(max.x - min.x, max.z - min.z) * 0.7;
            camera.alpha = Math.PI / 2;
            camera.beta = 0.9;
            camera.lowerRadiusLimit = Math.max(100, camera.radius * 0.3);
            camera.upperRadiusLimit = camera.radius * 2.5;
          }

          // Build markers based on selection context
          const markersRoot = new BABYLON.TransformNode("markersRoot", scene);
          markersRootRef.current = markersRoot;
          const hkNames = new Set(["Hong Kong", "CMA", "HKSTP"]);
          const moNames = new Set(["Macau", "BOCDSS", "BOCYH"]);
          type Point = { name: string; lngLat?: [number, number]; pos?: BABYLON.Vector3 };
          let points: Point[] = [];
          if (hkNames.has(selectedLabel || "")) {
            points = [
              { name: "CMA", lngLat: [114.1899591, 22.3975198] },
              { name: "HKSTP", lngLat: [114.2143757, 22.424446] }
            ];
          } else if (moNames.has(selectedLabel || "")) {
            points = [
              { name: "BOCDSS", lngLat: [113.5430407, 22.202699] },
              { name: "BOCYH", lngLat: [113.5467654, 22.2109068] }
            ];
          } else {
            points = [
              hkCenter ? { name: "Hong Kong", pos: hkCenter } : { name: "Hong Kong", lngLat: [114.1694, 22.3193] },
              moCenter ? { name: "Macau", pos: moCenter } : { name: "Macau", lngLat: [113.5439, 22.1987] }
            ];
          }

          // Marker appearance settings
          const markerBaseColor = new BABYLON.Color3(1, 0, 0);
          const markerHoverColor = new BABYLON.Color3(0.76, 0.24, 0.24);
          const markerSelectedColor = new BABYLON.Color3(0.98, 0.58, 0.21);
          let selectedMarker: BABYLON.Mesh | null = null;

          points.forEach((p) => {
            const v2 = p.lngLat ? project(p.lngLat) : undefined;
            const position = p.pos || (v2 ? new BABYLON.Vector3(v2.x, 80, v2.y) : new BABYLON.Vector3(0, 80, 0));
            const sphere = BABYLON.MeshBuilder.CreateSphere(`marker-${p.name}`, { diameter: 80 }, scene);
            sphere.position = position;
            sphere.parent = markersRoot;
            const mat = new BABYLON.StandardMaterial(`mat-marker-${p.name}`, scene);
            mat.diffuseColor = markerBaseColor;
            mat.emissiveColor = markerBaseColor.scale(0.5);
            sphere.material = mat;
            sphere.isPickable = true;

            // Billboard label using DynamicTexture
            const dt = new BABYLON.DynamicTexture(`label-${p.name}`, 256, scene, false);
            dt.hasAlpha = true;
            dt.drawText(p.name, null, 180, "bold 64px Arial", "white", "transparent", true);
            const labelMat = new BABYLON.StandardMaterial(`mat-label-${p.name}`, scene);
            labelMat.diffuseTexture = dt;
            labelMat.emissiveTexture = dt;
            labelMat.backFaceCulling = false;
            const labelPlane = BABYLON.MeshBuilder.CreatePlane(`label-plane-${p.name}`, { size: 160 }, scene);
            labelPlane.material = labelMat;
            labelPlane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
            labelPlane.position = sphere.position.add(new BABYLON.Vector3(0, 140, 0));
            labelPlane.isVisible = false;
            labelPlane.isPickable = false;
            labelPlane.parent = markersRoot;

            sphere.actionManager = new BABYLON.ActionManager(scene);
            sphere.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOverTrigger, () => {
              if (sphere !== selectedMarker) {
                (sphere.material as BABYLON.StandardMaterial).diffuseColor = markerHoverColor;
              }
              labelPlane.isVisible = true;
            }));
            sphere.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOutTrigger, () => {
              if (sphere !== selectedMarker) {
                (sphere.material as BABYLON.StandardMaterial).diffuseColor = markerBaseColor;
              }
              labelPlane.isVisible = false;
            }));
            sphere.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, () => {
              if (selectedMarker && selectedMarker !== sphere) {
                (selectedMarker.material as BABYLON.StandardMaterial).diffuseColor = markerBaseColor;
              }
              selectedMarker = sphere;
              (sphere.material as BABYLON.StandardMaterial).diffuseColor = markerSelectedColor;
              highlight.removeAllMeshes();
              highlight.addMesh(sphere, BABYLON.Color3.Yellow());
              setSelectedLabel(p.name);
              if (p.name === "Hong Kong" || p.name === "Macau") {
                setCurrentRegion(p.name);
                setMode("map");
              }
              if (p.name === "BOCYH") {
                setCurrentRegion("Macau");
                setMode("detail");
              }
            }));
          });

          setStatus(`Loaded ${data.features.length} features`);
        } catch (e) {
          console.error(e);
          setStatus("Failed to load GeoJSON");
        }
      })();
    } else {
      // Detail mode: load furniture GLB and enable mesh picking & highlight
      setStatus("Loading Furniture.glb…");
      const furnitureRoot = new BABYLON.TransformNode("furnitureRoot", scene);
      furnitureRootRef.current = furnitureRoot;

      BABYLON.SceneLoader.ImportMesh(
        undefined,
        "/3dmodel/",
        "Furniture.glb",
        scene,
        (meshes) => {
          meshes.forEach((m) => (m.parent = furnitureRoot));
          // Fit camera to furniture
          if (meshes.length > 0) {
            const min = new BABYLON.Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
            const max = new BABYLON.Vector3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);
            meshes.forEach((m) => {
              const bb = m.getBoundingInfo().boundingBox;
              bb.vectorsWorld.forEach((v) => {
                min.minimizeInPlace(v);
                max.maximizeInPlace(v);
              });
            });
            const center = min.add(max).scale(0.5);
            camera.target = center;
            camera.radius = Math.max(max.x - min.x, max.y - min.y, max.z - min.z) * 1.2;
            camera.alpha = Math.PI / 2;
            camera.beta = 0.9;
          }

          // Pointer pick handler to highlight clicked mesh
          const handler = (pointerInfo: BABYLON.PointerInfo) => {
            if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERPICK) {
              const pickInfo = pointerInfo.pickInfo;
              if (pickInfo?.hit && pickInfo.pickedMesh) {
                highlight.removeAllMeshes();
                highlight.addMesh(pickInfo.pickedMesh, BABYLON.Color3.Yellow());
                setSelectedMeshName(pickInfo.pickedMesh.name || "Unnamed");
              }
            }
          };
          scene.onPointerObservable.add(handler);
          pointerHandlerRef.current = handler;
          setStatus("Furniture loaded");
        },
        undefined,
        (scene, message) => {
          console.error("Furniture load error:", message);
          setStatus("Failed to load Furniture.glb");
        }
      );
    }

    // Cleanup pointer handler when mode changes away from detail
    return () => {
      if (pointerHandlerRef.current && scene) {
        scene.onPointerObservable.removeCallback(pointerHandlerRef.current);
        pointerHandlerRef.current = null;
      }
    };
  }, [mode, mapFile, selectedLabel]);

  return (
    <div style={{ height: "100vh", width: "100vw" }}>
      <div style={{ padding: "8px", background: "#eee" }}>
        {status}
        {selectedLabel ? ` • Selected: ${selectedLabel}` : ""}
        {selectedMeshName ? ` • Mesh: ${selectedMeshName}` : ""}
      </div>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
