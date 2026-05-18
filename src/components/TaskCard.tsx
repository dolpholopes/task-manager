import React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, CheckCircle2, Circle, Trash2, Clock, AlertCircle, Bell, Pencil, Tag, Plus, Pin, PinOff, CheckSquare, Square, ListChecks } from 'lucide-react';
import { Task, Priority, Label, TeamMember, ChecklistItem } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { User, Users } from 'lucide-react';

interface TaskCardProps {
  task: Task;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (task: Task) => void;
  onTogglePin?: (id: string) => void;
  onUpdateLabel?: (taskId: string, labelId: string | undefined) => void;
  onUpdateAssignee?: (taskId: string, memberId: string | undefined) => void;
  onUpdateTask?: (taskId: string, data: Partial<Task>) => void;
  onAddLabel?: (name: string, color: string) => Promise<void>;
  onAddMember?: (name: string, color: string) => Promise<void>;
  labels?: Label[];
  teamMembers?: TeamMember[];
  isCompact?: boolean;
}

const priorityConfig: Record<Priority, { color: string; bg: string; border: string; label: string }> = {
  high: { color: 'text-red-600', bg: 'bg-red-50', border: 'border-l-red-500', label: 'Alta' },
  medium: { color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-l-amber-500', label: 'Média' },
  low: { color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-l-emerald-500', label: 'Baixa' },
};

export function TaskCard({ task, onToggle, onDelete, onEdit, onTogglePin, onUpdateLabel, onUpdateAssignee, onUpdateTask, onAddLabel, onAddMember, labels = [], teamMembers = [], isCompact = false }: TaskCardProps) {
  // Check if overdue: due date is before today (end of day)
  const isOverdue = task.dueDate && new Date(task.dueDate + 'T' + (task.dueTime || '23:59') + ':59') < new Date() && !task.completed;
  const priority = priorityConfig[task.priority || 'medium'];
  const taskLabel = labels.find(l => l.id === task.labelId);
  const assignee = teamMembers.find(m => m.id === task.assigneeId);

  const [isLabelSelectorOpen, setIsLabelSelectorOpen] = React.useState(false);
  const [isAssigneeSelectorOpen, setIsAssigneeSelectorOpen] = React.useState(false);
  const [showChecklist, setShowChecklist] = React.useState(false);
  const [newLabelName, setNewLabelName] = React.useState('');
  const [newMemberName, setNewMemberName] = React.useState('');
  const [isCreatingLabel, setIsCreatingLabel] = React.useState(false);
  const [isCreatingMember, setIsCreatingMember] = React.useState(false);

  const checklistItems = task.checklist || [];
  const completedChecklistItems = checklistItems.filter(i => i.completed).length;
  const totalChecklistItems = checklistItems.length;
  const checklistProgress = totalChecklistItems > 0 ? (completedChecklistItems / totalChecklistItems) * 100 : 0;

  const handleToggleChecklistItem = (e: React.MouseEvent, itemId: string) => {
    e.stopPropagation();
    if (!onUpdateTask || !task.checklist) return;

    const newChecklist = task.checklist.map(item =>
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );
    onUpdateTask(task.id, { checklist: newChecklist });
  };

  // Close dropdown when clicking outside
  React.useEffect(() => {
    if (!isLabelSelectorOpen && !isAssigneeSelectorOpen) return;
    const handleClickAway = () => {
      setIsLabelSelectorOpen(false);
      setIsAssigneeSelectorOpen(false);
    };
    window.addEventListener('click', handleClickAway);
    return () => window.removeEventListener('click', handleClickAway);
  }, [isLabelSelectorOpen, isAssigneeSelectorOpen]);

  const handleLabelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsAssigneeSelectorOpen(false);
    setIsLabelSelectorOpen(!isLabelSelectorOpen);
  };

  const handleAssigneeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsLabelSelectorOpen(false);
    setIsAssigneeSelectorOpen(!isAssigneeSelectorOpen);
  };

  const handleSelectAssignee = (memberId: string | undefined) => {
    if (onUpdateAssignee) {
      onUpdateAssignee(task.id, memberId);
    }
    setIsAssigneeSelectorOpen(false);
  };

  const handleSelectLabel = (labelId: string | undefined) => {
    if (onUpdateLabel) {
      onUpdateLabel(task.id, labelId);
    }
    setIsLabelSelectorOpen(false);
  };

  const handleQuickAddLabel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabelName.trim() || !onAddLabel) return;
    
    setIsCreatingLabel(true);
    try {
      // Logic from LabelAutomationManager: use a random color if not specified
      const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#64748b'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      await onAddLabel(newLabelName.trim(), randomColor);
      setNewLabelName('');
      // We don't automatically assign it here because we don't have the ID yet (it's generated in addLabel)
      // but usually the user would expect it to be assigned. 
      // For now, let's just add it.
    } finally {
      setIsCreatingLabel(false);
    }
  };

  const handleQuickAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim() || !onAddMember) return;
    
    setIsCreatingMember(true);
    try {
      const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#64748b', '#0ea5e9', '#f43f5e'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      await onAddMember(newMemberName.trim(), randomColor);
      setNewMemberName('');
    } finally {
      setIsCreatingMember(false);
    }
  };

  if (isCompact) {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={cn(
          "group relative bg-white rounded-lg p-2 shadow-sm border border-slate-100 border-l-4 transition-all hover:shadow-md flex items-center gap-3",
          priority.border,
          task.completed && "bg-slate-50 opacity-75 border-l-slate-300",
          (isLabelSelectorOpen || isAssigneeSelectorOpen) && "z-[50]"
        )}
      >
        <button
          onClick={() => onToggle(task.id)}
          className={cn(
            "flex-shrink-0 text-slate-400 transition-colors hover:text-emerald-500",
            task.completed && "text-emerald-500"
          )}
        >
          {task.completed ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <Circle className="w-4 h-4" />
          )}
        </button>

        <div className={cn("flex-1 min-w-0 flex flex-col items-start gap-1 relative py-0.5", (isLabelSelectorOpen || isAssigneeSelectorOpen) && "z-[100]")}>
          <div className="flex items-center gap-1.5 w-full">
            <button 
              onClick={handleLabelClick}
              className={cn(
                 "px-1.5 py-0.5 rounded text-[9px] font-bold text-white uppercase transition-opacity hover:opacity-80 active:scale-95 flex-shrink-0 truncate max-w-[80px]",
                 !taskLabel && "bg-slate-100 text-slate-400 border border-dashed border-slate-200"
              )}
              style={taskLabel ? { backgroundColor: taskLabel.color } : {}}
              title={taskLabel ? `Etiqueta: ${taskLabel.name}` : "Clique para escolher etiqueta"}
            >
              {taskLabel ? taskLabel.name : <Tag className="w-2.5 h-2.5" />}
            </button>

            {/* Assignee Trigger Compact */}
            <div className="relative">
              <button
                onClick={handleAssigneeClick}
                className={cn(
                  "h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white transition-all hover:scale-110 active:scale-95 flex-shrink-0 shadow-sm",
                  assignee ? "px-1.5 min-w-[20px]" : "w-5",
                  !assignee && "bg-slate-100 text-slate-400 border border-dashed border-slate-200"
                )}
                style={assignee ? { backgroundColor: assignee.color } : {}}
                title={assignee ? `Responsável: ${assignee.name}` : "Atribuir responsável"}
              >
                {assignee ? (
                  <span className="truncate max-w-[60px]">{assignee.name.split(' ')[0]}</span>
                ) : (
                  <User className="w-2.5 h-2.5" />
                )}
              </button>
            </div>
          </div>

          <AnimatePresence>
            {isAssigneeSelectorOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -5 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -5 }}
                className="absolute left-0 top-full mt-2 z-[102] bg-white shadow-2xl rounded-xl border border-slate-200 p-2 min-w-[200px]"
                onClick={e => e.stopPropagation()}
              >
                <div className="max-h-[200px] overflow-y-auto space-y-1">
                  <button
                    onClick={() => handleSelectAssignee(undefined)}
                    className="w-full text-left px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 rounded-lg flex items-center justify-between"
                  >
                    Sem Responsável
                    {!task.assigneeId && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                  </button>
                  {teamMembers.map(member => (
                    <button
                      key={member.id}
                      onClick={() => handleSelectAssignee(member.id)}
                      className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 rounded-lg flex items-center gap-2"
                    >
                      <div className="px-1.5 h-6 rounded-full flex items-center justify-center text-white font-bold text-[9px] shadow-sm min-w-[24px]" style={{ backgroundColor: member.color }}>
                        {member.name.split(' ')[0]}
                      </div>
                      <span className="flex-1 truncate">{member.name}</span>
                      {task.assigneeId === member.id && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                    </button>
                  ))}
                </div>

                <div className="pt-2 border-t border-slate-100 mt-2">
                  <form onSubmit={handleQuickAddMember} className="flex items-center gap-1">
                    <input
                      autoFocus
                      type="text"
                      value={newMemberName}
                      onChange={e => setNewMemberName(e.target.value)}
                      placeholder="Novo membro..."
                      className="flex-1 bg-slate-50 border-none rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-primary outline-none"
                    />
                    <button
                      disabled={isCreatingMember || !newMemberName.trim()}
                      className="p-1.5 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </form>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {isLabelSelectorOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -5 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -5 }}
                className="absolute left-0 top-full mt-3 z-[101] bg-white shadow-2xl rounded-xl border border-slate-200 p-2 min-w-[220px]"
                onClick={e => e.stopPropagation()}
              >
                <div className="max-h-[200px] overflow-y-auto mb-2 space-y-1">
                  <button
                    onClick={() => handleSelectLabel(undefined)}
                    className="w-full text-left px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 rounded-lg flex items-center justify-between"
                  >
                    Sem Etiqueta
                    {!task.labelId && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                  </button>
                  {labels.map(label => (
                    <button
                      key={label.id}
                      onClick={() => handleSelectLabel(label.id)}
                      className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 rounded-lg flex items-center gap-2"
                    >
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: label.color }} />
                      <span className="flex-1 truncate">{label.name}</span>
                      {task.labelId === label.id && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                    </button>
                  ))}
                </div>
                
                <div className="pt-2 border-t border-slate-100 mt-2">
                  <form onSubmit={handleQuickAddLabel} className="flex items-center gap-1">
                    <input
                      autoFocus
                      type="text"
                      value={newLabelName}
                      onChange={e => setNewLabelName(e.target.value)}
                      placeholder="Nova etiqueta..."
                      className="flex-1 bg-slate-50 border-none rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-primary outline-none"
                    />
                    <button
                      disabled={isCreatingLabel || !newLabelName.trim()}
                      className="p-1.5 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </form>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <h3 className={cn(
            "text-sm font-medium text-slate-900 truncate w-full",
            task.completed && "line-through text-slate-500"
          )}>
            {task.title}
          </h3>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
          {onTogglePin && (
            <button
              onClick={() => onTogglePin(task.id)}
              className={cn(
                "p-1 rounded transition-colors bg-slate-50 lg:bg-transparent",
                task.isPinned ? "text-primary bg-primary-light/50 lg:opacity-100" : "text-slate-400 hover:text-primary hover:bg-primary-light"
              )}
              title={task.isPinned ? "Desafixar" : "Fixar tarefa"}
            >
              <Pin className={cn("w-3 h-3", task.isPinned && "fill-current")} />
            </button>
          )}
          <button
            onClick={() => onEdit(task)}
            className="p-1 text-slate-400 hover:text-primary hover:bg-primary-light rounded transition-colors bg-slate-50 lg:bg-transparent"
            title="Editar tarefa"
          >
            <Pencil className="w-3 h-3" />
          </button>
          <button
            onClick={() => onDelete(task.id)}
            className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors bg-slate-50 lg:bg-transparent"
            title="Excluir tarefa"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        "group relative bg-white rounded-xl p-4 shadow-sm border border-slate-100 border-l-4 transition-all hover:shadow-md",
        priority.border,
        task.completed && "bg-slate-50 opacity-75 border-l-slate-300",
        (isLabelSelectorOpen || isAssigneeSelectorOpen) && "z-[50]"
      )}
    >
      <div className="flex items-start gap-3">
        <button
          onClick={() => onToggle(task.id)}
          className={cn(
            "mt-1 flex-shrink-0 text-slate-400 transition-colors hover:text-emerald-500",
            task.completed && "text-emerald-500"
          )}
        >
          {task.completed ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : (
            <Circle className="w-5 h-5" />
          )}
        </button>
        
        <div className="flex-1 min-w-0">
          <div className="flex flex-col items-start gap-1.5 mb-2">
            <div className="flex items-center gap-2">
              {labels.length > 0 && (
                <div className={cn("relative", isLabelSelectorOpen && "z-[100]")}>
                  <button 
                    onClick={handleLabelClick}
                    className={cn(
                      "flex items-center px-1.5 h-5 rounded-md text-[10px] font-bold uppercase shadow-sm transition-all hover:ring-2 hover:ring-offset-1 hover:ring-slate-200 active:scale-95 truncate max-w-[120px]",
                      taskLabel ? "text-white" : "bg-slate-50 text-slate-400 border border-slate-200"
                    )}
                    style={taskLabel ? { backgroundColor: taskLabel.color } : {}}
                    title={taskLabel ? `Etiqueta: ${taskLabel.name}` : "Clique para escolher etiqueta"}
                  >
                    {taskLabel ? taskLabel.name : "Etiqueta"}
                  </button>

                  <AnimatePresence>
                    {isLabelSelectorOpen && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -5 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -5 }}
                        className="absolute left-0 top-full mt-3 z-[101] bg-white shadow-2xl rounded-xl border border-slate-200 p-2 min-w-[220px]"
                        onClick={e => e.stopPropagation()}
                      >
                        <div className="max-h-[200px] overflow-y-auto mb-2 space-y-1">
                          <button
                            onClick={() => handleSelectLabel(undefined)}
                            className="w-full text-left px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 rounded-lg flex items-center justify-between"
                          >
                            Sem Etiqueta
                            {!task.labelId && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                          </button>
                          {labels.map(label => (
                            <button
                              key={label.id}
                              onClick={() => handleSelectLabel(label.id)}
                              className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 rounded-lg flex items-center gap-2"
                            >
                              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: label.color }} />
                              <span className="flex-1 truncate">{label.name}</span>
                              {task.labelId === label.id && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                            </button>
                          ))}
                        </div>
                        
                        <div className="pt-2 border-t border-slate-100 mt-2">
                          <form onSubmit={handleQuickAddLabel} className="flex items-center gap-1">
                            <input
                              autoFocus
                              type="text"
                              value={newLabelName}
                              onChange={e => setNewLabelName(e.target.value)}
                              placeholder="Nova etiqueta..."
                              className="flex-1 bg-slate-50 border-none rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-primary outline-none"
                            />
                            <button
                              disabled={isCreatingLabel || !newLabelName.trim()}
                              className="p-1.5 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 transition-colors"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </form>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Assignee Selector Full */}
              <div className={cn("relative", isAssigneeSelectorOpen && "z-[100]")}>
                <button
                  onClick={handleAssigneeClick}
                  className={cn(
                    "flex items-center gap-1.5 px-1.5 h-5 rounded-md text-[10px] font-bold uppercase shadow-sm transition-all hover:ring-2 hover:ring-offset-1 hover:ring-slate-200 active:scale-95 max-w-[120px]",
                    assignee ? "text-white" : "bg-slate-50 text-slate-400 border border-slate-200"
                  )}
                  style={assignee ? { backgroundColor: assignee.color } : {}}
                  title={assignee ? `Responsável: ${assignee.name}` : "Clique para atribuir responsável"}
                >
                  <User className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{assignee ? assignee.name.split(' ')[0] : "Atribuir"}</span>
                </button>

                <AnimatePresence>
                  {isAssigneeSelectorOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -5 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -5 }}
                      className="absolute left-0 top-full mt-3 z-[101] bg-white shadow-2xl rounded-xl border border-slate-200 p-2 min-w-[220px]"
                      onClick={e => e.stopPropagation()}
                    >
                      <div className="max-h-[200px] overflow-y-auto space-y-1">
                        <button
                          onClick={() => handleSelectAssignee(undefined)}
                          className="w-full text-left px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 rounded-lg flex items-center justify-between"
                        >
                          Sem Responsável
                          {!task.assigneeId && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                        </button>
                        {teamMembers.map(member => (
                          <button
                            key={member.id}
                            onClick={() => handleSelectAssignee(member.id)}
                            className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 rounded-lg flex items-center gap-2"
                          >
                            <div className="px-2 h-6 rounded-full flex items-center justify-center text-white font-bold text-[9px] shadow-sm min-w-[24px]" style={{ backgroundColor: member.color }}>
                              {member.name.split(' ')[0]}
                            </div>
                            <span className="flex-1 truncate">{member.name}</span>
                            {task.assigneeId === member.id && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                          </button>
                        ))}
                      </div>

                      <div className="pt-2 border-t border-slate-100 mt-2">
                        <form onSubmit={handleQuickAddMember} className="flex items-center gap-1">
                          <input
                            autoFocus
                            type="text"
                            value={newMemberName}
                            onChange={e => setNewMemberName(e.target.value)}
                            placeholder="Novo membro..."
                            className="flex-1 bg-slate-50 border-none rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-primary outline-none"
                          />
                          <button
                            disabled={isCreatingMember || !newMemberName.trim()}
                            className="p-1.5 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </form>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <span className={cn(
                "text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md",
                priority.bg,
                priority.color
              )}>
                {priority.label}
              </span>
              {task.reminder !== 'none' && (
                <Bell className="w-3 h-3 text-slate-400" />
              )}
            </div>
          </div>

          <h3 className={cn(
            "font-medium text-slate-900 break-words w-full pr-16",
            task.completed && "line-through text-slate-500"
          )}>
            {task.title}
          </h3>
          
          {task.description && (
            <p className={cn(
              "mt-1 text-sm text-slate-500 line-clamp-2 break-all",
              task.completed && "text-slate-400"
            )}>
              {task.description}
            </p>
          )}

          {/* Checklist Preview / Progress */}
          {totalChecklistItems > 0 && (
            <div className="mt-3 space-y-2">
              <div 
                onClick={() => setShowChecklist(!showChecklist)}
                className="flex items-center justify-between group/checklist cursor-pointer"
              >
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest group-hover:text-primary transition-colors">
                  <ListChecks className="w-3.5 h-3.5" />
                  <span>Checklist ({completedChecklistItems}/{totalChecklistItems})</span>
                </div>
                <div className="w-24 h-1 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${checklistProgress}%` }}
                    className="h-full bg-emerald-500" 
                  />
                </div>
              </div>

              <AnimatePresence>
                {showChecklist && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="space-y-1.5 pt-1 overflow-hidden"
                  >
                    {checklistItems.map(item => (
                      <div 
                        key={item.id} 
                        className="flex items-center gap-2 group/item"
                        onClick={(e) => handleToggleChecklistItem(e, item.id)}
                      >
                        <button className={cn(
                          "transition-colors",
                          item.completed ? "text-emerald-500" : "text-slate-300 group-hover/item:text-slate-400"
                        )}>
                          {item.completed ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                        </button>
                        <span className={cn(
                          "text-xs transition-all",
                          item.completed ? "text-slate-400 line-through" : "text-slate-600"
                        )}>
                          {item.text}
                        </span>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          <div className="mt-3 flex items-center gap-3 text-xs">
            {task.dueDate && (
              <div className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded-full bg-slate-100 text-slate-600 font-medium",
                isOverdue && "bg-red-50 text-red-600",
                task.completed && "bg-slate-100 text-slate-400"
              )}>
                <Calendar className="w-3.5 h-3.5" />
                <span>
                  {/* Append T00:00:00 to ensure local time parsing for YYYY-MM-DD strings */}
                  {format(new Date(task.dueDate + 'T00:00:00'), "d 'de' MMM", { locale: ptBR })}
                  {task.dueTime && ` às ${task.dueTime}`}
                </span>
              </div>
            )}
            
            <div className="flex items-center gap-1 text-slate-400 ml-auto">
              <Clock className="w-3 h-3" />
              <span>
                {format(task.createdAt, "HH:mm", { locale: ptBR })}
              </span>
            </div>
          </div>
        </div>

        <div className="absolute top-4 right-4 flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
          {onTogglePin && (
            <button
              onClick={() => onTogglePin(task.id)}
              className={cn(
                "p-1.5 rounded-md transition-colors bg-slate-50 lg:bg-transparent",
                task.isPinned ? "text-primary bg-primary-light/50 lg:opacity-100" : "text-slate-400 hover:text-primary hover:bg-primary-light"
              )}
              title={task.isPinned ? "Desafixar" : "Fixar tarefa"}
            >
              <Pin className={cn("w-4 h-4", task.isPinned && "fill-current")} />
            </button>
          )}
          <button
            onClick={() => onEdit(task)}
            className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary-light rounded-md transition-colors bg-slate-50 lg:bg-transparent"
            title="Editar tarefa"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(task.id)}
            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors bg-slate-50 lg:bg-transparent"
            title="Excluir tarefa"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
