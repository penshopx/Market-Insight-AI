import { motion } from 'framer-motion';
import { Target } from 'lucide-react';
import { useEffect, useState } from 'react';

export function Scene4() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 1000), // Show main logo
      setTimeout(() => setPhase(2), 2500), // Show subtitle
      setTimeout(() => setPhase(3), 4000), // Show CTA text
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="w-full h-full flex flex-col justify-center items-center relative overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1 }}
    >
      <div className="z-20 flex flex-col items-center">
        {/* Logo/Icon */}
        <motion.div
          className="w-[8vw] h-[8vw] rounded-3xl bg-gradient-to-br from-primary to-accent p-[2px] mb-[4vh] shadow-[0_0_40px_10px_rgba(251,191,36,0.3)]"
          initial={{ scale: 0, rotate: -90, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 150, damping: 20 }}
        >
          <div className="w-full h-full bg-bg-dark rounded-[22px] flex items-center justify-center">
            <Target className="w-[4vw] h-[4vw] text-white" />
          </div>
        </motion.div>

        {/* Brand Name */}
        <motion.div
          className="overflow-hidden"
          initial={{ clipPath: "inset(0 50% 0 50%)" }}
          animate={phase >= 1 ? { clipPath: "inset(0 0% 0 0%)" } : { clipPath: "inset(0 50% 0 50%)" }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        >
          <h1 className="text-[5vw] font-display font-extrabold text-white tracking-tight leading-none text-center">
            Intel Konstruksi
          </h1>
        </motion.div>

        {/* Subtitle */}
        <motion.div
          initial={{ opacity: 0, y: '2vh' }}
          animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: '2vh' }}
          transition={{ duration: 0.8 }}
        >
          <p className="text-[1.5vw] text-text-secondary font-medium tracking-wide uppercase mt-[2vh] mb-[6vh] text-center">
            Market Intelligence untuk Konstruksi
          </p>
        </motion.div>

        {/* Final Hook */}
        <motion.div
          className="relative px-[3vw] py-[2vh]"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={phase >= 3 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
          transition={{ duration: 1, ease: "easeOut" }}
        >
          {/* Decorative brackets */}
          <div className="absolute top-0 left-0 w-[2vw] h-[2vw] border-t-2 border-l-2 border-primary opacity-50" />
          <div className="absolute bottom-0 right-0 w-[2vw] h-[2vw] border-b-2 border-r-2 border-primary opacity-50" />
          
          <h2 className="text-[2.5vw] font-display font-semibold text-gradient text-center">
            Menangkan proyek sebelum kompetitor tahu.
          </h2>
        </motion.div>
      </div>

    </motion.div>
  );
}
