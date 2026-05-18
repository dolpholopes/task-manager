import React from 'react';
import { StickyNote } from '../types';
import { StickyNoteItem } from './StickyNoteItem';
import { Plus, Search, Filter, SortAsc, LayoutGrid, LayoutList } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface StickyNoteBoardProps {
  notes: StickyNote[];
  search: string;
  filter: string | null;
  onUpdate: (id: string, data: Partial<StickyNote>) => void;
  onDelete: (id: string) => void;
  canWrite: boolean;
}

export function StickyNoteBoard({ notes, search, filter, onUpdate, onDelete, canWrite }: StickyNoteBoardProps) {
  const filteredNotes = notes
    .filter(note => {
      const matchesSearch = note.content.toLowerCase().includes(search.toLowerCase());
      const matchesFilter = !filter || note.color === filter;
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="flex flex-col h-full">
      {/* Grid Container */}
      <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
        {filteredNotes.length === 0 ? (
          <div className="h-[60vh] flex flex-col items-center justify-center text-center px-4">
            <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6">
              <LayoutGrid className="w-10 h-10 text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Nenhuma anotação encontrada</h3>
            <p className="text-slate-500 max-w-sm">
              {search || filter 
                ? "Tente ajustar seus filtros para encontrar o que procura." 
                : "Crie sua primeira nota para começar a organizar sua área de trabalho."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            <AnimatePresence mode="popLayout">
              {filteredNotes.map((note) => (
                <StickyNoteItem
                  key={note.id}
                  note={note}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                  canWrite={canWrite}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
