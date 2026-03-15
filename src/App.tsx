import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'motion/react';
import { Play, RotateCcw, Trophy, ChevronLeft, ChevronRight } from 'lucide-react';

// --- Constants ---
const GRID_SIZE = 100;
const GRID_DIVISIONS = 20;
const PLAYER_SPEED = 15;
const OBSTACLE_SPAWN_RATE = 0.05;
const GAME_SPEED_START = 20;
const GAME_SPEED_MAX = 60;
const GAME_SPEED_ACCEL = 0.5;

// --- Types ---
type GameState = 'START' | 'PLAYING' | 'GAMEOVER';

interface ObstacleData {
  id: number;
  position: [number, number, number];
  size: [number, number, number];
  color: string;
}

// --- Components ---

const Player = ({ position, targetX }: { position: THREE.Vector3, targetX: number }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    if (meshRef.current) {
      // Smoothly move player towards target X
      meshRef.current.position.x = THREE.MathUtils.lerp(meshRef.current.position.x, targetX, delta * 10);
      position.x = meshRef.current.position.x;
      
      // Add some tilt based on movement
      const tilt = (targetX - meshRef.current.position.x) * 0.5;
      meshRef.current.rotation.z = THREE.MathUtils.lerp(meshRef.current.rotation.z, tilt, delta * 5);
      meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, -tilt * 0.5, delta * 5);
    }
  });

  return (
    <group ref={meshRef} position={[0, 0.5, 0]}>
      {/* Main Body */}
      <mesh castShadow>
        <boxGeometry args={[0.8, 0.4, 1.2]} />
        <meshStandardMaterial color="#00ffff" emissive="#00ffff" emissiveIntensity={2} />
      </mesh>
      {/* Cockpit */}
      <mesh position={[0, 0.25, 0.2]}>
        <boxGeometry args={[0.4, 0.3, 0.6]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={1} />
      </mesh>
      {/* Wings */}
      <mesh position={[0.6, 0, -0.2]}>
        <boxGeometry args={[0.6, 0.1, 0.8]} />
        <meshStandardMaterial color="#ff00ff" emissive="#ff00ff" emissiveIntensity={1} />
      </mesh>
      <mesh position={[-0.6, 0, -0.2]}>
        <boxGeometry args={[0.6, 0.1, 0.8]} />
        <meshStandardMaterial color="#ff00ff" emissive="#ff00ff" emissiveIntensity={1} />
      </mesh>
      {/* Engine Glow */}
      <pointLight position={[0, 0, -0.8]} color="#00ffff" intensity={2} distance={3} />
    </group>
  );
};

const Obstacle = ({ data, onCollision }: { data: ObstacleData, onCollision: () => void }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  return (
    <mesh ref={meshRef} position={data.position} castShadow>
      <boxGeometry args={data.size} />
      <meshStandardMaterial color={data.color} emissive={data.color} emissiveIntensity={2} />
    </mesh>
  );
};

const ScrollingGrid = ({ speed }: { speed: number }) => {
  const gridRef = useRef<THREE.Group>(null);
  const grid1Ref = useRef<THREE.GridHelper>(null);
  const grid2Ref = useRef<THREE.GridHelper>(null);

  useFrame((state, delta) => {
    if (grid1Ref.current && grid2Ref.current) {
      grid1Ref.current.position.z += speed * delta;
      grid2Ref.current.position.z += speed * delta;

      if (grid1Ref.current.position.z > 100) {
        grid1Ref.current.position.z -= 200;
      }
      if (grid2Ref.current.position.z > 100) {
        grid2Ref.current.position.z -= 200;
      }
    }
  });

  return (
    <group ref={gridRef}>
      <gridHelper 
        ref={grid1Ref} 
        args={[200, 40, 0xff00ff, 0x333333]} 
        position={[0, 0, 0]} 
        rotation={[0, 0, 0]}
      />
      <gridHelper 
        ref={grid2Ref} 
        args={[200, 40, 0xff00ff, 0x333333]} 
        position={[0, 0, -200]} 
        rotation={[0, 0, 0]}
      />
    </group>
  );
};

const GameContent = ({ 
  gameState, 
  setGameState, 
  score, 
  setScore 
}: { 
  gameState: GameState, 
  setGameState: (s: GameState) => void,
  score: number,
  setScore: (n: number | ((prev: number) => number)) => void
}) => {
  const [targetX, setTargetX] = useState(0);
  const [obstacles, setObstacles] = useState<ObstacleData[]>([]);
  const [gameSpeed, setGameSpeed] = useState(GAME_SPEED_START);
  const playerPos = useRef(new THREE.Vector3(0, 0.5, 0));
  const obstacleIdCounter = useRef(0);

  // Handle Input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== 'PLAYING') return;
      if (e.key === 'ArrowLeft' || e.key === 'a') setTargetX(prev => Math.max(prev - 2, -10));
      if (e.key === 'ArrowRight' || e.key === 'd') setTargetX(prev => Math.min(prev + 2, 10));
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState]);

  // Game Loop for logic
  useFrame((state, delta) => {
    if (gameState !== 'PLAYING') return;

    // Increase speed
    setGameSpeed(prev => Math.min(prev + GAME_SPEED_ACCEL * delta, GAME_SPEED_MAX));
    
    // Update score
    setScore(prev => prev + Math.floor(gameSpeed * delta));

    // Spawn obstacles
    if (Math.random() < OBSTACLE_SPAWN_RATE) {
      const size: [number, number, number] = [Math.random() * 2 + 1, Math.random() * 3 + 1, Math.random() * 2 + 1];
      const newObstacle: ObstacleData = {
        id: obstacleIdCounter.current++,
        position: [(Math.random() - 0.5) * 20, size[1] / 2, -100],
        size,
        color: Math.random() > 0.5 ? '#ff00ff' : '#00ffff'
      };
      setObstacles(prev => [...prev, newObstacle]);
    }

    // Move obstacles and check collisions
    setObstacles(prev => {
      const next = prev.map(obs => ({
        ...obs,
        position: [obs.position[0], obs.position[1], obs.position[2] + gameSpeed * delta] as [number, number, number]
      })).filter(obs => obs.position[2] < 20);

      // Simple AABB Collision Detection
      for (const obs of next) {
        const px = playerPos.current.x;
        const pz = playerPos.current.z;
        const ox = obs.position[0];
        const oz = obs.position[2];
        const ow = obs.size[0] / 2;
        const od = obs.size[2] / 2;

        if (Math.abs(px - ox) < (0.4 + ow) && Math.abs(pz - oz) < (0.6 + od)) {
          setGameState('GAMEOVER');
          return [];
        }
      }

      return next;
    });
  });

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 5, 10]} rotation={[-0.4, 0, 0]} />
      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
      
      <ambientLight intensity={0.2} />
      <pointLight position={[10, 10, 10]} intensity={1} color="#ff00ff" />
      <pointLight position={[-10, 10, 10]} intensity={1} color="#00ffff" />

      <ScrollingGrid speed={gameState === 'PLAYING' ? gameSpeed : 5} />
      
      {gameState !== 'START' && (
        <Player position={playerPos.current} targetX={targetX} />
      )}

      {obstacles.map(obs => (
        <Obstacle key={obs.id} data={obs} onCollision={() => {}} />
      ))}

      {/* Background Glow */}
      <mesh position={[0, -1, -50]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#111" />
      </mesh>
    </>
  );
};

export default function App() {
  const [gameState, setGameState] = useState<GameState>('START');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);

  const startGame = () => {
    setScore(0);
    setGameState('PLAYING');
  };

  useEffect(() => {
    if (gameState === 'GAMEOVER') {
      if (score > highScore) {
        setHighScore(score);
      }
    }
  }, [gameState, score, highScore]);

  return (
    <div className="w-full h-screen bg-black text-white font-sans overflow-hidden relative">
      {/* 3D Scene */}
      <Canvas shadows>
        <GameContent 
          gameState={gameState} 
          setGameState={setGameState} 
          score={score} 
          setScore={setScore} 
        />
      </Canvas>

      {/* UI Overlay */}
      <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-between p-8">
        
        {/* Header: Scores */}
        <div className="w-full flex justify-between items-start">
          <div id="score-card" className="bg-black/40 backdrop-blur-md border border-cyan-500/30 rounded-xl p-4 min-w-[120px]">
            <div className="text-xs uppercase tracking-widest text-cyan-400 mb-1">Score</div>
            <div className="text-3xl font-bold font-mono">{score}</div>
          </div>
          
          <div id="highscore-card" className="bg-black/40 backdrop-blur-md border border-fuchsia-500/30 rounded-xl p-4 min-w-[120px] text-right">
            <div className="text-xs uppercase tracking-widest text-fuchsia-400 mb-1">High Score</div>
            <div className="text-3xl font-bold font-mono">{highScore}</div>
          </div>
        </div>

        {/* Center: Menus */}
        <AnimatePresence mode="wait">
          {gameState === 'START' && (
            <motion.div 
              key="start-menu"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="pointer-events-auto flex flex-col items-center"
            >
              <h1 className="text-7xl md:text-9xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-cyan-400 to-fuchsia-600 drop-shadow-[0_0_30px_rgba(34,211,238,0.5)] mb-8">
                NEON GRID
              </h1>
              
              <button 
                id="start-button"
                onClick={startGame}
                className="group relative flex items-center gap-3 bg-white text-black px-12 py-5 rounded-full text-xl font-bold uppercase tracking-widest transition-all hover:scale-105 hover:bg-cyan-400 active:scale-95"
              >
                <Play className="fill-current" size={24} />
                Start Mission
                <div className="absolute inset-0 rounded-full bg-white blur-xl opacity-20 group-hover:opacity-40 transition-opacity" />
              </button>

              <div className="mt-12 flex gap-8 text-cyan-400/60 text-sm uppercase tracking-widest">
                <div className="flex items-center gap-2">
                  <ChevronLeft size={16} /> Move Left
                </div>
                <div className="flex items-center gap-2">
                  Move Right <ChevronRight size={16} />
                </div>
              </div>
            </motion.div>
          )}

          {gameState === 'GAMEOVER' && (
            <motion.div 
              key="gameover-menu"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="pointer-events-auto flex flex-col items-center bg-black/60 backdrop-blur-xl border border-white/10 p-12 rounded-3xl"
            >
              <h2 className="text-5xl font-bold text-red-500 mb-2 uppercase tracking-tighter italic">Mission Failed</h2>
              <p className="text-white/60 mb-8 uppercase tracking-widest text-sm">System Critical Error: Collision Detected</p>
              
              <div className="flex flex-col items-center mb-10">
                <div className="text-white/40 text-xs uppercase tracking-[0.3em] mb-1">Final Score</div>
                <div className="text-6xl font-black text-cyan-400">{score}</div>
              </div>

              {score >= highScore && score > 0 && (
                <div className="flex items-center gap-2 text-yellow-400 mb-8 animate-bounce">
                  <Trophy size={20} />
                  <span className="text-sm font-bold uppercase tracking-widest">New High Score!</span>
                </div>
              )}

              <button 
                id="retry-button"
                onClick={startGame}
                className="group relative flex items-center gap-3 bg-cyan-500 text-black px-12 py-5 rounded-full text-xl font-bold uppercase tracking-widest transition-all hover:scale-105 hover:bg-white active:scale-95"
              >
                <RotateCcw size={24} />
                Try Again
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <div className="text-[10px] uppercase tracking-[0.5em] text-white/20">
          Powered by Google AI Studio & Three.js
        </div>

      </div>

      {/* Scanline Effect */}
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%] z-50 opacity-20" />
    </div>
  );
}
