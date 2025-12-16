import React, { useState, useCallback } from 'react';
import { Scene } from './components/Scene';
import { ChristmasTree } from './components/ChristmasTree';
import { GestureController } from './components/GestureController';
import { AppMode, GestureState } from './types';

function App() {
  const [mode, setMode] = useState<AppMode>(AppMode.TREE);
  const [gestureState, setGestureState] = useState<GestureState>({
    isHandDetected: false,
    isPinching: false,
    isOpen: false,
    handPosition: { x: 0.5, y: 0.5 },
    rotationOffset: 0
  });

  // Toggle mode via Click
  const toggleMode = () => {
    setMode((prev) => (prev === AppMode.TREE ? AppMode.EXPLODE : AppMode.TREE));
  };

  // Update gesture state from controller
  const handleGestureStateChange = useCallback((newState: Partial<GestureState>) => {
    setGestureState((prev) => ({ ...prev, ...newState }));
  }, []);

  // Update mode from gesture trigger
  const handleModeTrigger = useCallback((newMode: AppMode) => {
    setMode(newMode);
  }, []);

  return (
    <div className="relative w-full h-full font-sans">
      
      {/* 3D Scene */}
      <div className="absolute inset-0 z-0" onClick={toggleMode}>
        <Scene>
          <ChristmasTree 
            mode={mode} 
            gestureRotation={gestureState.rotationOffset} 
          />
        </Scene>
      </div>

      {/* UI Overlay */}
      <div className="absolute top-0 left-0 w-full p-8 pointer-events-none z-10 flex flex-col items-start">
        <h1 className="text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-pink-300 via-purple-300 to-white drop-shadow-[0_0_10px_rgba(255,105,180,0.8)]">
          Merry Christmas<br/>from Aliya
        </h1>
        <p className="mt-2 text-pink-200/70 text-sm max-w-xs backdrop-blur-sm bg-black/20 p-2 rounded">
          Click screen or use hand gestures.<br/>
          <span className="font-bold text-white">PINCH</span> to Assemble<br/>
          <span className="font-bold text-white">OPEN HAND</span> to Explode
        </p>
      </div>

      {/* Gesture Controls */}
      <GestureController 
        onStateChange={handleGestureStateChange}
        onModeTrigger={handleModeTrigger}
      />

      {/* Custom Cursor for Gesture Feedback */}
      {gestureState.isHandDetected && (
        <div 
          className={`gesture-cursor ${gestureState.isPinching ? 'pinched' : ''}`}
          style={{
            left: `${gestureState.handPosition.x * 100}%`,
            top: `${gestureState.handPosition.y * 100}%`,
            backgroundColor: gestureState.isOpen ? '#fff' : 'transparent',
            borderColor: gestureState.isPinching ? '#ff00ff' : '#ff69b4'
          }}
        />
      )}
    </div>
  );
}

export default App;