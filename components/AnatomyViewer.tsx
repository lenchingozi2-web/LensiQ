'use client';

import { Suspense, useEffect } from 'react';
import { OrbitControls, Stage, useGLTF } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';

type AnatomyType = 'brain' | 'heart' | 'liver' | 'lungs' | 'kidneys' | 'bone' | 'default';

const ANATOMICAL_PROFILES: Record<AnatomyType, THREE.MeshPhysicalMaterialParameters> = {
  brain: {
    color: '#8c6562',
    roughness: 0.85,
    metalness: 0,
    clearcoat: 0.1,
    clearcoatRoughness: 0.5,
  },
  heart: {
    color: '#7f292d',
    roughness: 0.52,
    metalness: 0,
    clearcoat: 0.6,
    clearcoatRoughness: 0.24,
  },
  liver: {
    color: '#6f3f35',
    roughness: 0.48,
    metalness: 0,
    clearcoat: 0.8,
    clearcoatRoughness: 0.18,
  },
  lungs: {
    color: '#d59b9d',
    roughness: 0.8,
    metalness: 0,
    clearcoat: 0.2,
    clearcoatRoughness: 0.45,
    transmission: 0.08,
    thickness: 0.2,
  },
  kidneys: {
    color: '#75433d',
    roughness: 0.62,
    metalness: 0,
    clearcoat: 0.5,
    clearcoatRoughness: 0.28,
  },
  bone: {
    color: '#e1d5b9',
    roughness: 0.9,
    metalness: 0,
    clearcoat: 0,
    clearcoatRoughness: 0.5,
  },
  default: {
    color: '#9c756e',
    roughness: 0.8,
    metalness: 0,
    clearcoat: 0.2,
    clearcoatRoughness: 0.4,
  },
};

function getAnatomyType(modelUrl: string): AnatomyType {
  const fileName = decodeURIComponent(modelUrl.split(/[?#]/, 1)[0].split('/').pop() ?? '').toLowerCase();
  const organName = fileName.replace(/\.(glb|gltf)$/, '');

  if (organName.includes('brain')) return 'brain';
  if (organName.includes('heart')) return 'heart';
  if (organName.includes('liver')) return 'liver';
  if (organName.includes('lung')) return 'lungs';
  if (organName.includes('kidney')) return 'kidneys';
  if (organName.includes('bone')) return 'bone';

  return 'default';
}

function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const anatomyType = getAnatomyType(url);

  useEffect(() => {
    const appliedMaterials: THREE.MeshPhysicalMaterial[] = [];
    const profile = ANATOMICAL_PROFILES[anatomyType];

    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const material = new THREE.MeshPhysicalMaterial({
          ...profile,
          vertexColors: false,
        });
        child.material = material;
        appliedMaterials.push(material);
      }
    });

    return () => {
      appliedMaterials.forEach((material) => material.dispose());
    };
  }, [anatomyType, scene]);

  return <primitive object={scene} />;
}

export default function AnatomyViewer({ modelUrl }: { modelUrl: string }) {
  return (
    <div className="w-full h-[500px] bg-slate-900 rounded-xl overflow-hidden shadow-lg border border-slate-700">
      <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
        <Suspense fallback={null}>
          <Stage adjustCamera={1.2} environment="studio" intensity={0.2}>
            <Model url={modelUrl} />
          </Stage>
        </Suspense>
        <OrbitControls autoRotate autoRotateSpeed={1.5} makeDefault />
      </Canvas>
    </div>
  );
}
