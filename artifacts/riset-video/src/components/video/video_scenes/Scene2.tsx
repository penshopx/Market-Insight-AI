import { motion } from 'framer-motion';
import { Cpu, CheckCircle2 } from 'lucide-react';
import { useEffect, useState } from 'react';

export function Scene2() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 2000), // Start scanning
      setTimeout(() => setPhase(3), 3500), // Insight 1
      setTimeout(() => setPhase(4), 4500), // Insight 2
      setTimeout(() => setPhase(5), 5500), // Insight 3
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  const dummyCode = [
    "ANALYZING tender_data_lpse.json...",
    "EXTRACTING contractor_history...",
    "MATCHING material_requirements: 'SEMEN_PORTLAND', 'BESI_BETON'",
    "CALCULATING win_probability_index...",
    "IDENTIFYING underpriced_bids: DETECTED",
    "CROSS_REFERENCING competitor_signals...",
    "GENERATING prospect_score: 94% (HIGH)"
  ];

  return (
    <motion.div 
      className="w-full h-full flex flex-col justify-center items-center relative overflow-hidden"
      initial={{ opacity: 0, scale: 1.1 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, y: '-10vh' }}
      transition={{ duration: 1, ease: "easeOut" }}
    >
      <div className="text-center z-20 mb-[5vh]">
        <motion.div
          initial={{ opacity: 0, y: '5vh' }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="flex justify-center items-center gap-3 mb-[2vh] text-primary">
            <Cpu className="w-[2.5vw] h-[2.5vw]" />
            <span className="font-mono font-bold tracking-widest text-[1.2vw] uppercase">KECERDASAN BUATAN</span>
          </div>
          <h2 className="text-[3.5vw] font-display font-bold text-white leading-tight">
            Menganalisis <span className="text-gradient">ribuan data</span><br />
            dalam hitungan detik.
          </h2>
        </motion.div>
      </div>

      <div className="w-[70vw] h-[40vh] relative z-10 flex">
        {/* Terminal / Code Window */}
        <motion.div 
          className="w-1/2 h-full glass-panel rounded-l-2xl border-r-0 p-[2vw] relative overflow-hidden font-mono text-[0.9vw] text-text-secondary leading-relaxed"
          initial={{ x: '-5vw', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.5 }}
        >
          {dummyCode.map((line, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0 }}
              animate={phase >= 2 ? { opacity: [0, 1, 0.5] } : { opacity: 0 }}
              transition={{ duration: 0.5, delay: i * 0.4 + 1 }}
              className="mb-[1vh] truncate"
            >
              <span className="text-accent mr-2">&gt;</span> {line}
            </motion.div>
          ))}
          
          {/* Scanning Line */}
          {phase >= 2 && (
            <motion.div 
              className="absolute left-0 right-0 h-[2px] bg-primary/80 shadow-[0_0_15px_3px_rgba(251,191,36,0.5)] z-20"
              initial={{ top: '0%' }}
              animate={{ top: '100%' }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            />
          )}
        </motion.div>

        {/* Insights Panel */}
        <motion.div 
          className="w-1/2 h-full glass-panel rounded-r-2xl border-l border-white/10 p-[2vw] flex flex-col justify-center gap-[2vh]"
          initial={{ x: '5vw', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.7 }}
        >
          <InsightCard 
            title="Prediksi Pemenang" 
            value="PT. Adhi Karya (Persero)" 
            delay={0} 
            isVisible={phase >= 3} 
          />
          <InsightCard 
            title="Estimasi Harga Proyek" 
            value="Rp 45.2 Miliar" 
            delay={0} 
            isVisible={phase >= 4} 
            highlight
          />
          <InsightCard 
            title="Kebutuhan Material Utama" 
            value="Beton K-350, Baja Tulangan" 
            delay={0} 
            isVisible={phase >= 5} 
          />
        </motion.div>
      </div>

    </motion.div>
  );
}

function InsightCard({ title, value, isVisible, highlight = false }: any) {
  return (
    <motion.div
      className={`p-[1.5vw] rounded-xl border ${highlight ? 'border-primary/50 bg-primary/10' : 'border-white/5 bg-white/5'}`}
      initial={{ opacity: 0, x: '2vw', scale: 0.9 }}
      animate={isVisible ? { opacity: 1, x: 0, scale: 1 } : { opacity: 0, x: '2vw', scale: 0.9 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
    >
      <div className="flex items-center gap-[1vw] mb-[0.5vh]">
        <CheckCircle2 className={`w-[1.2vw] h-[1.2vw] ${highlight ? 'text-primary' : 'text-accent'}`} />
        <span className="text-[1vw] text-text-secondary font-medium">{title}</span>
      </div>
      <div className={`text-[1.5vw] font-display font-bold ${highlight ? 'text-primary' : 'text-white'} pl-[2.2vw]`}>
        {value}
      </div>
    </motion.div>
  );
}
