"use client";

import { Html, Line, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import type { Mesh, MeshStandardMaterial } from "three";
import { CANCER_COLORS } from "@/lib/constants";
import type { UmapPoint } from "@/lib/types";

export type SphereState =
  | "greedy"
  | "manual-added"
  | "manual-removed"
  | "default";

interface Scene3DProps {
  points?: UmapPoint[];
  selectedLines?: string[];
  greedyLines?: string[];
  isManualMode?: boolean;
  filterCancerType?: string;
  highlightOverlap?: string[];
  missingTypes?: string[];
  onSphereClick?: (cellLine: string) => void;
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

function RedRimPulse({ position }: { position: [number, number, number] }) {
  const ref = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current?.material) {
      const mat = ref.current.material as MeshStandardMaterial;
      mat.emissiveIntensity = 0.25 + 0.55 * Math.sin(clock.elapsedTime * 3);
    }
  });

  return (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[0.15, 24, 24]} />
      <meshStandardMaterial
        color="#EF233C"
        emissive="#EF233C"
        transparent
        opacity={0.35}
      />
    </mesh>
  );
}

function getSphereState(
  cellLine: string,
  isManualMode: boolean,
  greedySet: Set<string>,
  selectedSet: Set<string>,
): SphereState {
  if (!isManualMode) {
    return greedySet.has(cellLine) ? "greedy" : "default";
  }
  const inGreedy = greedySet.has(cellLine);
  const inManual = selectedSet.has(cellLine);
  if (inManual && inGreedy) return "greedy";
  if (inManual && !inGreedy) return "manual-added";
  if (!inManual && inGreedy) return "manual-removed";
  return "default";
}

function CellSphere({
  point,
  state,
  isFilteredOut,
  isOverlap,
  isMissingType,
  onHover,
  onClick,
}: {
  point: UmapPoint;
  state: SphereState;
  isFilteredOut: boolean;
  isOverlap: boolean;
  isMissingType: boolean;
  onHover: (p: UmapPoint | null) => void;
  onClick?: (cellLine: string) => void;
}) {
  const baseColor = CANCER_COLORS[point.cancer_type] ?? "#888888";

  let color = baseColor;
  let emissive = baseColor;
  let emissiveIntensity = 0.2;
  let radius = 0.08;
  let opacity = 1;
  let scale = 1;

  switch (state) {
    case "greedy":
      color = "#FFD700";
      emissive = "#FFD700";
      emissiveIntensity = 0.7;
      radius = 0.12;
      scale = 1.5;
      break;
    case "manual-added":
      color = "#00F5FF";
      emissive = "#00F5FF";
      emissiveIntensity = 0.65;
      radius = 0.11;
      scale = 1.35;
      break;
    case "manual-removed":
      color = "#555555";
      emissive = "#333333";
      emissiveIntensity = 0.1;
      opacity = 0.3;
      break;
    default:
      if (isOverlap) {
        color = "#ffffff";
        emissive = "#ffffff";
        emissiveIntensity = 0.5;
      }
      break;
  }

  if (isFilteredOut && state === "default") {
    opacity = 0.15;
    color = "#555555";
  }

  const pos: [number, number, number] = [point.x, point.y, point.z];

  return (
    <group>
      {isMissingType && state !== "greedy" && <RedRimPulse position={pos} />}
      <mesh
        position={pos}
        scale={scale}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover(point);
        }}
        onPointerOut={() => onHover(null)}
        onClick={(e) => {
          e.stopPropagation();
          onClick?.(point.cell_line);
        }}
      >
        <sphereGeometry args={[radius, 24, 24]} />
        <meshStandardMaterial
          color={color}
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
          transparent={opacity < 1}
          opacity={opacity}
        />
      </mesh>
    </group>
  );
}

function SceneContent({
  points,
  selectedLines,
  greedyLines,
  isManualMode,
  filterCancerType,
  highlightOverlap,
  missingTypes,
  onSphereClick,
  hovered,
  setHovered,
}: {
  points: UmapPoint[];
  selectedLines: string[];
  greedyLines: string[];
  isManualMode: boolean;
  filterCancerType?: string;
  highlightOverlap: string[];
  missingTypes: string[];
  onSphereClick?: (cellLine: string) => void;
  hovered: UmapPoint | null;
  setHovered: (p: UmapPoint | null) => void;
}) {
  const selectedSet = useMemo(() => new Set(selectedLines), [selectedLines]);
  const greedySet = useMemo(() => new Set(greedyLines), [greedyLines]);
  const overlapSet = useMemo(() => new Set(highlightOverlap), [highlightOverlap]);
  const missingSet = useMemo(() => new Set(missingTypes), [missingTypes]);

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
        const state = getSphereState(
          point.cell_line,
          isManualMode,
          greedySet,
          selectedSet,
        );
        const isSelected = selectedSet.has(point.cell_line);
        const isFilteredOut =
          filterCancerType != null &&
          filterCancerType !== "all" &&
          point.cancer_type !== filterCancerType &&
          !isSelected;
        const isMissingType = missingSet.has(point.cancer_type);

        return (
          <CellSphere
            key={point.cell_line}
            point={point}
            state={state}
            isFilteredOut={isFilteredOut}
            isOverlap={overlapSet.has(point.cell_line)}
            isMissingType={isMissingType}
            onHover={setHovered}
            onClick={onSphereClick}
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
  greedyLines = [],
  isManualMode = false,
  filterCancerType,
  highlightOverlap = [],
  missingTypes = [],
  onSphereClick,
}: Scene3DProps) {
  const [hovered, setHovered] = useState<UmapPoint | null>(null);
  const hasData = points.length > 0;
  const effectiveGreedy = greedyLines.length > 0 ? greedyLines : selectedLines;

  return (
    <div className="relative h-full w-full">
      <Canvas camera={{ position: [0, 0, 6], fov: 50 }} className="h-full w-full">
        {hasData ? (
          <SceneContent
            points={points}
            selectedLines={selectedLines}
            greedyLines={effectiveGreedy}
            isManualMode={isManualMode}
            filterCancerType={filterCancerType}
            highlightOverlap={highlightOverlap}
            missingTypes={missingTypes}
            onSphereClick={onSphereClick}
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

      {hasData && (
        <p className="pointer-events-none absolute bottom-3 right-3 text-[10px] text-zinc-600">
          Click spheres to manually edit panel
        </p>
      )}
    </div>
  );
}
