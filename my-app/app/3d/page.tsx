"use client";
import React, { useState } from 'react';
import { Engine, Scene, Model, useScene } from 'react-babylonjs';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { PointerEventTypes } from '@babylonjs/core/Events/pointerEvents';
import { HighlightLayer } from '@babylonjs/core/Layers/highlightLayer';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import '@babylonjs/loaders';

const SceneInteractions: React.FC<{ onSelect?: (name: string) => void }> = ({ onSelect }) => {
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
    return (
        <>
            <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 10, background: 'rgba(0,0,0,0.6)', color: '#fff', padding: '8px 12px', borderRadius: 8 }}>
                Clicked: {selectedName ?? '(none)'}
            </div>
            <Engine antialias={true} adaptToDeviceRatio={true} canvasId="babylon-canvas">
            <Scene>
                <SceneInteractions onSelect={setSelectedName} />
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
                    }}
                />
                <hemisphericLight name="light1" intensity={0.7} direction={new Vector3(0, 1, 0)} />

                {/* Load your .glb model */}
                <Model
                    rootUrl="/3dmodel/" // Path to the directory containing your .glb file
                    sceneFilename="island.glb" // Your .glb filename
                    scaling={new Vector3(1, 1, 1)} // Adjust scaling as needed
                    position={new Vector3(0, 0, 0)} // Adjust position as needed
                />
            </Scene>
        </Engine>
        </>
    );
};

export default MyBabylonScene;