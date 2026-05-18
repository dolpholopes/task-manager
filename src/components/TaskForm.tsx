import React, { useState, useEffect } from 'react';
import { Plus, Calendar as CalendarIcon, X, AlertCircle, Bell, Clock, Folder, Tag, User, ListChecks, CheckSquare, Square, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { Priority, Reminder, Task, Card, Label, TeamMember, ChecklistItem } from '../types';

interface TaskFormProps {
  onAdd: (task: Omit<Task, 'id' | 'createdAt' | 'completed' | 'reminderSent' | 'workspaceId' | 'order'>) => void;
  onCancel?: () => void;
  initialData?: Task;
  isEditing?: boolean;
  cards: Card[];
  defaultCardId?: string;
  labels?: Label[];
  teamMembers?: TeamMember[];
}

export function TaskForm({ onAdd, onCancel, initialData, isEditing = false, cards, defaultCardId, labels = [], teamMembers = [] }: TaskFormProps) {
  const [isOpen, setIsOpen] = useState(isEditing);
  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [dueDate, setDueDate] = useState(initialData?.dueDate || '');
  const [dueTime, setDueTime] = useState(initialData?.dueTime || '');
  const [priority, setPriority] = useState<Priority>(initialData?.priority || 'medium');
  const [reminder, setReminder] = useState<Reminder>(initialData?.reminder || 'none');
  const [cardId, setCardId] = useState(initialData?.cardId || defaultCardId || cards[0]?.id || '');
  const [labelId, setLabelId] = useState(initialData?.labelId || '');
  const [assigneeId, setAssigneeId] = useState(initialData?.assigneeId || '');
  
  const [checklist, setChecklist] = useState<ChecklistItem[]>(initialData?.checklist || []);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [showChecklist, setShowChecklist] = useState((initialData?.checklist?.length || 0) > 0);

  useEffect(() => {
    if (isEditing) {
      setIsOpen(true);
    }
  }, [isEditing]);

  // Update cardId if defaultCardId changes and we are not editing
  useEffect(() => {
    if (!isEditing && defaultCardId) {
      setCardId(defaultCardId);
    }
  }, [defaultCardId, isEditing]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    
    onAdd({
      title,
      description,
      dueDate,
      dueTime,
      priority,
      reminder,
      cardId,
      labelId: labelId || undefined,
      assigneeId: assigneeId || undefined,
      checklist: checklist.length > 0 ? checklist : undefined,
    });

    if (!isEditing) {
      setTitle('');
      setDescription('');
      setDueDate('');
      setDueTime('');
      setPriority('medium');
      setReminder('none');
      setLabelId('');
      setAssigneeId('');
      setCardId(defaultCardId || cards[0]?.id || '');
      setChecklist([]);
      setShowChecklist(false);
      setIsOpen(false);
    }
  };

  const addChecklistItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChecklistItem.trim()) return;

    setChecklist([
      ...checklist,
      {
        id: crypto.randomUUID(),
        text: newChecklistItem.trim(),
        completed: false
      }
    ]);
    setNewChecklistItem('');
  };

  const toggleChecklistItem = (id: string) => {
    setChecklist(checklist.map(item => 
      item.id === id ? { ...item, completed: !item.completed } : item
    ));
  };

  const removeChecklistItem = (id: string) => {
    setChecklist(checklist.filter(item => item.id !== id));
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      setIsOpen(false);
    }
  };

  if (!isOpen && !isEditing) {
    return (
      <div className="mb-8">
        <motion.button
          layoutId="task-form"
          onClick={() => setIsOpen(true)}
          className="w-full bg-white border-2 border-dashed border-slate-200 rounded-xl p-4 flex items-center justify-center gap-2 text-slate-500 hover:border-primary hover:text-primary hover:bg-primary-light transition-all group"
        >
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-primary-light transition-colors">
            <Plus className="w-5 h-5" />
          </div>
          <span className="font-medium">Adicionar Nova Tarefa</span>
        </motion.button>
      </div>
    );
  }

  return (
    <div className={cn("mb-8", isEditing && "mb-0")}>
      <motion.form
        layoutId={isEditing ? undefined : "task-form"}
        onSubmit={handleSubmit}
        className={cn(
          "bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden",
          isEditing && "shadow-none border-0"
        )}
      >
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-slate-900">
              {isEditing ? 'Editar Tarefa' : 'Nova Tarefa'}
            </h3>
            {!isEditing && (
              <button
                type="button"
                onClick={handleCancel}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          <input
            type="text"
            placeholder="O que precisa ser feito?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full text-lg font-medium placeholder:text-slate-300 border-none focus:ring-0 p-0"
            autoFocus={!isEditing}
          />

          <textarea
            placeholder="Adicionar descrição (opcional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full text-sm text-slate-600 placeholder:text-slate-300 border-none focus:ring-0 p-0 resize-none min-h-[60px]"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
            {/* Checklist Section Toggle */}
            <div className="col-span-1 sm:col-span-2">
              <button
                type="button"
                onClick={() => setShowChecklist(!showChecklist)}
                className={cn(
                  "flex items-center gap-2 text-xs font-bold uppercase tracking-wider transition-colors",
                  showChecklist ? "text-primary" : "text-slate-400 hover:text-slate-600"
                )}
              >
                <ListChecks className="w-4 h-4" />
                <span>{showChecklist ? "Ocultar Checklist" : "Adicionar Checklist"}</span>
              </button>

              <AnimatePresence>
                {showChecklist && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden mt-4 space-y-3"
                  >
                    <div className="space-y-2">
                      {checklist.map(item => (
                        <div key={item.id} className="flex items-center gap-3 group">
                          <button
                            type="button"
                            onClick={() => toggleChecklistItem(item.id)}
                            className={cn(
                              "flex-shrink-0 transition-colors",
                              item.completed ? "text-emerald-500" : "text-slate-300 hover:text-slate-400"
                            )}
                          >
                            {item.completed ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                          </button>
                          <span className={cn(
                            "flex-1 text-sm transition-all",
                            item.completed ? "text-slate-400 line-through" : "text-slate-600"
                          )}>
                            {item.text}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeChecklistItem(item.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-red-500 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Novo item do checklist..."
                        value={newChecklistItem}
                        onChange={(e) => setNewChecklistItem(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addChecklistItem(e);
                          }
                        }}
                        className="flex-1 text-sm bg-slate-50 border-none rounded-lg px-3 py-2 text-slate-600 placeholder:text-slate-300 focus:ring-1 focus:ring-primary"
                      />
                      <button
                        type="button"
                        onClick={addChecklistItem}
                        disabled={!newChecklistItem.trim()}
                        className="p-2 bg-slate-100 text-slate-400 rounded-lg hover:bg-primary-light hover:text-primary transition-colors disabled:opacity-50"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Date Picker */}
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full text-sm text-slate-600 border-none focus:ring-0 bg-transparent cursor-pointer p-0"
              />
            </div>

            {/* Time Picker */}
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              <input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="w-full text-sm text-slate-600 border-none focus:ring-0 bg-transparent cursor-pointer p-0"
              />
            </div>

            {/* Priority Selector */}
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-slate-400" />
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="text-sm text-slate-600 border-none focus:ring-0 bg-transparent cursor-pointer w-full p-0"
              >
                <option value="low">Prioridade Baixa</option>
                <option value="medium">Prioridade Média</option>
                <option value="high">Prioridade Alta</option>
              </select>
            </div>

            {/* Reminder Selector */}
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-slate-400" />
              <select
                value={reminder}
                onChange={(e) => setReminder(e.target.value as Reminder)}
                className="text-sm text-slate-600 border-none focus:ring-0 bg-transparent cursor-pointer w-full p-0"
              >
                <option value="none">Sem lembrete</option>
                <option value="15-minutes">15 min antes</option>
                <option value="1-hour">1 hora antes</option>
                <option value="1-day">1 dia antes</option>
              </select>
            </div>

            {/* Label Selector */}
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-slate-400" />
              <select
                value={labelId}
                onChange={(e) => setLabelId(e.target.value)}
                className="text-sm text-slate-600 border-none focus:ring-0 bg-transparent cursor-pointer w-full p-0"
              >
                <option value="">Sem Etiqueta</option>
                {labels.map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>

            {/* Card Selector */}
            <div className="flex items-center gap-2">
              <Folder className="w-4 h-4 text-slate-400" />
              <select
                value={cardId}
                onChange={(e) => setCardId(e.target.value)}
                className="text-sm text-slate-600 border-none focus:ring-0 bg-transparent cursor-pointer w-full p-0"
              >
                {cards.length > 0 ? (
                  cards.map(card => (
                    <option key={card.id} value={card.id}>
                      {card.title}
                    </option>
                  ))
                ) : (
                  <option value="default">Geral</option>
                )}
              </select>
            </div>

            {/* Assignee Selector */}
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-slate-400" />
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="text-sm text-slate-600 border-none focus:ring-0 bg-transparent cursor-pointer w-full p-0"
              >
                <option value="">Sem Responsável</option>
                {teamMembers.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!title.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-dark rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isEditing ? 'Salvar Alterações' : 'Criar Tarefa'}
            </button>
          </div>
        </div>
      </motion.form>
    </div>
  );
}
