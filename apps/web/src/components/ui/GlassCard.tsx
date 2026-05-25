"use client";

import { motion } from "framer-motion";
import { clsx } from "clsx";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
  delay?: number;
}

export function GlassCard({ children, className, glow, delay = 0 }: GlassCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className={clsx(
        "glass rounded-2xl p-5",
        glow && "shadow-[0_0_40px_rgba(99,102,241,0.12)]",
        className
      )}
    >
      {children}
    </motion.div>
  );
}
