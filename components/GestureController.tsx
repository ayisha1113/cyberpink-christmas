import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker, DrawingUtils } from '@mediapipe/tasks-vision';
import { AppMode, GestureState } from '../types';

interface GestureControllerProps {
  onStateChange: (state: Partial<GestureState>) => void;
  onModeTrigger: (mode: AppMode) => void;
}

export const GestureController: React.FC<GestureControllerProps> = ({ onStateChange, onModeTrigger }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let handLandmarker: HandLandmarker | null = null;
    let animationFrameId: number;

    const setupMediaPipe = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        );
        
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 1
        });

        startCamera(handLandmarker);
      } catch (err) {
        console.error("MediaPipe Init Error:", err);
        setError("Failed to load AI model.");
        setLoading(false);
      }
    };

    const startCamera = async (landmarker: HandLandmarker) => {
      if (!videoRef.current) return;
      
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: 320, height: 240, facingMode: "user" } 
        });
        videoRef.current.srcObject = stream;
        videoRef.current.addEventListener('loadeddata', () => {
            setLoading(false);
            predictWebcam(landmarker);
        });
      } catch (err) {
        console.error("Camera Error:", err);
        setError("Camera access denied.");
        setLoading(false);
      }
    };

    let lastVideoTime = -1;

    const predictWebcam = (landmarker: HandLandmarker) => {
      if (!videoRef.current || !canvasRef.current) return;
      
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Match canvas size to video
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      const startTimeMs = performance.now();
      
      if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        const results = landmarker.detectForVideo(video, startTimeMs);

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (results.landmarks && results.landmarks.length > 0) {
            const landmarks = results.landmarks[0];
            
            // Draw debug lines
            const drawingUtils = new DrawingUtils(ctx);
            drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, {
                color: "#ff69b4",
                lineWidth: 2
            });

            // Logic: 
            // 1. Pinch Detection (Thumb Tip [4] vs Index Tip [8])
            const thumbTip = landmarks[4];
            const indexTip = landmarks[8];
            const distance = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
            const isPinching = distance < 0.08;

            // 2. Open Hand Detection (Avg distance of tips from wrist)
            const wrist = landmarks[0];
            const tips = [8, 12, 16, 20].map(i => landmarks[i]);
            const avgDist = tips.reduce((acc, t) => acc + Math.hypot(t.x - wrist.x, t.y - wrist.y), 0) / 4;
            const isOpen = avgDist > 0.3 && !isPinching;

            // 3. Hand Position (Palm Center approximately wrist or index base)
            const handX = 1.0 - landmarks[9].x; // Mirror flip X
            const handY = landmarks[9].y;

            // Update State
            onStateChange({
                isHandDetected: true,
                isPinching,
                isOpen,
                handPosition: { x: handX, y: handY },
                rotationOffset: (handX - 0.5) * 2 // Map 0..1 to -1..1
            });

            // Trigger Modes
            if (isPinching) onModeTrigger(AppMode.TREE);
            if (isOpen) onModeTrigger(AppMode.EXPLODE);

        } else {
            onStateChange({ isHandDetected: false });
        }
      }

      animationFrameId = requestAnimationFrame(() => predictWebcam(landmarker));
    };

    setupMediaPipe();

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (videoRef.current && videoRef.current.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
      }
      if (handLandmarker) handLandmarker.close();
    };
  }, [onStateChange, onModeTrigger]);

  return (
    <div className="fixed bottom-4 right-4 z-50 overflow-hidden rounded-xl border-2 border-pink-500/30 bg-black/50 backdrop-blur-md shadow-[0_0_20px_rgba(255,105,180,0.3)] transition-all hover:border-pink-500">
        <div className="relative w-40 h-32 md:w-64 md:h-48">
            {loading && (
                <div className="absolute inset-0 flex items-center justify-center text-pink-300 text-xs animate-pulse">
                    Loading AI...
                </div>
            )}
            {error && (
                <div className="absolute inset-0 flex items-center justify-center text-red-400 text-xs p-2 text-center">
                    {error}
                </div>
            )}
            {/* Mirror the video for natural interaction */}
            <video 
                ref={videoRef} 
                className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1] opacity-60" 
                autoPlay 
                playsInline 
                muted 
            />
            <canvas 
                ref={canvasRef} 
                className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1]" 
            />
        </div>
        <div className="absolute bottom-1 left-2 text-[10px] text-pink-200/80 font-mono">
            PINCH: Tree | OPEN: Explode
        </div>
    </div>
  );
};
