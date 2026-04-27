/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, X } from 'lucide-react';

interface APIKeyOverlayProps {
  show: boolean;
  message: string;
  onClose: () => void;
  onSelectKey: () => void;
}

export default function APIKeyOverlay({ show, message, onClose, onSelectKey }: APIKeyOverlayProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6"
        >
          <div className="max-w-md w-full bg-neutral-900 border border-red-500/30 rounded-3xl p-8 text-center space-y-6 shadow-[0_0_50px_rgba(239,68,68,0.15)] relative">
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 text-white/40 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight text-white">Generation Failed</h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                {message}
              </p>
            </div>
            <div className="pt-4 space-y-3">
              <button 
                onClick={onSelectKey}
                className="w-full h-14 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-lg shadow-indigo-900/20"
              >
                Retry With Current Key
              </button>
              <p className="text-[11px] text-slate-500">
                Set <code>GEMINI_API_KEY</code> in <code>.env.local</code> or paste a key from the header key button.
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
