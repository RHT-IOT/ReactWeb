"use client";
import React, { useState, useRef } from 'react';
import { Engine, Scene, Model, useScene } from 'react-babylonjs';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { PointerEventTypes } from '@babylonjs/core/Events/pointerEvents';
import { HighlightLayer } from '@babylonjs/core/Layers/highlightLayer';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Animation } from '@babylonjs/core/Animations/animation';
import { EasingFunction, QuadraticEase } from '@babylonjs/core/Animations/easing';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import '@babylonjs/loaders';

const SceneInteractions: React.FC<{ onSelect?: (name: string) => void; onMeshClick?: (name: string) => void }> = ({ onSelect, onMeshClick }) => {
    const scene = useScene();
    React.useEffect(() => {
        if (!scene) return;

        const highlight = new HighlightLayer('highlight', scene);
        const handler = (pointerInfo: any) => {
            if (pointerInfo.type === PointerEventTypes.POINTERPICK) {
                const pickInfo = pointerInfo.pickInfo;
                if (pickInfo?.hit && pickInfo.pickedMesh) {
                    highlight.removeAllMeshes();
                    highlight.addMesh(pickInfo.pickedMesh, Color3.Yellow());
                    // You can replace this with your own click handler
                    console.log('Clicked mesh:', pickInfo.pickedMesh.name);
                    onSelect?.(pickInfo.pickedMesh.name || 'Unnamed mesh');
                    onMeshClick?.(pickInfo.pickedMesh.name || 'Unnamed mesh');
                }
            }
        };
        scene.onPointerObservable.add(handler);

        return () => {
            scene.onPointerObservable.removeCallback(handler);
            highlight.dispose();
        };
    }, [scene]);

    return null;
};

const MyBabylonScene = () => {
    const [selectedName, setSelectedName] = useState<string | null>(null);
    const [modelFile, setModelFile] = useState<string>('island.glb');
    const cameraRef = useRef<ArcRotateCamera | null>(null);

    const zoomCamera = (toRadius: number, durationMs = 600) => {
        const camera = cameraRef.current;
        if (!camera) return;
        const fps = 60;
        const totalFrames = Math.max(1, Math.round((durationMs / 1000) * fps));
        const easing = new QuadraticEase();
        easing.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);
        Animation.CreateAndStartAnimation('cameraZoom', camera, 'radius', fps, totalFrames, camera.radius, toRadius, 0, easing);
    };

    const handleMeshClick = (name: string) => {
        // Update overlay
        setSelectedName(name);
        // If clicking specific mesh, swap model and animate zoom
        if (name === 'Cube.012') {
            setModelFile('Furniture.glb');
            // Smooth zoom toward new model
            if (cameraRef.current) {
                const targetRadius = Math.max(10, cameraRef.current.radius * 0.6);
                zoomCamera(targetRadius, 600);
            }
        }
    };
    return (
        <>
            <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 10, background: 'rgba(0,0,0,0.6)', color: '#fff', padding: '8px 12px', borderRadius: 8 }}>
                Clicked: {selectedName ?? '(none)'}
            </div>
            <Engine antialias={true} adaptToDeviceRatio={true} canvasId="babylon-canvas">
            <Scene>
                <SceneInteractions onSelect={setSelectedName} onMeshClick={handleMeshClick} />
                {/* Basic camera and light setup */}
                <arcRotateCamera
                    name="camera1"
                    target={new Vector3(0, 0, 0)}
                    alpha={Math.PI / 2}
                    beta={Math.PI / 2}
                    radius={30}
                    setActiveCameraOnScene={true}
                    minZ={0.1}
                    lowerRadiusLimit={2}
                    upperRadiusLimit={500}
                    wheelDeltaPercentage={0.02}
                    pinchDeltaPercentage={0.02}
                    panningSensibility={50}
                    useCtrlForPanning={false}
                    lowerBetaLimit={0.01}
                    upperBetaLimit={Math.PI - 0.01}
                    onCreated={(camera: ArcRotateCamera) => {
                        const canvas = document.getElementById('babylon-canvas') as HTMLCanvasElement | null;
                        if (canvas) {
                            camera.attachControl(canvas, true);
                        }
                        // Fine-tune interaction speeds
                        camera.wheelDeltaPercentage = 0.02;
                        camera.pinchDeltaPercentage = 0.02;
                        camera.panningSensibility = 50;
                        camera.useCtrlForPanning = false;
                        cameraRef.current = camera;
                    }}
                />
                <hemisphericLight name="light1" intensity={0.7} direction={new Vector3(0, 1, 0)} />

                {/* Load your .glb model */}
                <Model
                    key={modelFile}
                    rootUrl="/3dmodel/" // Path to the directory containing your .glb file
                    sceneFilename={modelFile} // Active .glb filename
                    scaling={new Vector3(1, 1, 1)} // Adjust scaling as needed
                    position={new Vector3(0, 0, 0)} // Adjust position as needed
                    onLoad={(model: { meshes?: AbstractMesh[] }) => {
                        const camera = cameraRef.current;
                        if (!camera) return;
                        const meshes = model?.meshes ?? [];
                        if (meshes.length === 0) return;

                        let min = new Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
                        let max = new Vector3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);

                        for (const m of meshes) {
                            const bb = m.getBoundingInfo().boundingBox;
                            const mn = bb.minimumWorld;
                            const mx = bb.maximumWorld;
                            min = new Vector3(Math.min(min.x, mn.x), Math.min(min.y, mn.y), Math.min(min.z, mn.z));
                            max = new Vector3(Math.max(max.x, mx.x), Math.max(max.y, mx.y), Math.max(max.z, mx.z));
                        }

                        const center = min.add(max).scale(0.5);
                        camera.setTarget(center);
                        const extents = max.subtract(min);
                        const largestExtent = Math.max(extents.x, extents.y, extents.z);
                        const desiredRadius = Math.max(8, largestExtent * 1.5);
                        zoomCamera(desiredRadius, 700);
                    }}
                />
            </Scene>
        </Engine>
        </>
    );
};

export default MyBabylonScene;