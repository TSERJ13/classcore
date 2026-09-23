"use client";

import { useRef, useMemo, Suspense } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";

/** The dashboard screenshot mapped onto a floating 3D panel that tilts toward the cursor. */
function DashboardPanel() {
    const texture = useLoader(THREE.TextureLoader, "/dashboard_hero_zoomed_out.png");
    const groupRef = useRef<THREE.Group>(null);

    useFrame((state) => {
        const { pointer, clock } = state;
        const g = groupRef.current;
        if (!g) return;
        g.rotation.y = pointer.x * 0.4 + Math.sin(clock.elapsedTime * 0.35) * 0.04;
        g.rotation.x = -pointer.y * 0.28 + Math.cos(clock.elapsedTime * 0.45) * 0.03;
        g.position.y = Math.sin(clock.elapsedTime * 0.55) * 0.1;
    });

    return (
        <group ref={groupRef}>
            {/* indigo backing card, offset behind for a layered "glass on glass" depth */}
            <mesh position={[0.12, -0.1, -0.15]} rotation={[0, 0, 0.02]}>
                <planeGeometry args={[4.5, 2.6]} />
                <meshStandardMaterial color="#4338ca" roughness={0.5} metalness={0.35} />
            </mesh>
            <mesh>
                <planeGeometry args={[4.2, 2.36]} />
                <meshStandardMaterial map={texture} roughness={0.3} metalness={0.1} />
            </mesh>
        </group>
    );
}

function AccentPanel({ position, color, speed, size = [0.85, 0.6] as [number, number] }: { position: [number, number, number], color: string, speed: number, size?: [number, number] }) {
    const ref = useRef<THREE.Mesh>(null);
    useFrame(({ clock }) => {
        const m = ref.current;
        if (!m) return;
        const t = clock.elapsedTime * speed;
        m.position.y = position[1] + Math.sin(t) * 0.35;
        m.position.x = position[0] + Math.cos(t * 0.7) * 0.15;
        m.rotation.z = Math.sin(t * 0.5) * 0.2;
        m.rotation.y = Math.sin(t * 0.3) * 0.3;
    });
    return (
        <mesh ref={ref} position={position}>
            <planeGeometry args={size} />
            <meshStandardMaterial color={color} roughness={0.25} metalness={0.5} transparent opacity={0.92} />
        </mesh>
    );
}

function Particles({ count = 90 }: { count?: number }) {
    const positions = useMemo(() => {
        const arr = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            arr[i * 3] = (Math.random() - 0.5) * 11;
            arr[i * 3 + 1] = (Math.random() - 0.5) * 6.5;
            arr[i * 3 + 2] = (Math.random() - 0.5) * 4 - 1;
        }
        return arr;
    }, [count]);
    const ref = useRef<THREE.Points>(null);
    useFrame(({ clock }) => {
        if (ref.current) ref.current.rotation.y = clock.elapsedTime * 0.025;
    });
    return (
        <points ref={ref}>
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[positions, 3]} />
            </bufferGeometry>
            <pointsMaterial size={0.035} color="#a5b4fc" transparent opacity={0.55} sizeAttenuation />
        </points>
    );
}

function Lights() {
    return (
        <>
            <ambientLight intensity={0.55} />
            <directionalLight position={[3, 4, 5]} intensity={1.3} color="#c7d2fe" />
            <pointLight position={[-4, -2, 3]} intensity={0.9} color="#818cf8" />
        </>
    );
}

export default function Hero3DScene() {
    return (
        <Canvas
            camera={{ position: [0, 0, 6.2], fov: 38 }}
            dpr={[1, 1.5]}
            gl={{ alpha: true, antialias: true }}
            style={{ position: "absolute", inset: 0 }}
        >
            <Suspense fallback={null}>
                <Lights />
                <DashboardPanel />
                <AccentPanel position={[-2.5, 1.2, -0.9]} color="#6366f1" speed={0.55} />
                <AccentPanel position={[2.6, -1.15, -0.7]} color="#a855f7" speed={0.4} size={[0.65, 0.65]} />
                <Particles />
            </Suspense>
        </Canvas>
    );
}
