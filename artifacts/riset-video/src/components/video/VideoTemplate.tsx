// Video Template - Replace ReplitLoadingScene with your scenes

import { useVideoPlayer } from '@/lib/video';
import { AnimatePresence, motion } from 'framer-motion';

import { Scene0 } from './video_scenes/Scene0';
import { Scene1 } from './video_scenes/Scene1';
import { Scene2 } from './video_scenes/Scene2';
import { Scene3 } from './video_scenes/Scene3';
import { Scene4 } from './video_scenes/Scene4';

const SCENE_DURATIONS = {
  scene0: 6000,
  scene1: 10000,
  scene2: 8000,
  scene3: 10000,
  scene4: 11000,
};

export default function VideoTemplate() {
  const { currentScene } = useVideoPlayer({
    durations: SCENE_DURATIONS,
  });

  return (
    <div
      className="w-full h-screen overflow-hidden relative"
      style={{ backgroundColor: 'var(--color-bg-dark)' }}
    >
      {/* Persistent Background Grid */}
      <motion.div
        className="absolute inset-0 z-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: `url(${import.meta.env.BASE_URL}images/blueprint-grid.png)`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
        animate={{
          scale: currentScene === 4 ? 1.05 : 1,
          opacity: currentScene === 2 ? 0.4 : 0.2,
          y: currentScene === 1 ? '-2vh' : '0vh'
        }}
        transition={{ duration: 4, ease: "easeOut" }}
      />
      
      {/* Persistent Glows */}
      <motion.div 
        className="absolute w-[60vw] h-[60vw] rounded-full blur-[100px] pointer-events-none z-0"
        style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, rgba(0,0,0,0) 70%)' }}
        animate={{
          x: currentScene === 0 ? '-10vw' : currentScene === 2 ? '50vw' : '20vw',
          y: currentScene === 1 ? '10vh' : currentScene === 3 ? '-20vh' : '0vh',
          scale: currentScene === 4 ? 1.5 : 1
        }}
        transition={{ duration: 6, ease: "easeInOut" }}
      />
      
      <motion.div 
        className="absolute w-[40vw] h-[40vw] rounded-full blur-[80px] pointer-events-none z-0"
        style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.1) 0%, rgba(0,0,0,0) 70%)' }}
        animate={{
          x: currentScene === 0 ? '50vw' : currentScene === 3 ? '10vw' : '70vw',
          y: currentScene === 1 ? '40vh' : currentScene === 2 ? '10vh' : '50vh',
        }}
        transition={{ duration: 5, ease: "easeInOut" }}
      />

      <div className="absolute inset-0 z-10">
        <AnimatePresence mode="popLayout">
          {currentScene === 0 && <Scene0 key="scene0" />}
          {currentScene === 1 && <Scene1 key="scene1" />}
          {currentScene === 2 && <Scene2 key="scene2" />}
          {currentScene === 3 && <Scene3 key="scene3" />}
          {currentScene === 4 && <Scene4 key="scene4" />}
        </AnimatePresence>
      </div>
    </div>
  );
}
