"use client";

import { Environment, Html, Line, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import type { Group, Mesh, MeshStandardMaterial } from "three";
import { CANCER_COLORS } from "@/lib/constants";
import { sceneTheme, theme } from "@/lib/theme";
import type { UmapPoint } from "@/lib/types";

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

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
  compact?: boolean;
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
          color={sceneTheme.connectionLine}
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
        color={sceneTheme.blindspot}
        emissive={sceneTheme.blindspot}
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
  isNewest,
  isHovered,
  onHover,
  onClick,
}: {
  point: UmapPoint;
  state: SphereState;
  isFilteredOut: boolean;
  isOverlap: boolean;
  isMissingType: boolean;
  isNewest: boolean;
  isHovered: boolean;
  onHover: (p: UmapPoint | null) => void;
  onClick?: (cellLine: string) => void;
}) {
  const baseColor = CANCER_COLORS[point.cancer_type] ?? theme.fgSubtle;

  let color = baseColor;
  let emissive = "#000000";
  let emissiveIntensity = 0;
  let radius = 0.08;
  let opacity = 1;
  let scale = 1;
  let roughness = 0.42;
  const metalness = 0.12;
  let clearcoat = 0.55;
  let envMapIntensity = 0.85;

  switch (state) {
    case "greedy":
      color = sceneTheme.greedy;
      emissive = sceneTheme.greedy;
      emissiveIntensity = 0.18;
      radius = 0.12;
      scale = 1.5;
      roughness = 0.28;
      clearcoat = 0.75;
      envMapIntensity = 1.1;
      break;
    case "manual-added":
      color = sceneTheme.manualAdded;
      emissive = sceneTheme.manualAdded;
      emissiveIntensity = 0.16;
      radius = 0.11;
      scale = 1.35;
      roughness = 0.32;
      clearcoat = 0.7;
      envMapIntensity = 1;
      break;
    case "manual-removed":
      color = sceneTheme.manualRemoved;
      emissive = sceneTheme.manualRemoved;
      emissiveIntensity = 0.04;
      opacity = 0.3;
      roughness = 0.65;
      clearcoat = 0.2;
      envMapIntensity = 0.35;
      break;
    default:
      if (isOverlap) {
        color = sceneTheme.overlap;
        emissive = sceneTheme.overlap;
        emissiveIntensity = 0.12;
        roughness = 0.35;
        clearcoat = 0.65;
      }
      break;
  }

  if (isFilteredOut && state === "default") {
    opacity = 0.15;
    color = theme.fgSubtle;
    roughness = 0.75;
    clearcoat = 0.1;
    envMapIntensity = 0.25;
  }

  if (isHovered) {
    scale *= 1.18;
    roughness = Math.max(0.2, roughness - 0.08);
    envMapIntensity += 0.2;
  }

  const pos: [number, number, number] = [point.x, point.y, point.z];
  // Fly-in start: drop from directly above the destination
  const startPos: [number, number, number] = [point.x * 2, point.y * 2 + 14, point.z * 2];

  const groupRef = useRef<Group>(null);
  const animRef = useRef({ progress: 1, playing: false, prevIsNewest: false });

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;
    const anim = animRef.current;

    // Rising edge: isNewest just became true → start animation
    if (isNewest && !anim.prevIsNewest) {
      anim.progress = 0;
      anim.playing = true;
    }
    anim.prevIsNewest = isNewest;

    if (anim.playing) {
      anim.progress = Math.min(1, anim.progress + delta * 1.6);
      const t = easeOutBack(anim.progress);
      group.position.set(
        startPos[0] + (pos[0] - startPos[0]) * t,
        startPos[1] + (pos[1] - startPos[1]) * t,
        startPos[2] + (pos[2] - startPos[2]) * t,
      );
      // Brief scale pulse as it lands
      const pulse =
        anim.progress > 0.75
          ? 1 + Math.sin((anim.progress - 0.75) * 4 * Math.PI) * 0.45
          : 1;
      group.scale.setScalar(scale * pulse);
      if (anim.progress >= 1) {
        anim.playing = false;
        group.position.set(pos[0], pos[1], pos[2]);
        group.scale.setScalar(scale);
      }
    } else {
      group.position.set(pos[0], pos[1], pos[2]);
      group.scale.setScalar(scale);
    }
  });

  return (
    <group ref={groupRef}>
      {isMissingType && state !== "greedy" && <RedRimPulse position={[0, 0, 0]} />}
      <mesh
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
        <sphereGeometry args={[radius, 32, 32]} />
        <meshPhysicalMaterial
          color={color}
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
          roughness={roughness}
          metalness={metalness}
          clearcoat={clearcoat}
          clearcoatRoughness={0.18}
          envMapIntensity={envMapIntensity}
          transparent={opacity < 1}
          opacity={opacity}
        />
      </mesh>
      {(state === "greedy" || state === "manual-added") && (
        <mesh renderOrder={-1}>
          <sphereGeometry args={[radius * 1.06, 24, 24]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.14}
            depthWrite={false}
          />
        </mesh>
      )}
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
  compact = false,
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
  compact?: boolean;
}) {
  const selectedSet = useMemo(() => new Set(selectedLines), [selectedLines]);
  const greedySet = useMemo(() => new Set(greedyLines), [greedyLines]);
  const overlapSet = useMemo(() => new Set(highlightOverlap), [highlightOverlap]);
  const missingSet = useMemo(() => new Set(missingTypes), [missingTypes]);

  // Detect which line was just added so CellSphere can play the fly-in animation
  const [prevSelected, setPrevSelected] = useState<string[]>([]);
  const [newestLine, setNewestLine] = useState<string | null>(null);

  const isDifferent =
    selectedLines.length !== prevSelected.length ||
    selectedLines.some((val, idx) => val !== prevSelected[idx]);

  if (isDifferent) {
    const prevSet = new Set(prevSelected);
    const added = selectedLines.filter((l) => !prevSet.has(l));
    setNewestLine(added.length === 1 ? added[0] : null);
    setPrevSelected(selectedLines);
  }

  return (
    <>
      <color attach="background" args={[sceneTheme.background]} />
      <Environment preset="city" environmentIntensity={0.35} />
      <ambientLight intensity={0.18} />
      <hemisphereLight
        args={["#8fbfb0", sceneTheme.background, 0.55]}
        position={[0, 1, 0]}
      />
      <directionalLight
        position={[8, 10, 6]}
        intensity={1.35}
        color="#f0f5f2"
      />
      <directionalLight
        position={[-7, 3, -6]}
        intensity={0.45}
        color="#6ba888"
      />
      <pointLight position={[0, -3, 5]} intensity={0.3} color="#a8c4b8" />
      <gridHelper
        args={[10, 10, sceneTheme.gridPrimary, sceneTheme.gridSecondary]}
        position={[0, -2, 0]}
      />

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
            isNewest={newestLine === point.cell_line}
            isHovered={hovered?.cell_line === point.cell_line}
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
          <div className="whitespace-nowrap rounded-md border border-border bg-surface-elevated px-2 py-1 text-xs text-fg shadow-md">
            <span className="font-mono">{hovered.cell_line}</span>
            <span className="ml-2 text-fg-muted">{hovered.cancer_type}</span>
          </div>
        </Html>
      )}

      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        autoRotate={!compact}
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
  compact = false,
}: Scene3DProps) {
  const [hovered, setHovered] = useState<UmapPoint | null>(null);
  const hasData = points.length > 0;
  const effectiveGreedy = greedyLines.length > 0 ? greedyLines : selectedLines;
  const cameraZ = compact ? 7.5 : 6;

  return (
    <div className="relative h-full w-full">
      <Canvas
        camera={{ position: [0, 0, cameraZ], fov: compact ? 55 : 50 }}
        className="h-full w-full"
        gl={{ antialias: true, alpha: false }}
      >
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
            compact={compact}
          />
        ) : (
          <>
            <color attach="background" args={[sceneTheme.background]} />
            <gridHelper
              args={[10, 10, sceneTheme.gridPrimary, sceneTheme.gridSecondary]}
              position={[0, -2, 0]}
            />
            <OrbitControls enableDamping dampingFactor={0.05} />
          </>
        )}
      </Canvas>

      {!hasData && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="rounded-lg border border-border bg-surface-elevated px-4 py-2 text-sm text-fg-muted">
            Loading cell line embedding…
          </p>
        </div>
      )}

      {hasData && !compact && onSphereClick && (
        <p className="pointer-events-none absolute bottom-3 right-3 text-[10px] text-fg-subtle">
          Click spheres to manually edit panel
        </p>
      )}
    </div>
  );
}
