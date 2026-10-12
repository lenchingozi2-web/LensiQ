'use client';

import { Suspense, useEffect, useMemo } from 'react';
import { Html, OrbitControls, Stage, useGLTF } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';

type ModelProps = {
  url: string;
  onStructureSelect?: (meshName: string) => void;
  highlightStructure?: string;
  highlightColor?: string;
};

function Model({ url, onStructureSelect, highlightStructure, highlightColor }: ModelProps) {
  const { scene: sourceScene } = useGLTF(url);
  const scene = useMemo(() => {
    const clonedScene = sourceScene.clone(true);
    clonedScene.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.material = Array.isArray(child.material)
        ? child.material.map((material) => material.clone())
        : child.material.clone();
    });
    return clonedScene;
  }, [sourceScene]);
  const originalEmissive = useMemo(() => {
    const baseline = new Map<THREE.Material, { color: THREE.Color; intensity: number }>();
    scene.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => {
        if (material instanceof THREE.MeshStandardMaterial) {
          baseline.set(material, { color: material.emissive.clone(), intensity: material.emissiveIntensity });
        }
      });
    });
    return baseline;
  }, [scene]);

  useEffect(() => {
    const target = highlightStructure?.trim().toLowerCase();
    scene.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const matches = Boolean(target && child.name.toLowerCase().includes(target));
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => {
        if (!(material instanceof THREE.MeshStandardMaterial)) return;
        const baseline = originalEmissive.get(material);
        material.emissive.copy(matches ? new THREE.Color(highlightColor || '#E8A23D') : baseline?.color ?? new THREE.Color('#000000'));
        material.emissiveIntensity = matches ? 0.68 : baseline?.intensity ?? 0;
        material.needsUpdate = true;
      });
    });
  }, [highlightColor, highlightStructure, originalEmissive, scene]);

  useEffect(() => () => {
    scene.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => material.dispose());
    });
  }, [scene]);

  return (
    <primitive
      object={scene}
      onClick={(event: { stopPropagation: () => void; object: THREE.Object3D }) => {
        event.stopPropagation();
        onStructureSelect?.(event.object.name || 'Unnamed structure');
      }}
    />
  );
}

export type AnatomyViewerProps = {
  modelUrl: string;
  onStructureSelect?: (meshName: string) => void;
  highlightStructure?: string;
  highlightColor?: string;
};

export default function AnatomyViewer({ modelUrl, onStructureSelect, highlightStructure, highlightColor }: AnatomyViewerProps) {
  useGLTF.preload(modelUrl);

  return (
    <div className="h-full w-full overflow-hidden bg-slate-900">
      <Canvas camera={{ position: [0, 0, 5], fov: 50 }} dpr={[1, 1.5]}>
        <color attach="background" args={['#080d16']} />
        <Suspense fallback={<Html center><div className="rounded-full border border-white/10 bg-[#101827]/90 px-4 py-2 text-xs font-bold text-white/75 shadow-xl backdrop-blur-xl">Preparing 3D medical model…</div></Html>}>
          <Stage adjustCamera={1.2} environment="studio" intensity={0.8}>
            <Model url={modelUrl} onStructureSelect={onStructureSelect} highlightStructure={highlightStructure} highlightColor={highlightColor} />
          </Stage>
        </Suspense>
        <OrbitControls
          makeDefault
          enablePan
          enableZoom
          enableRotate
          enableDamping
          dampingFactor={0.08}
        />
      </Canvas>
    </div>
  );
}
