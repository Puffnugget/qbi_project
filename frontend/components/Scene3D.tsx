"use client";

import { Html, Line, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useMemo, useState } from "react";
import { CANCER_COLORS } from "@/lib/constants";
import type { UmapPoint } from "@/lib/types";

interface Scene3DProps {
  points?: UmapPoint[];
  selectedLines?: string[];
  filterCancerType?: string;
  highlightOverlap?: string[];
}

function ConnectionLines({
  points,
  selectedLines,
}: {
  points: UmapPoint[];
  selectedLines: string[];
}) {
  const lookup = useMemo(
    () => new Map(points.map((p) => [p.cell_line, p])),
    [points],
  );

  const segments: [number, number, number][][] = [];
  for (let i = 0; i < selectedLines.length; i++) {
    for (let j = i + 1; j < selectedLines.length; j++) {
      const a = lookup.get(selectedLines[i]);
      const b = lookup.get(selectedLines[j]);
      if (a && b) {
        segments.push([
          [a.x, a.y, a.z],
          [b.x, b.y, b.z],
        ]);
      }
    }
  }

  return (
    <>
      {segments.map((seg, i) => (
        <Line
          key={i}
          points={seg}
          color="#FFD700"
          lineWidth={1}
          transparent
          opacity={0.35}
        />
      ))}
    </>
  );
}

function CellSphere({
  point,
  isSelected,
  isFilteredOut,
  isOverlap,
  onHover,
}: {
  point: UmapPoint;
  isSelected: boolean;
  isFilteredOut: boolean;
  isOverlap: boolean;
  onHover: (p: UmapPoint | null) => void;
}) {
  const baseColor = CANCER_COLORS[point.cancer_type] ?? "#888888";
  const color = isSelected ? "#FFD700" : isOverlap ? "#ffffff" : baseColor;
  const radius = isSelected ? 0.12 : 0.08;
  const opacity = isFilteredOut ? 0.15 : 1;

  return (
    <mesh
      position={[point.x, point.y, point.z]}
      scale={isSelected ? 1.5 : 1}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover(point);
      }}
      onPointerOut={() => onHover(null)}
    >
      <sphereGeometry args={[radius, 24, 24]} />
      <meshStandardMaterial
        color={isFilteredOut ? "#555555" : color}
        emissive={isSelected ? "#FFD700" : isOverlap ? "#ffffff" : color}
        emissiveIntensity={isSelected ? 0.7 : isOverlap ? 0.5 : 0.2}
        transparent={opacity < 1}
        opacity={opacity}
      />
    </mesh>
  );
}

function SceneContent({
  points,
  selectedLines,
  filterCancerType,
  highlightOverlap,
  hovered,
  setHovered,
}: {
  points: UmapPoint[];
  selectedLines: string[];
  filterCancerType?: string;
  highlightOverlap: string[];
  hovered: UmapPoint | null;
  setHovered: (p: UmapPoint | null) => void;
}) {
  const selectedSet = useMemo(() => new Set(selectedLines), [selectedLines]);
  const overlapSet = useMemo(() => new Set(highlightOverlap), [highlightOverlap]);

  return (
    <>
      <color attach="background" args={["#050510"]} />
      <ambientLight intensity={0.4} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <gridHelper args={[10, 10, "#1a1a2e", "#12121f"]} position={[0, -2, 0]} />

      {selectedLines.length > 1 && (
        <ConnectionLines points={points} selectedLines={selectedLines} />
      )}

      {points.map((point) => {
        const isSelected = selectedSet.has(point.cell_line);
        const isFilteredOut =
          filterCancerType != null &&
          filterCancerType !== "all" &&
          point.cancer_type !== filterCancerType &&
          !isSelected;

        return (
          <CellSphere
            key={point.cell_line}
            point={point}
            isSelected={isSelected}
            isFilteredOut={isFilteredOut}
            isOverlap={overlapSet.has(point.cell_line)}
            onHover={setHovered}
          />
        );
      })}

      {hovered && (
        <Html
          position={[hovered.x, hovered.y + 0.25, hovered.z]}
          center
          style={{ pointerEvents: "none" }}
        >
          <div className="whitespace-nowrap rounded border border-white/10 bg-black/80 px-2 py-1 text-xs text-zinc-100 backdrop-blur-sm">
            <span className="font-mono">{hovered.cell_line}</span>
            <span className="ml-2 text-zinc-400">{hovered.cancer_type}</span>
          </div>
        </Html>
      )}

      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        autoRotate
        autoRotateSpeed={0.5}
      />
    </>
  );
}

export default function Scene3D({
  points = [],
  selectedLines = [],
  filterCancerType,
  highlightOverlap = [],
}: Scene3DProps) {
  const [hovered, setHovered] = useState<UmapPoint | null>(null);
  const hasData = points.length > 0;

  return (
    <div className="relative h-full w-full">
      <Canvas camera={{ position: [0, 0, 6], fov: 50 }} className="h-full w-full">
        {hasData ? (
          <SceneContent
            points={points}
            selectedLines={selectedLines}
            filterCancerType={filterCancerType}
            highlightOverlap={highlightOverlap}
            hovered={hovered}
            setHovered={setHovered}
          />
        ) : (
          <>
            <color attach="background" args={["#050510"]} />
            <gridHelper args={[10, 10, "#1a1a2e", "#12121f"]} position={[0, -2, 0]} />
            <OrbitControls enableDamping dampingFactor={0.05} />
          </>
        )}
      </Canvas>

      {!hasData && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="rounded-lg border border-white/10 bg-black/40 px-4 py-2 text-sm text-zinc-400 backdrop-blur-sm">
            Loading cell line embedding…
          </p>
        </div>
      )}
    </div>
  );
}
