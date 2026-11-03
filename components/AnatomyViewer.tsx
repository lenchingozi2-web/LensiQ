'use client';

import { Component, Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { OrbitControls, Stage, useGLTF } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';

type ModelProps = {
  url: string;
  onStructureSelect?: (meshName: string) => void;
  highlightStructure?: string;
  highlightColor?: string;
  viewMode?: 'normal' | 'xray' | 'isolate';
  onReady?: () => void;
};

type AnatomyModelErrorBoundaryProps = {
  modelUrl: string;
  children: ReactNode;
  onFailure: () => void;
};

class AnatomyModelErrorBoundary extends Component<AnatomyModelErrorBoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onFailure();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function Model({ url, onStructureSelect, highlightStructure, highlightColor, viewMode = 'normal', onReady }: ModelProps) {
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
        return candidate.replace(/_+/g, ' ').replace(/\\s+/g, ' ').trim();
      }
      current = current.parent;
    }
    return (node.name || 'Unlabelled model part').replace(/_+/g, ' ').trim();
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

  useEffect(() => { onReady?.(); }, [scene, onReady]);

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
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const markReady = useCallback(() => { setReady(true); setFailed(false); }, []);
  const markFailed = useCallback(() => { setFailed(true); setReady(false); }, []);
  useGLTF.preload(modelUrl);

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-900">
      <Canvas camera={{ position: [0, 0, 5], fov: 50 }} dpr={[1, 1.5]}>
        <color attach="background" args={['#080d16']} />
        <AnatomyModelErrorBoundary key={modelUrl + ':' + attempt} modelUrl={modelUrl} onFailure={markFailed}>
          <Suspense fallback={null}>
            <Stage adjustCamera={1.2} environment="studio" intensity={0.8}>
              <Model url={modelUrl} onStructureSelect={onStructureSelect} highlightStructure={highlightStructure} highlightColor={highlightColor} viewMode={viewMode} onReady={markReady} />
            </Stage>
          </Suspense>
        </AnatomyModelErrorBoundary>
        <OrbitControls makeDefault enablePan enableZoom enableRotate enableDamping dampingFactor={0.08} />
      </Canvas>
      {!ready && !failed && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center" data-testid="model-loading">
          <span className="rounded-full border border-white/10 bg-[#101827]/90 px-4 py-2 text-xs font-bold text-white/75 shadow-xl backdrop-blur-xl">Preparing 3D medical model…</span>
        </div>
      )}
      {failed && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#080d16]/85 px-4" data-testid="model-failed">
          <div className="max-w-[min(80vw,22rem)] rounded-2xl border border-white/10 bg-[#101827] px-5 py-4 text-center shadow-2xl">
            <p role="alert" className="text-xs font-black uppercase tracking-[0.16em] text-[#ffd68d]">3D model unavailable</p>
            <p className="mt-2 text-xs leading-5 text-white/70">The tutor can continue without this model. Check your connection or try again.</p>
            <button type="button" onClick={() => { useGLTF.clear(modelUrl); setFailed(false); setReady(false); setAttempt(x => x + 1); }} className="mt-3 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-[10px] font-bold text-white transition hover:bg-white/15">
              Retry model
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
