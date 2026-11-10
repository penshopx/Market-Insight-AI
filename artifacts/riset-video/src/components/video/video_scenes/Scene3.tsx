import { motion } from 'framer-motion';
import { Bell, ArrowRight, Target, TrendingUp, Calendar } from 'lucide-react';
import { useEffect, useState } from 'react';

export function Scene3() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 2000), // Show notification
      setTimeout(() => setPhase(3), 3500), // Open dashboard
      setTimeout(() => setPhase(4), 5000), // Show items
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="w-full h-full flex items-center relative overflow-hidden px-[10vw]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1 }}
      transition={{ duration: 0.8 }}
    >
      {/* Background glow specific to this scene */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-bg-dark via-bg-dark to-accent/10 z-0 pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
      />

      {/* Content Container */}
      <div className="flex w-full h-full items-center justify-between z-10">
        
        {/* Left: Text */}
        <div className="w-[45%]">
          <motion.div
            initial={{ opacity: 0, y: '5vh' }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="inline-flex items-center gap-[0.5vw] px-[1vw] py-[0.5vh] rounded-full bg-accent/20 border border-accent/30 text-accent mb-[3vh]">
              <Bell className="w-[1.2vw] h-[1.2vw]" />
              <span className="font-medium text-[1vw]">Daily Briefing Ready</span>
            </div>
            <h2 className="text-[3.5vw] font-display font-bold text-white leading-tight mb-[2vh]">
              Setiap pukul 07:00,<br />
              <span className="text-gradient-blue">prospek matang</span><br />
              di tangan tim Sales Anda.
            </h2>
            <p className="text-[1.2vw] text-text-secondary w-4/5">
              Tidak perlu lagi mencari jarum di tumpukan jerami. Intel Konstruksi menyajikan target yang siap dieksekusi.
            </p>
          </motion.div>
        </div>

        {/* Right: UI Mockup */}
        <div className="w-[50%] relative h-[70vh] flex justify-center items-center">
          
          {/* Notification Pop */}
          <AnimateNotification phase={phase} />

          {/* Dashboard Window */}
          <motion.div
            className="absolute w-full h-[60vh] glass-panel rounded-2xl border border-white/10 shadow-2xl shadow-accent/20 overflow-hidden flex flex-col"
            initial={{ y: '20vh', opacity: 0, scale: 0.9 }}
            animate={phase >= 3 ? { y: 0, opacity: 1, scale: 1 } : { y: '20vh', opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 200, damping: 25 }}
          >
            {/* Header */}
            <div className="h-[8vh] border-b border-white/10 bg-white/5 flex items-center px-[2vw] justify-between">
              <div className="flex items-center gap-[1vw]">
                <Target className="text-primary w-[1.5vw] h-[1.5vw]" />
                <span className="font-display font-bold text-white text-[1.2vw]">Workroom: Prospek Hari Ini</span>
              </div>
              <div className="flex gap-[0.5vw]">
                <div className="w-[0.8vw] h-[0.8vw] rounded-full bg-red-500/80"></div>
                <div className="w-[0.8vw] h-[0.8vw] rounded-full bg-yellow-500/80"></div>
                <div className="w-[0.8vw] h-[0.8vw] rounded-full bg-green-500/80"></div>
              </div>
            </div>

            {/* List */}
            <div className="p-[2vw] flex flex-col gap-[2vh] flex-1 overflow-hidden">
              <ProspectCard 
                name="Pembangunan RSUD Tipe B" 
                value="Rp 120 M" 
                stage="Penetapan Pemenang" 
                delay={0.2}
                isVisible={phase >= 4}
              />
              <ProspectCard 
                name="Gedung Kampus Terpadu" 
                value="Rp 85 M" 
                stage="Evaluasi Dokumen" 
                delay={0.4}
                isVisible={phase >= 4}
              />
              <ProspectCard 
                name="Peningkatan Jalan Nasional" 
                value="Rp 45 M" 
                stage="Tender Ulang" 
                delay={0.6}
                isVisible={phase >= 4}
              />
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

function AnimateNotification({ phase }: { phase: number }) {
  return (
    <motion.div
      className="absolute top-0 right-[2vw] z-30 bg-bg-muted border border-accent/40 rounded-xl p-[1vw] flex items-center gap-[1vw] shadow-lg shadow-accent/20"
      initial={{ y: '-5vh', opacity: 0 }}
      animate={
        phase === 2 ? { y: 0, opacity: 1 } : 
        phase >= 3 ? { y: '-10vh', opacity: 0 } : 
        { y: '-5vh', opacity: 0 }
      }
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      <div className="w-[2.5vw] h-[2.5vw] rounded-full bg-accent/20 flex items-center justify-center text-accent">
        <Bell className="w-[1.2vw] h-[1.2vw]" />
      </div>
      <div>
        <h4 className="text-[1vw] font-bold text-white">Intel Konstruksi</h4>
        <p className="text-[0.8vw] text-text-secondary">3 Prospek High-Value Ditemukan</p>
      </div>
    </motion.div>
  );
}

function ProspectCard({ name, value, stage, delay, isVisible }: any) {
  return (
    <motion.div
      className="bg-white/5 border border-white/5 rounded-xl p-[1.5vw] flex items-center justify-between hover:bg-white/10 transition-colors"
      initial={{ opacity: 0, x: '5vw' }}
      animate={isVisible ? { opacity: 1, x: 0 } : { opacity: 0, x: '5vw' }}
      transition={{ type: "spring", stiffness: 200, damping: 20, delay }}
    >
      <div className="flex flex-col gap-[0.5vh]">
        <h3 className="text-[1.2vw] font-bold text-white">{name}</h3>
        <div className="flex items-center gap-[1vw] text-[0.9vw] text-text-muted">
          <span className="flex items-center gap-[0.3vw]"><TrendingUp className="w-[1vw] h-[1vw]"/> {value}</span>
          <span>•</span>
          <span className="flex items-center gap-[0.3vw]"><Calendar className="w-[1vw] h-[1vw]"/> {stage}</span>
        </div>
      </div>
      <div className="w-[2.5vw] h-[2.5vw] rounded-full bg-white/10 flex items-center justify-center">
        <ArrowRight className="text-white w-[1.2vw] h-[1.2vw]" />
      </div>
    </motion.div>
  );
}
