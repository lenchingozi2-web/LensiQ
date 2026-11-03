'use client';

import { Component, Suspense, useEffect, useMemo, type ReactNode } from 'react';
import { Html, OrbitControls, Stage, useGLTF } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';

type ModelProps = {
  url: string;
  onStructureSelect?: (meshName: string) => void;
  highlightStructure?: string;
  highlightColor?: string;
  viewMode?: 'normal' | 'xray' | 'isolate';
};

type AnatomyModelErrorBoundaryProps = {
  modelUrl: string;
  children: ReactNode;
};

class AnatomyModelErrorBoundary extends Component<AnatomyModelErrorBoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <Html center>
          <div className="max-w-[min(80vw,22rem)] rounded-2xl border border-white/10 bg-[#101827]/95 px-5 py-4 text-center shadow-2xl backdrop-blur-xl">
            <p role="alert" className="text-xs font-black uppercase tracking-[0.16em] text-[#ffd68d]">3D model unavailable</p>
            <p className="mt-2 text-xs leading-5 text-white/70">The tutor can continue while this model is unavailable. Check your connection or try again.</p>
            <button
              type="button"
              onClick={() => {
                useGLTF.clear(this.props.modelUrl);
                this.setState({ failed: false });
              }}
              className="pointer-events-auto mt-3 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-[10px] font-bold text-white transition hover:bg-white/15"
            >
              Retry model
            </button>
          </div>
        </Html>
      );
    }
    return this.props.children;
  }
}

function Model({ url, onStructureSelect, highlightStructure, highlightColor, viewMode = 'normal' }: ModelProps) {
  const { scene: sourceScene } = useGLTF(url);
  const scene = useMemo(() => {
    const clonedScene = sourceScene.clone(true);
    let meshCount = 0;
    clonedScene.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      meshCount += 1;
      const cloneMaterial = (material: THREE.Material) => {
        const clonedMaterial = material.clone();
        clonedMaterial.side = THREE.DoubleSide;
        clonedMaterial.needsUpdate = true;
        return clonedMaterial;
      };
      child.material = Array.isArray(child.material)
        ? child.material.map(cloneMaterial)
        : cloneMaterial(child.material);
    });
    if (meshCount === 0) throw new Error('The medical model contains no renderable geometry.');

    const normalizedScene = new THREE.Group();
    normalizedScene.name = 'LiveClassMedicalModel';
    normalizedScene.add(clonedScene);
    normalizedScene.updateMatrixWorld(true);

    const bounds = new THREE.Box3().setFromObject(clonedScene);
    const size = bounds.getSize(new THREE.Vector3());
    const largestDimension = Math.max(size.x, size.y, size.z);
    if (Number.isFinite(largestDimension) && largestDimension > 0) {
      const center = bounds.getCenter(new THREE.Vector3());
      const fitScale = 2.4 / largestDimension;
      normalizedScene.scale.setScalar(fitScale);
      normalizedScene.position.copy(center).multiplyScalar(-fitScale);
      normalizedScene.updateMatrixWorld(true);
    }

    return normalizedScene;
  }, [sourceScene]);
  // A parent with an ontology label is preferred to generic mesh IDs.
  const structureName = (node: THREE.Object3D) => {
    let current: THREE.Object3D | null = node;
    while (current && current !== scene) {
      const candidate = current.name?.trim();
      if (candidate && !/^(?:mesh[_ .-]*\\d+|node[_ .-]*\\d+|scene|object[_ .-]*\\d+|liveclassmedicalmodel)$/i.test(candidate)) {
        return candidate;
      }
      current = current.parent;
    }
    return node.name || 'Unlabelled model part';
  };
  const materialState = useMemo(() => {
    const baseline = new Map<THREE.Material, { opacity: number; transparent: boolean; depthWrite: boolean }>();
    scene.traverse(child => {
      if (!(child instanceof THREE.Mesh)) return;
      for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
        baseline.set(material, { opacity: material.opacity, transparent: material.transparent, depthWrite: material.depthWrite });
      }
    });
    return baseline;
  }, [scene]);

  useEffect(() => {
    const target = highlightStructure?.trim().toLowerCase();
    scene.traverse(child => {
      if (!(child instanceof THREE.Mesh)) return;
      const label = structureName(child).toLowerCase();
      const selected = Boolean(target && (label === target || label.includes(target) || child.name.toLowerCase().includes(target)));
      child.visible = viewMode !== 'isolate' || !target || selected;
      for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
        const baseline = materialState.get(material);
        if (!baseline) continue;
        material.transparent = viewMode === 'xray' || baseline.transparent;
        material.opacity = viewMode === 'xray' ? Math.min(baseline.opacity, selected ? 0.95 : 0.28) : baseline.opacity;
        material.depthWrite = viewMode === 'xray' ? false : baseline.depthWrite;
        material.needsUpdate = true;
      }
    });
  }, [scene, viewMode, highlightStructure, materialState]);

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
      const label = structureName(child).toLowerCase();
      const matches = Boolean(target && (label === target || label.includes(target) || child.name.toLowerCase().includes(target)));
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
        onStructureSelect?.(structureName(event.object));
      }}
    />
  );
}

export type AnatomyViewerProps = {
  modelUrl: string;
  onStructureSelect?: (meshName: string) => void;
  highlightStructure?: string;
  highlightColor?: string;
  viewMode?: 'normal' | 'xray' | 'isolate';
};

export default function AnatomyViewer({ modelUrl, onStructureSelect, highlightStructure, highlightColor, viewMode = 'normal' }: AnatomyViewerProps) {
  useGLTF.preload(modelUrl);

  return (
    <div className="h-full w-full overflow-hidden bg-slate-900">
      <Canvas camera={{ position: [0, 0, 5], fov: 50 }} dpr={[1, 1.5]}>
        <color attach="background" args={['#080d16']} />
        <AnatomyModelErrorBoundary key={modelUrl} modelUrl={modelUrl}>
          <Suspense fallback={<Html center><div className="rounded-full border border-white/10 bg-[#101827]/90 px-4 py-2 text-xs font-bold text-white/75 shadow-xl backdrop-blur-xl">Preparing 3D medical model…</div></Html>}>
            <Stage adjustCamera={1.2} environment="studio" intensity={0.8}>
              <Model url={modelUrl} onStructureSelect={onStructureSelect} highlightStructure={highlightStructure} highlightColor={highlightColor} viewMode={viewMode} />
            </Stage>
          </Suspense>
        </AnatomyModelErrorBoundary>
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
