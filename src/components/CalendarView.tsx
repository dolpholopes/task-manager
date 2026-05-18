import React from 'react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths,
  isToday,
  parseISO
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, Tag, MessageSquare, ClipboardList } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { Task, StickyNote } from '../types';

interface CalendarViewProps {
  tasks: Task[];
  notes: StickyNote[];
}

export function CalendarView({ tasks, notes }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = React.useState(new Date());
  const [selectedDate, setSelectedDate] = React.useState<Date | null>(null);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const getDayItems = (day: Date) => {
    if (!day) return { tasks: [], notes: [] };

    const dayTasks = tasks.filter(task => {
      if (!task.dueDate) return false;
      try {
        return isSameDay(parseISO(task.dueDate), day);
      } catch (e) {
        return false;
      }
    });

    const dayNotes = notes.filter(note => {
      // Prioridade 1: Data de Lembrete
      if (note.reminderDate) {
        try {
          return isSameDay(parseISO(note.reminderDate), day);
        } catch (e) { return false; }
      }

      // Prioridade 2: Data no Calendário (que agora é a data de criação por padrão)
      if (note.calendarDate) {
        try {
          return isSameDay(parseISO(note.calendarDate), day);
        } catch (e) { /* continua para o fallback */ }
      }

      // Fallback para legado: Timestamp de criação original
      return isSameDay(new Date(note.createdAt), day);
    });

    return { tasks: dayTasks, notes: dayNotes };
  };

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  const selectedDayItems = selectedDate ? getDayItems(selectedDate) : { tasks: [], notes: [] };

  return (
    <div className="flex flex-col h-full bg-white/40 backdrop-blur-sm rounded-3xl border border-slate-100/50 overflow-hidden">
      {/* Header */}
      <div className="p-6 flex items-center justify-between border-b border-slate-100 flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-primary/10 rounded-2xl text-primary">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-slate-800 tracking-tight capitalize">
              {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Visualização Mensal
              </p>
              <span className="w-1 h-1 rounded-full bg-slate-300" />
              <p className="text-[10px] font-bold text-primary uppercase tracking-widest">
                {tasks.length + notes.length} Itens Total
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-2xl">
          <button
            onClick={prevMonth}
            className="p-2 hover:bg-white rounded-xl transition-all hover:shadow-sm text-slate-500 hover:text-slate-800"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 transition-colors"
          >
            Hoje
          </button>
          <button
            onClick={nextMonth}
            className="p-2 hover:bg-white rounded-xl transition-all hover:shadow-sm text-slate-500 hover:text-slate-800"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Week Days Header */}
      <div className="grid grid-cols-7 border-b border-slate-50 bg-slate-50/50 flex-shrink-0">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => (
          <div key={day} className="py-3 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="grid grid-cols-7 h-full min-h-[500px]">
          {calendarDays.map((day, i) => {
            const { tasks: dayTasks, notes: dayNotes } = getDayItems(day);
            const hasItems = dayTasks.length > 0 || dayNotes.length > 0;
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const isCurrentMonth = isSameMonth(day, monthStart);

            return (
              <div
                key={day.toString()}
                onClick={() => setSelectedDate(day)}
                className={cn(
                  "min-h-[100px] p-2 border-r border-b border-slate-50 transition-all cursor-pointer relative group",
                  !isCurrentMonth && "bg-slate-50/20",
                  isSelected ? "bg-primary/5 ring-1 ring-inset ring-primary/20" : "hover:bg-white/60"
                )}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={cn(
                    "text-xs font-bold w-6 h-6 flex items-center justify-center rounded-lg transition-colors",
                    isToday(day) ? "bg-primary text-white shadow-lg shadow-primary/30" : 
                    isCurrentMonth ? "text-slate-600" : "text-slate-300"
                  )}>
                    {format(day, 'd')}
                  </span>
                  {hasItems && (
                    <div className="flex gap-0.5">
                      <div className="w-1 h-1 rounded-full bg-primary" />
                      {dayNotes.length > 0 && <div className="w-1 h-1 rounded-full bg-amber-400" />}
                    </div>
                  )}
                </div>

                <div className="space-y-1 overflow-hidden">
                  {dayTasks.slice(0, 2).map(task => (
                    <div 
                      key={task.id}
                      className="text-[10px] px-1.5 py-0.5 bg-white border border-slate-100 rounded-md text-slate-600 truncate shadow-sm font-medium"
                    >
                      {task.title}
                    </div>
                  ))}
                  {dayNotes.slice(0, 1).map(note => (
                    <div 
                      key={note.id}
                      className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded-md text-slate-800 truncate border shadow-sm font-medium",
                        note.color || 'bg-amber-100'
                      )}
                    >
                      {note.content || 'Anotação'}
                    </div>
                  ))}
                  {(dayTasks.length + dayNotes.length) > 3 && (
                    <div className="text-[9px] font-bold text-slate-400 pl-1">
                      +{(dayTasks.length + dayNotes.length) - 3} mais
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Day Details Modal Overlay */}
      <AnimatePresence>
        {selectedDate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedDate(null)}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              {/* Modal Header */}
              <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-800 tracking-tight">
                    {format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
                  </h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                    Resumo do Dia
                  </p>
                </div>
                <button
                  onClick={() => setSelectedDate(null)}
                  className="p-2 hover:bg-white rounded-xl transition-colors text-slate-400 hover:text-slate-600 shadow-sm border border-transparent hover:border-slate-200"
                >
                  <ChevronRight className="w-5 h-5 rotate-90" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
                {/* Tasks Section */}
                <section>
                  <div className="flex items-center gap-2 mb-4 opacity-50">
                    <ClipboardList className="w-4 h-4 text-primary" />
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-800">
                      Tarefas ({selectedDayItems.tasks.length})
                    </h4>
                  </div>
                  <div className="space-y-2">
                    {selectedDayItems.tasks.length === 0 ? (
                      <p className="text-xs text-slate-400 italic bg-slate-50/50 p-4 rounded-2xl border border-dashed border-slate-200 text-center">
                        Nenhuma tarefa para este dia.
                      </p>
                    ) : (
                      selectedDayItems.tasks.map(task => (
                        <div key={task.id} className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow group">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-bold text-slate-800">{task.title}</span>
                            {task.priority && (
                              <span className={cn(
                                "text-[8px] font-black uppercase px-2 py-0.5 rounded-full",
                                task.priority === 'high' ? "bg-red-100 text-red-600" :
                                task.priority === 'medium' ? "bg-amber-100 text-amber-600" :
                                "bg-emerald-100 text-emerald-600"
                              )}>
                                {task.priority}
                              </span>
                            )}
                          </div>
                          {task.description && (
                            <p className="text-xs text-slate-500 line-clamp-2">{task.description}</p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </section>

                {/* Notes Section */}
                <section>
                  <div className="flex items-center gap-2 mb-4 opacity-50">
                    <MessageSquare className="w-4 h-4 text-amber-500" />
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-800">
                      Anotações ({selectedDayItems.notes.length})
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedDayItems.notes.length === 0 ? (
                      <div className="col-span-full text-xs text-slate-400 italic bg-slate-50/50 p-4 rounded-2xl border border-dashed border-slate-200 text-center">
                        Nenhuma anotação com lembrete hoje.
                      </div>
                    ) : (
                      selectedDayItems.notes.map(note => (
                        <div 
                          key={note.id} 
                          className={cn(
                            "p-4 rounded-2xl shadow-sm border-b-2 flex flex-col gap-2 transition-transform hover:scale-[1.02]",
                            note.color || 'bg-amber-100 border-amber-200'
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <Clock className="w-3 h-3 opacity-40" />
                            <span className="text-[10px] font-bold opacity-40">{note.reminderTime}</span>
                          </div>
                          <p className="text-xs font-medium text-slate-800 line-clamp-3">
                            {note.content || 'Sem conteúdo'}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </div>

              {/* Modal Footer */}
              <div className="p-6 bg-slate-50 border-t border-slate-100">
                <button
                  onClick={() => setSelectedDate(null)}
                  className="w-full py-3 bg-slate-800 text-white rounded-2xl font-bold text-sm shadow-lg shadow-slate-200 active:scale-95 transition-all"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
