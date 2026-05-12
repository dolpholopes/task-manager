import React, { useState } from 'react';
import { X, Plus, Trash2, User, UserPlus } from 'lucide-react';
import { TeamMember } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface TeamManagerProps {
  members: TeamMember[];
  onAddMember: (name: string, color: string) => Promise<void>;
  onDeleteMember: (id: string) => Promise<void>;
  onClose: () => void;
}

const COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#64748b', // slate
  '#0ea5e9', // sky
  '#f43f5e', // rose
];

export function TeamManager({ members, onAddMember, onDeleteMember, onClose }: TeamManagerProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [isAdding, setIsAdding] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    setIsAdding(true);
    try {
      await onAddMember(name.trim(), color);
      setName('');
      setColor(COLORS[Math.floor(Math.random() * COLORS.length)]);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200"
      >
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-xl">
              <UserPlus className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-slate-800">Equipe</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-200 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-6">
          <form onSubmit={handleSubmit} className="mb-8 space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/60">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 ml-1">
                Novo Membro
              </label>
              <div className="flex gap-2">
                <input
                  autoFocus
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome do membro..."
                  className="flex-1 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 ml-1">
                Cor de Identificação
              </label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-full transition-all ${
                      color === c ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <button
              disabled={isAdding || !name.trim()}
              className="w-full py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary-dark disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Adicionar à Equipe
            </button>
          </form>

          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 ml-1">
              Membros Atuais ({members.length})
            </label>
            <AnimatePresence mode="popLayout">
              {members.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <User className="w-8 h-8 text-slate-300 mx-auto mb-2 opacity-50" />
                  <p className="text-sm text-slate-400">Nenhum membro cadastrado</p>
                </div>
              ) : (
                members.map((member) => (
                  <motion.div
                    key={member.id}
                    layoutTarget={member.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="flex justify-between items-center p-3 bg-white border border-slate-100 rounded-2xl hover:border-slate-200 hover:shadow-sm transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="px-2 h-8 rounded-full flex items-center justify-center text-white font-bold text-[10px] shadow-sm min-w-[32px]"
                        style={{ backgroundColor: member.color }}
                      >
                        {member.name.split(' ')[0]}
                      </div>
                      <span className="text-sm font-medium text-slate-700">{member.name}</span>
                    </div>
                    <button
                      onClick={() => onDeleteMember(member.id)}
                      className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
