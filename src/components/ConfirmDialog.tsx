import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '../lib/utils';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'warning' | 'info';
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
  variant = 'danger'
}: ConfirmDialogProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
          onClick={onCancel}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-md w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className={cn(
                  "p-3 rounded-xl flex-shrink-0",
                  variant === 'danger' ? "bg-red-100 text-red-600" :
                  variant === 'warning' ? "bg-orange-100 text-orange-600" :
                  "bg-slate-100 text-slate-600"
                )}>
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-bold text-slate-900">{title}</h3>
                    <button 
                      onClick={onCancel}
                      className="text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    {message}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-slate-50 p-4 flex items-center justify-end gap-3">
              <button
                onClick={onCancel}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
              >
                {cancelLabel}
              </button>
              <button
                onClick={() => {
                  onConfirm();
                  onCancel();
                }}
                className={cn(
                  "px-6 py-2 text-sm font-bold text-white rounded-xl transition-all shadow-sm active:scale-95",
                  variant === 'danger' ? "bg-red-600 hover:bg-red-700 shadow-red-100" :
                  variant === 'warning' ? "bg-orange-600 hover:bg-orange-700 shadow-orange-100" :
                  "bg-primary hover:bg-primary-dark shadow-primary/10"
                )}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
