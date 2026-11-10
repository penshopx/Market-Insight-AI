import { motion } from 'framer-motion';

export function Scene0() {
  return (
    <motion.div 
      className="w-full h-full flex flex-col justify-center items-center relative overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
      transition={{ duration: 1 }}
    >
      {/* Background Map for Hook */}
      <motion.div
        className="absolute inset-0 opacity-40 z-0"
        style={{
          backgroundImage: `url(${import.meta.env.BASE_URL}images/indo-map.png)`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundBlendMode: 'screen'
        }}
        initial={{ scale: 1.2, opacity: 0 }}
        animate={{ scale: 1, opacity: 0.5 }}
        transition={{ duration: 6, ease: "easeOut" }}
      />
      
      <div className="z-10 text-center max-w-[80vw] px-[4vw] relative">
        <motion.div
          className="overflow-hidden mb-[3vh]"
          initial={{ clipPath: "inset(0 100% 0 0)" }}
          animate={{ clipPath: "inset(0 0% 0 0)" }}
          transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1], delay: 0.5 }}
        >
          <h1 className="text-[4vw] font-display font-bold text-white tracking-tight leading-tight">
            Pagi hari di industri konstruksi...
          </h1>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: '5vh' }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 2.5, ease: "easeOut" }}
        >
          <p className="text-[2.5vw] font-display font-semibold text-gradient mt-[2vh]">
            Kompetitor sudah bergerak. Anda?
          </p>
        </motion.div>
        
        {/* Decorative line */}
        <motion.div 
          className="h-[0.5vh] bg-accent mx-auto mt-[6vh] rounded-full"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: "10vw", opacity: 1 }}
          transition={{ duration: 1, delay: 3.5, ease: "easeOut" }}
        />
      </div>
      
      {/* Abstract floating elements in foreground */}
      <motion.div 
        className="absolute bottom-[10vh] left-[10vw] w-[8vw] h-[8vw] border border-blue-500/30 rounded-full"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 1.5, 2], opacity: [0, 0.5, 0] }}
        transition={{ duration: 3, delay: 1, repeat: Infinity, repeatDelay: 1 }}
      />
      
      <motion.div 
        className="absolute top-[15vh] right-[15vw] w-[6vw] h-[6vw] border border-amber-500/30 rounded-full"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 1.5, 2], opacity: [0, 0.5, 0] }}
        transition={{ duration: 3, delay: 2.5, repeat: Infinity, repeatDelay: 0.5 }}
      />
    </motion.div>
  );
}
