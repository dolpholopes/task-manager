import React from 'react';
import { StickyNote } from '../types';
import { Trash2, Trash, Bell, Calendar, Clock, Check, X, Palette, Maximize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface StickyNoteItemProps {
  note: StickyNote;
  onUpdate: (id: string, data: Partial<StickyNote>) => void;
  onDelete: (id: string) => void;
  canWrite: boolean;
}

const colors = [
  { name: 'Amarelo', bg: 'bg-[#fef3c7]', border: 'border-[#fde68a]', text: 'text-amber-900', hover: 'hover:bg-[#fde68a]' },
  { name: 'Azul', bg: 'bg-[#dbeafe]', border: 'border-[#bfdbfe]', text: 'text-blue-900', hover: 'hover:bg-[#bfdbfe]' },
  { name: 'Verde', bg: 'bg-[#dcfce7]', border: 'border-[#bbf7d0]', text: 'text-emerald-900', hover: 'hover:bg-[#bbf7d0]' },
  { name: 'Rosa', bg: 'bg-[#fce7f3]', border: 'border-[#fbcfe8]', text: 'text-pink-900', hover: 'hover:bg-[#fbcfe8]' },
  { name: 'Roxo', bg: 'bg-[#f3e8ff]', border: 'border-[#e9d5ff]', text: 'text-purple-900', hover: 'hover:bg-[#e9d5ff]' },
  { name: 'Laranja', bg: 'bg-[#ffedd5]', border: 'border-[#fed7aa]', text: 'text-orange-900', hover: 'hover:bg-[#fed7aa]' },
];

export const StickyNoteItem: React.FC<StickyNoteItemProps> = ({ note, onUpdate, onDelete, canWrite }) => {
  const [isEditing, setIsEditing] = React.useState(false);
  const [content, setContent] = React.useState(note.content);
  const [showColorPicker, setShowColorPicker] = React.useState(false);
  const [showReminderPicker, setShowReminderPicker] = React.useState(false);
  const [showCalendarPicker, setShowCalendarPicker] = React.useState(false);
  const [reminderDate, setReminderDate] = React.useState(note.reminderDate || '');
  const [reminderTime, setReminderTime] = React.useState(note.reminderTime || '');
  const [calendarDate, setCalendarDate] = React.useState(note.calendarDate || format(new Date(note.createdAt), 'yyyy-MM-dd'));
  
  // Size constraints
  const minSize = 200;
  const maxSize = 600;

  const [size, setSize] = React.useState({ 
    width: note.width || minSize, 
    height: note.height || minSize 
  });

  const isResizing = React.useRef(false);
  const startPos = React.useRef({ x: 0, y: 0 });
  const startSize = React.useRef({ width: 0, height: 0 });

  React.useEffect(() => {
    setSize({ 
      width: note.width || minSize, 
      height: note.height || minSize 
    });
  }, [note.width, note.height]);

  const currentColor = colors.find(c => c.bg === note.color) || colors[0];

  const handleSave = () => {
    if (content.trim() !== note.content) {
      onUpdate(note.id, { content: content.trim(), workspaceId: note.workspaceId });
    }
    setIsEditing(false);
  };

  const handleToggleReminder = () => {
    if (note.reminderDate) {
      onUpdate(note.id, { reminderDate: undefined, reminderTime: undefined, reminderSent: false, workspaceId: note.workspaceId });
    } else {
      setShowReminderPicker(true);
    }
  };

  const saveReminder = () => {
    if (reminderDate && reminderTime) {
      onUpdate(note.id, { reminderDate, reminderTime, reminderSent: false, workspaceId: note.workspaceId });
      setShowReminderPicker(false);
    }
  };

  const startResize = (e: React.MouseEvent) => {
    if (!canWrite) return;
    e.preventDefault();
    e.stopPropagation();
    isResizing.current = true;
    startPos.current = { x: e.clientX, y: e.clientY };
    startSize.current = { width: size.width, height: size.height };

    document.addEventListener('mousemove', handleResize);
    document.addEventListener('mouseup', stopResize);
  };

  const handleResize = (e: MouseEvent) => {
    if (!isResizing.current) return;

    const deltaX = e.clientX - startPos.current.x;
    const deltaY = e.clientY - startPos.current.y;

    const newWidth = Math.max(minSize, Math.min(maxSize, startSize.current.width + deltaX));
    const newHeight = Math.max(minSize, Math.min(maxSize, startSize.current.height + deltaY));

    setSize({ width: newWidth, height: newHeight });
  };

  const stopResize = () => {
    if (!isResizing.current) return;
    isResizing.current = false;
    document.removeEventListener('mousemove', handleResize);
    document.removeEventListener('mouseup', stopResize);
    
    // Final persistence
    onUpdate(note.id, { width: size.width, height: size.height, workspaceId: note.workspaceId });
  };

  return (
    <motion.div
      layout
      style={{ width: size.width, height: size.height }}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={cn(
        "group relative p-5 shadow-lg border-b-4 transition-all hover:shadow-xl flex flex-col",
        currentColor.bg,
        currentColor.border,
        currentColor.text
      )}
    >
      <div className="flex flex-col h-full overflow-hidden">
        {/* Header Tools */}
        <div className="flex justify-between items-center mb-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <div className="flex items-center gap-1">
            {canWrite && (
              <>
                <button
                  onClick={() => setShowColorPicker(!showColorPicker)}
                  className="p-1 hover:bg-black/5 rounded-md transition-colors"
                  title="Trocar cor"
                >
                  <Palette className="w-4 h-4" />
                </button>
                <button
                  onClick={handleToggleReminder}
                  className={cn(
                    "p-1 hover:bg-black/5 rounded-md transition-colors",
                    note.reminderDate ? "bg-black/5" : ""
                  )}
                  title="Definir lembrete"
                >
                  <Bell className={cn("w-4 h-4", note.reminderDate && "fill-current")} />
                </button>
                <button
                  onClick={() => setShowCalendarPicker(true)}
                  className={cn(
                    "p-1 hover:bg-black/5 rounded-md transition-colors",
                    note.calendarDate ? "bg-black/5" : ""
                  )}
                  title="Data no Calendário"
                >
                  <Calendar className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
          {canWrite && (
            <button
              onClick={() => onDelete(note.id)}
              className="p-1 text-red-600 hover:bg-red-50 rounded-md transition-colors"
            >
              <Trash className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Content */}
        {isEditing && canWrite ? (
          <textarea
            autoFocus
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onBlur={handleSave}
            className="flex-1 w-full bg-transparent resize-none border-none focus:ring-0 font-medium text-sm leading-relaxed scrollbar-hide"
            placeholder="Escreva algo..."
          />
        ) : (
          <div
            onClick={() => canWrite && setIsEditing(true)}
            className="flex-1 w-full whitespace-pre-wrap font-medium text-sm leading-relaxed overflow-y-auto scrollbar-hide select-none cursor-text"
          >
            {note.content || <span className="opacity-40 italic">Vazio...</span>}
          </div>
        )}

        {/* Footer */}
        <div className="mt-4 flex items-center justify-between flex-shrink-0">
          <div className="flex flex-col">
            <div className="text-[10px] font-bold opacity-30 uppercase tracking-widest">
              Criada: {format(note.createdAt, "dd MMM", { locale: ptBR })}
            </div>
            {note.calendarDate && (
              <div className="text-[10px] font-bold opacity-60 uppercase tracking-widest flex items-center gap-1">
                <Calendar className="w-2.5 h-2.5" />
                {format(new Date(note.calendarDate + 'T00:00:00'), "dd MMM", { locale: ptBR })}
              </div>
            )}
          </div>
          {note.reminderDate && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-black/5 rounded-full text-[10px] font-bold">
              <Clock className="w-3 h-3" />
              <span>
                {format(new Date(note.reminderDate + 'T' + note.reminderTime), "HH:mm")}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Resize Handle */}
      {canWrite && (
        <div
          onMouseDown={startResize}
          className="absolute bottom-0 right-0 p-1 cursor-nwse-resize opacity-0 group-hover:opacity-40 hover:opacity-100 transition-opacity"
        >
          <Maximize2 className="w-4 h-4 rotate-90" />
        </div>
      )}

      {/* Color Picker Overlay */}
      <AnimatePresence>
        {showColorPicker && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute inset-0 bg-white/40 backdrop-blur-sm z-30 flex items-center justify-center p-4 rounded-lg"
          >
            <div className="bg-white p-4 rounded-2xl shadow-2xl border border-slate-100 flex flex-wrap gap-3 justify-center max-w-[140px] relative">
              <button 
                onClick={() => setShowColorPicker(false)}
                className="absolute -top-2 -right-2 w-6 h-6 bg-white rounded-full shadow-md border border-slate-100 flex items-center justify-center hover:bg-slate-50 transition-colors"
              >
                <X className="w-3 h-3 text-slate-500" />
              </button>
              {colors.map((c) => (
                <button
                  key={c.bg}
                  onClick={() => {
                    onUpdate(note.id, { color: c.bg, workspaceId: note.workspaceId });
                    setShowColorPicker(false);
                  }}
                  className={cn(
                    "w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 shadow-sm",
                    c.bg,
                    note.color === c.bg ? "border-slate-800" : "border-transparent"
                  )}
                  title={c.name}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Calendar Picker Overlay */}
      <AnimatePresence>
        {showCalendarPicker && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute inset-0 bg-white/95 backdrop-blur-sm z-20 p-5 rounded-lg flex flex-col items-center justify-center text-slate-800"
          >
            <Calendar className="w-8 h-8 mb-4 text-primary" />
            <h3 className="text-sm font-bold mb-4">Data no Calendário</h3>
            
            <div className="w-full space-y-3 mb-6">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Data</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="date"
                    value={calendarDate}
                    onChange={(e) => setCalendarDate(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 w-full">
              <button
                onClick={() => setShowCalendarPicker(false)}
                className="flex-1 px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                disabled={!calendarDate}
                onClick={() => {
                  onUpdate(note.id, { calendarDate, workspaceId: note.workspaceId });
                  setShowCalendarPicker(false);
                }}
                className="flex-1 px-4 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-dark transition-colors disabled:opacity-50"
              >
                Salvar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reminder Picker Overlay */}
      <AnimatePresence>
        {showReminderPicker && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute inset-0 bg-white/95 backdrop-blur-sm z-20 p-5 rounded-lg flex flex-col items-center justify-center text-slate-800"
          >
            <Bell className="w-8 h-8 mb-4 text-primary" />
            <h3 className="text-sm font-bold mb-4">Novo Lembrete</h3>
            
            <div className="w-full space-y-3 mb-6">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Data</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="date"
                    value={reminderDate}
                    onChange={(e) => setReminderDate(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
              
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Hora</label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="time"
                    value={reminderTime}
                    onChange={(e) => setReminderTime(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 w-full">
              <button
                onClick={() => setShowReminderPicker(false)}
                className="flex-1 px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                disabled={!reminderDate || !reminderTime}
                onClick={saveReminder}
                className="flex-1 px-4 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-dark transition-colors disabled:opacity-50"
              >
                Salvar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
