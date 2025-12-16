import React, { useRef, useMemo, useLayoutEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { AppMode, THEME } from '../types';
import { getRandomSpherePoint, getTreePosition, getRibbonPosition } from '../services/mathUtils';

interface ChristmasTreeProps {
  mode: AppMode;
  gestureRotation: number;
}

const COUNT_LEAVES = 5000;
const COUNT_ORNAMENTS = 1500;
const COUNT_RIBBON = 800;
const EXPLOSION_RADIUS = 15;
const TREE_HEIGHT = 10;
const TREE_RADIUS = 3.5;
// Changed offset from -2 to -3.5 to move tree down
const TREE_Y_OFFSET = -3.5;

export const ChristmasTree: React.FC<ChristmasTreeProps> = ({ mode, gestureRotation }) => {
  // References for InstancedMeshes
  const leavesRef = useRef<THREE.InstancedMesh>(null);
  const ornamentsRef = useRef<THREE.InstancedMesh>(null);
  const ribbonRef = useRef<THREE.InstancedMesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const starRef = useRef<THREE.Group>(null);
  
  // Dummy object for calculating matrices
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // --- DATA GENERATION ---
  
  // 1. Leaves (Octahedrons)
  const leavesData = useMemo(() => {
    return Array.from({ length: COUNT_LEAVES }).map((_, i) => {
      const treePos = getTreePosition(i, COUNT_LEAVES, TREE_RADIUS, TREE_HEIGHT, TREE_Y_OFFSET);
      const explodePos = getRandomSpherePoint(EXPLOSION_RADIUS);
      return { treePos, explodePos, scale: Math.random() * 0.15 + 0.05 };
    });
  }, []);

  // 2. Ornaments (Cubes/Icosahedrons)
  const ornamentsData = useMemo(() => {
    return Array.from({ length: COUNT_ORNAMENTS }).map((_, i) => {
      // Scattered within the tree volume but slightly pushed out
      const treePos = getTreePosition(i, COUNT_ORNAMENTS, TREE_RADIUS * 1.1, TREE_HEIGHT, TREE_Y_OFFSET);
      // More vertical randomness for tree pos
      treePos.y += (Math.random() - 0.5); 
      const explodePos = getRandomSpherePoint(EXPLOSION_RADIUS * 1.2);
      // Reduced scale for "small particles" look (was 0.05-0.15, now 0.02-0.07)
      return { treePos, explodePos, scale: Math.random() * 0.05 + 0.02 };
    });
  }, []);

  // 3. Ribbon (Tetrahedrons)
  const ribbonData = useMemo(() => {
    return Array.from({ length: COUNT_RIBBON }).map((_, i) => {
      const t = i / COUNT_RIBBON;
      const treePos = getRibbonPosition(t, TREE_RADIUS + 0.2, TREE_HEIGHT, 3.5, TREE_Y_OFFSET);
      const explodePos = getRandomSpherePoint(EXPLOSION_RADIUS * 1.5);
      return { treePos, explodePos, scale: 0.08 };
    });
  }, []);

  // 4. Star Data
  const starShape = useMemo(() => {
    const shape = new THREE.Shape();
    const points = 5;
    const outerRadius = 0.8;
    const innerRadius = 0.35;
    
    for (let i = 0; i < points * 2; i++) {
        const angle = (i * Math.PI) / points;
        const r = i % 2 === 0 ? outerRadius : innerRadius;
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        if (i === 0) shape.moveTo(x, y);
        else shape.lineTo(x, y);
    }
    shape.closePath();
    return shape;
  }, []);
  
  const starExplodePos = useMemo(() => getRandomSpherePoint(EXPLOSION_RADIUS * 0.8), []);
  const starTreePos = useMemo(() => new THREE.Vector3(0, TREE_HEIGHT + TREE_Y_OFFSET + 0.2, 0), []); // Top of tree

  // Animation State
  const transitionRef = useRef(0); // 0 = Tree, 1 = Explode

  // --- ANIMATION LOOP ---
  useFrame((state, delta) => {
    if (!leavesRef.current || !ornamentsRef.current || !ribbonRef.current || !groupRef.current || !starRef.current) return;

    // 1. Handle Transition Logic
    const target = mode === AppMode.EXPLODE ? 1 : 0;
    // Smooth Lerp
    transitionRef.current = THREE.MathUtils.lerp(transitionRef.current, target, delta * 2.5);
    const t = transitionRef.current;

    // 2. Rotate entire group (Auto rotate + Gesture control)
    // Base rotation slow, plus gesture offset (High Sensitivity * 5)
    groupRef.current.rotation.y = (state.clock.elapsedTime * 0.1) + (gestureRotation * 5);

    // 3. Update Leaves
    leavesData.forEach((data, i) => {
      // Interpolate position
      dummy.position.lerpVectors(data.treePos, data.explodePos, t);
      
      // Rotate individually for sparkle effect
      dummy.rotation.set(
        Math.sin(state.clock.elapsedTime * 0.5 + i),
        Math.cos(state.clock.elapsedTime * 0.3 + i),
        0
      );
      
      dummy.scale.setScalar(data.scale * (1 - t * 0.5)); // Shrink slightly when exploded
      dummy.updateMatrix();
      leavesRef.current!.setMatrixAt(i, dummy.matrix);
    });
    leavesRef.current.instanceMatrix.needsUpdate = true;

    // 4. Update Ornaments
    ornamentsData.forEach((data, i) => {
      dummy.position.lerpVectors(data.treePos, data.explodePos, t);
      dummy.rotation.set(state.clock.elapsedTime + i, state.clock.elapsedTime + i, 0);
      dummy.scale.setScalar(data.scale);
      dummy.updateMatrix();
      ornamentsRef.current!.setMatrixAt(i, dummy.matrix);
    });
    ornamentsRef.current.instanceMatrix.needsUpdate = true;

    // 5. Update Ribbon
    ribbonData.forEach((data, i) => {
      // Ribbon explodes outward faster
      const explodePos = data.explodePos.clone().multiplyScalar(1.5);
      dummy.position.lerpVectors(data.treePos, explodePos, t);
      
      // Ribbon particles align with curve direction approx via rotation
      dummy.rotation.set(state.clock.elapsedTime * 2 + i, i * 0.1, 0);
      dummy.scale.setScalar(data.scale);
      dummy.updateMatrix();
      ribbonRef.current!.setMatrixAt(i, dummy.matrix);
    });
    ribbonRef.current.instanceMatrix.needsUpdate = true;

    // 6. Update Star
    // Position
    starRef.current.position.lerpVectors(starTreePos, starExplodePos, t);
    
    // Rotate Star
    starRef.current.rotation.z = state.clock.elapsedTime * 0.5;
    starRef.current.rotation.y = Math.sin(state.clock.elapsedTime) * 0.2;
    
    // Scale Star (Pulse) - reduces in explode mode
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 4) * 0.1;
    const baseScale = 1 - (t * 0.3); 
    starRef.current.scale.setScalar(pulse * baseScale);
  });

  // --- INITIAL SETUP (Colors) ---
  useLayoutEffect(() => {
    // Set colors for leaves
    const colorA = new THREE.Color(THEME.colors.leafPrimary);
    const colorB = new THREE.Color(THEME.colors.leafSecondary);
    const tempColor = new THREE.Color();

    for (let i = 0; i < COUNT_LEAVES; i++) {
      // Mix colors
      tempColor.lerpColors(colorA, colorB, Math.random());
      leavesRef.current!.setColorAt(i, tempColor);
    }
    leavesRef.current!.instanceColor!.needsUpdate = true;

    // Set colors for ornaments
    const ornColor = new THREE.Color(THEME.colors.ornament);
    for (let i = 0; i < COUNT_ORNAMENTS; i++) {
        // Slight variation in brightness
        tempColor.copy(ornColor).multiplyScalar(0.8 + Math.random() * 0.4);
        ornamentsRef.current!.setColorAt(i, tempColor);
    }
    ornamentsRef.current!.instanceColor!.needsUpdate = true;
  }, []);

  return (
    <group ref={groupRef}>
      {/* 1. Leaves: Matte Metal Octahedrons */}
      <instancedMesh ref={leavesRef} args={[undefined, undefined, COUNT_LEAVES]}>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial 
          metalness={0.1} // Low metalness for white reflections (plastic/dielectric look)
          roughness={0.15} // Lower roughness for sharper white highlights
          color={THEME.colors.leafPrimary} 
        />
      </instancedMesh>

      {/* 2. Ornaments: Shiny Cubes/Icosahedrons */}
      <instancedMesh ref={ornamentsRef} args={[undefined, undefined, COUNT_ORNAMENTS]}>
        <icosahedronGeometry args={[1, 0]} />
        <meshPhysicalMaterial 
          metalness={0.9} 
          roughness={0.1} 
          clearcoat={1} 
          color={THEME.colors.ornament}
        />
      </instancedMesh>

      {/* 3. Ribbon: Glowing Tetrahedrons */}
      <instancedMesh ref={ribbonRef} args={[undefined, undefined, COUNT_RIBBON]}>
        <tetrahedronGeometry args={[1, 0]} />
        <meshStandardMaterial 
          color={THEME.colors.ribbon} 
          emissive={THEME.colors.ribbon}
          emissiveIntensity={2}
          toneMapped={false}
        />
      </instancedMesh>

      {/* 4. Tree Top Star */}
      <group ref={starRef}>
        <mesh>
          <extrudeGeometry 
            args={[
              starShape, 
              { depth: 0.2, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 3 }
            ]} 
          />
          <meshStandardMaterial 
            color={THEME.colors.star}
            emissive={THEME.colors.star}
            emissiveIntensity={3}
            toneMapped={false}
          />
        </mesh>
        
        {/* Dynamic Flying Sparkles */}
        <Sparkles 
          count={60}
          scale={5}
          size={4}
          speed={1}
          opacity={0.8}
          color="#FFF"
        />
        {/* Inner intense core glow */}
        <pointLight intensity={2} color={THEME.colors.star} distance={5} decay={2} />
      </group>
    </group>
  );
};