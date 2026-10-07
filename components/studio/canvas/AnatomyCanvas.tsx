'use client';

import { OrbitControls, useGLTF } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';

const DRACO_DECODER_PATH = 'https://www.gstatic.com/draco/versioned/decoders/1.5.5/';

useGLTF.setDecoderPath(DRACO_DECODER_PATH);

type ModelProps = {
  url: string;
};

function Model({ url }: ModelProps) {
  const { scene } = useGLTF(url, true);

  return <primitive object={scene} dispose={null} />;
}

type AnatomyCanvasProps = {
  modelUrl: string;
};

export default function AnatomyCanvas({ modelUrl }: AnatomyCanvasProps) {
  return (
    <div className="h-full w-full">
      <Canvas
        className="h-full w-full"
        camera={{ position: [0, 0, 3], fov: 45, near: 0.1, far: 1000 }}
        dpr={[1, 2]}
      >
        <ambientLight intensity={0.8} />
        <directionalLight position={[5, 5, 5]} intensity={1.5} />
        <directionalLight position={[-5, 2, -3]} intensity={0.6} />
        <Suspense fallback={null}>
          <Model url={modelUrl} />
        </Suspense>
        <OrbitControls makeDefault enablePan enableZoom enableRotate />
      </Canvas>
    </div>
  );
}
