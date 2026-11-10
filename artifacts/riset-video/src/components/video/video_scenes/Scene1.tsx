import { motion } from 'framer-motion';
import { Database, Users, Activity, FileText, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';

export function Scene1() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 1000), // Show main node
      setTimeout(() => setPhase(2), 2500), // Data Tender
      setTimeout(() => setPhase(3), 4000), // Sinyal Kompetitor
      setTimeout(() => setPhase(4), 5500), // Profil Kontraktor
      setTimeout(() => setPhase(5), 7500), // Sync animation
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  const NodeItem = ({ title, desc, icon: Icon, delay, isVisible, x, y, color }: any) => (
    <motion.div
      className="absolute glass-panel rounded-2xl p-[1.5vw] flex items-start gap-[1vw] w-[25vw]"
      initial={{ opacity: 0, scale: 0.8, x: `calc(${x} + 5vw)`, y: y }}
      animate={isVisible ? { opacity: 1, scale: 1, x, y } : { opacity: 0, scale: 0.8, x: `calc(${x} + 5vw)`, y }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      style={{ left: '50%', top: '50%', marginLeft: '-12.5vw', marginTop: '-4vh' }}
    >
      <div className={`p-[1vw] rounded-xl shrink-0`} style={{ backgroundColor: `${color}20` }}>
        <Icon className="w-[2vw] h-[2vw]" style={{ color }} />
      </div>
      <div>
        <h3 className="text-[1.2vw] font-display font-bold text-white mb-[0.5vh]">{title}</h3>
        <p className="text-[0.9vw] font-body text-text-secondary">{desc}</p>
      </div>
    </motion.div>
  );

  return (
    <motion.div 
      className="w-full h-full flex items-center relative overflow-hidden px-[10vw]"
      initial={{ opacity: 0, x: '-10vw' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.9, filter: "blur(20px)", x: '-5vw' }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    >
      {/* Left side text */}
      <div className="w-[40%] z-20">
        <motion.div
          initial={{ opacity: 0, y: '5vh' }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
        >
          <div className="flex items-center gap-3 mb-[2vh] text-accent">
            <Zap className="w-[2vw] h-[2vw]" />
            <span className="font-mono font-bold tracking-wider text-[1vw] uppercase">AUTOPILOT ENGINE</span>
          </div>
          <h2 className="text-[3.5vw] font-display font-bold text-white leading-tight">
            Setiap pagi,<br />
            <span className="text-gradient">Intel Konstruksi</span><br />
            mengumpulkan data
          </h2>
        </motion.div>
      </div>

      {/* Right side data visualization */}
      <div className="w-[60%] relative h-full flex justify-center items-center">
        {/* Main Central Hub */}
        <motion.div
          className="absolute z-10 flex flex-col items-center justify-center w-[8vw] h-[8vw] rounded-full border border-blue-500/50 bg-bg-muted/80 backdrop-blur-md"
          initial={{ scale: 0, opacity: 0 }}
          animate={phase >= 1 ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          style={{ left: '10%', top: '50%', marginTop: '-4vw' }}
        >
          <Database className="w-[4vw] h-[4vw] text-accent" />
          {/* Pulse ring */}
          <motion.div 
            className="absolute inset-0 rounded-full border border-accent/40"
            animate={phase >= 5 ? { scale: [1, 2.5], opacity: [0.8, 0] } : { scale: 1, opacity: 0 }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        </motion.div>

        {/* Nodes relative to the center of the right container */}
        <NodeItem 
          title="Data Tender" 
          desc="LPSE Nasional, Kementerian & Swasta"
          icon={FileText}
          isVisible={phase >= 2}
          x="15vw"
          y="-20vh"
          color="#FBBF24"
        />
        
        <NodeItem 
          title="Sinyal Kompetitor" 
          desc="Pergerakan harga & riwayat menang"
          icon={Activity}
          isVisible={phase >= 3}
          x="20vw"
          y="0"
          color="#EF4444"
        />

        <NodeItem 
          title="Profil Kontraktor" 
          desc="Kapasitas sisa & kontak pengadaan"
          icon={Users}
          isVisible={phase >= 4}
          x="15vw"
          y="20vh"
          color="#10B981"
        />

        {/* Abstract animated connections instead of SVG lines to be responsive */}
        {phase >= 5 && (
          <>
            <motion.div 
              className="absolute h-[1px] bg-gradient-to-r from-accent to-transparent origin-left"
              style={{ width: '25vw', left: '14%', top: '50%', transform: 'rotate(-30deg)' }}
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 0.5 }}
            />
            <motion.div 
              className="absolute h-[1px] bg-gradient-to-r from-accent to-transparent origin-left"
              style={{ width: '28vw', left: '14%', top: '50%', transform: 'rotate(0deg)' }}
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 0.5 }}
            />
            <motion.div 
              className="absolute h-[1px] bg-gradient-to-r from-accent to-transparent origin-left"
              style={{ width: '25vw', left: '14%', top: '50%', transform: 'rotate(30deg)' }}
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 0.5 }}
            />
          </>
        )}

      </div>
    </motion.div>
  );
}
