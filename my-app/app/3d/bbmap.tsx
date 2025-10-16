import React, { useEffect, useRef, useState } from "react";
import * as BABYLON from "babylonjs";
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new BABYLON.Engine(canvas, true);
    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0.95, 0.97, 1, 1);

    // Perspective camera
    const camera = new BABYLON.ArcRotateCamera(
      "camera",
      0,
      0,
      500,
      BABYLON.Vector3.Zero(),
      scene
    );
    camera.setPosition(new BABYLON.Vector3(0, 5000, 500));
    camera.attachControl(canvas, true);

    new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);

    const load = async () => {
      try {
        const res = await fetch("/3dmodel/China.json"); // put your file in public/map.json
        const data: GeoJSON = await res.json();

        const baseColor = new BABYLON.Color3(0.5, 0.7, 0.9);
        const hoverColor = new BABYLON.Color3(0.9, 0.8, 0.4);
        const selectedColor = new BABYLON.Color3(0.9, 0.4, 0.3);

        let selectedMesh: BABYLON.AbstractMesh | null = null;
        const meshes: BABYLON.Mesh[] = [];

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

            mesh.actionManager = new BABYLON.ActionManager(scene);

            mesh.actionManager.registerAction(
              new BABYLON.ExecuteCodeAction(
                BABYLON.ActionManager.OnPointerOverTrigger,
                () => {
                  if (mesh !== selectedMesh) {
                    (mesh.material as BABYLON.StandardMaterial).diffuseColor =
                      hoverColor;
                  }
                }
              )
            );

            mesh.actionManager.registerAction(
              new BABYLON.ExecuteCodeAction(
                BABYLON.ActionManager.OnPointerOutTrigger,
                () => {
                  if (mesh !== selectedMesh) {
                    (mesh.material as BABYLON.StandardMaterial).diffuseColor =
                      baseColor;
                  }
                }
              )
            );

            mesh.actionManager.registerAction(
              new BABYLON.ExecuteCodeAction(
                BABYLON.ActionManager.OnPickTrigger,
                () => {
                  if (selectedMesh && selectedMesh !== mesh) {
                    (selectedMesh.material as BABYLON.StandardMaterial).diffuseColor =
                      baseColor;
                  }
                  selectedMesh = mesh;
                  (mesh.material as BABYLON.StandardMaterial).diffuseColor =
                    selectedColor;
                  console.log("Clicked region:", properties?.name);
                }
              )
            );

            meshes.push(mesh);
          };

          if (geometry.type === "Polygon") {
            makeMesh(geometry.coordinates as number[][], 0);
          } else if (geometry.type === "MultiPolygon") {
            (geometry.coordinates as number[][][]).forEach((rings, i) =>
              makeMesh(rings, i)
            );
          }
        });

        // Fit camera to content
        if (meshes.length > 0) {
          const min = new BABYLON.Vector3(
            Number.POSITIVE_INFINITY,
            Number.POSITIVE_INFINITY,
            Number.POSITIVE_INFINITY
          );
          const max = new BABYLON.Vector3(
            Number.NEGATIVE_INFINITY,
            Number.NEGATIVE_INFINITY,
            Number.NEGATIVE_INFINITY
          );

          meshes.forEach((mesh) => {
            const bb = mesh.getBoundingInfo().boundingBox;
            bb.vectorsWorld.forEach((v) => {
              min.minimizeInPlace(v);
              max.maximizeInPlace(v);
            });
          });

          const center = min.add(max).scale(0.5);
          camera.target = center;
          camera.radius = Math.max(max.x - min.x, max.z - min.z) * 0.7;
        }

        setStatus(`Loaded ${data.features.length} features`);
      } catch (e) {
        console.error(e);
        setStatus("Failed to load GeoJSON");
      }
    };

    load();

    engine.runRenderLoop(() => {
      scene.render();
    });

    const resize = () => engine.resize();
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      engine.dispose();
    };
  }, []);

  return (
    <div style={{ height: "100vh", width: "100vw" }}>
      <div style={{ padding: "8px", background: "#eee" }}>{status}</div>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
