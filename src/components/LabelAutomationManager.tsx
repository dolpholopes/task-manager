import React, { useState } from 'react';
import { Label, Automation, Card, AutomationTrigger, TeamMember, AutomationAction } from '../types';
import { Tag, Zap, Plus, Trash2, X, Check, Settings2, User, Users } from 'lucide-react';
import { cn } from '../lib/utils';

interface LabelAutomationManagerProps {
  labels: Label[];
  automations: Automation[];
  cards: Card[];
  teamMembers?: TeamMember[];
  onAddLabel: (name: string, color: string) => void;
  onUpdateLabel: (id: string, name: string, color: string) => void;
  onDeleteLabel: (id: string) => void;
  onAddAutomation: (automation: Omit<Automation, 'id'>) => void;
  onDeleteAutomation: (id: string) => void;
  onClose: () => void;
}

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', 
  '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', 
  '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#64748b'
];

export function LabelAutomationManager({
  labels,
  automations,
  cards,
  teamMembers = [],
  onAddLabel,
  onUpdateLabel,
  onDeleteLabel,
  onAddAutomation,
  onDeleteAutomation,
  onClose
}: LabelAutomationManagerProps) {
  const [activeTab, setActiveTab] = useState<'labels' | 'automations'>('labels');
  
  // New Label State
  const [newLabelName, setNewLabelName] = useState('');
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);

  // New Automation State
  const [newAutoName, setNewAutoName] = useState('');
  const [trigger, setTrigger] = useState<AutomationTrigger>('task_completed');
  const [triggerCardId, setTriggerCardId] = useState(cards[0]?.id || '');
  const [triggerMemberId, setTriggerMemberId] = useState(teamMembers[0]?.id || '');
  const [action, setAction] = useState<AutomationAction>('change_label');
  const [actionLabelId, setActionLabelId] = useState(labels[0]?.id || '');
  const [actionMemberId, setActionMemberId] = useState(teamMembers[0]?.id || '');

  const handleAddLabel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabelName.trim()) return;
    
    if (editingLabelId) {
      onUpdateLabel(editingLabelId, newLabelName.trim(), selectedColor);
      setEditingLabelId(null);
    } else {
      onAddLabel(newLabelName.trim(), selectedColor);
    }
    
    setNewLabelName('');
  };

  const startEditingLabel = (label: Label) => {
    setEditingLabelId(label.id);
    setNewLabelName(label.name);
    setSelectedColor(label.color);
  };

  const cancelEditingLabel = () => {
    setEditingLabelId(null);
    setNewLabelName('');
    setSelectedColor(PRESET_COLORS[0]);
  };

  const handleAddAutomation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAutoName.trim()) return;
    
    onAddAutomation({
      name: newAutoName.trim(),
      trigger,
      triggerCardId: trigger === 'task_moved_to_card' ? triggerCardId : undefined,
      triggerMemberId: trigger === 'task_assigned' ? triggerMemberId : undefined,
      action,
      actionLabelId: action === 'change_label' ? actionLabelId : undefined,
      actionMemberId: action === 'assign_member' ? actionMemberId : undefined,
      enabled: true
    });
    setNewAutoName('');
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-primary-light rounded-xl text-primary">
                <Settings2 className="w-5 h-5" />
             </div>
             <h2 className="text-xl font-bold text-slate-800">Labels & Automação</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex border-b border-slate-100">
          <button 
            onClick={() => setActiveTab('labels')}
            className={cn(
              "flex-1 py-3 text-sm font-bold uppercase tracking-wider transition-colors",
              activeTab === 'labels' ? "text-primary border-b-2 border-primary" : "text-slate-400 hover:text-slate-600"
            )}
          >
            <div className="flex items-center justify-center gap-2">
              <Tag className="w-4 h-4" />
              Etiquetas
            </div>
          </button>
          <button 
            onClick={() => setActiveTab('automations')}
            className={cn(
              "flex-1 py-3 text-sm font-bold uppercase tracking-wider transition-colors",
              activeTab === 'automations' ? "text-primary border-b-2 border-primary" : "text-slate-400 hover:text-slate-600"
            )}
          >
            <div className="flex items-center justify-center gap-2">
              <Zap className="w-4 h-4" />
              Automações
            </div>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'labels' ? (
            <div className="space-y-8">
              <form onSubmit={handleAddLabel} className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200/60">
                <div className="flex gap-4">
                  <input
                    type="text"
                    value={newLabelName}
                    onChange={(e) => setNewLabelName(e.target.value)}
                    placeholder="Nome da etiqueta..."
                    className="flex-1 bg-white border-slate-200 rounded-lg focus:ring-primary focus:border-primary px-4 py-2"
                  />
                  <div className="flex gap-2">
                    <button 
                      type="submit"
                      className="px-6 py-2 bg-primary text-white rounded-lg font-bold hover:bg-primary/90 transition-colors flex items-center gap-2"
                    >
                      {editingLabelId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                      {editingLabelId ? 'Salvar' : 'Criar'}
                    </button>
                    {editingLabelId && (
                      <button 
                        type="button"
                        onClick={cancelEditingLabel}
                        className="px-4 py-2 bg-slate-200 text-slate-600 rounded-lg font-bold hover:bg-slate-300 transition-colors"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setSelectedColor(color)}
                      className={cn(
                        "w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 flex items-center justify-center",
                        selectedColor === color ? "border-slate-800" : "border-transparent"
                      )}
                      style={{ backgroundColor: color }}
                    >
                      {selectedColor === color && <Check className="w-4 h-4 text-white drop-shadow-md" />}
                    </button>
                  ))}
                </div>
              </form>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {labels.map(label => (
                  <div key={label.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: label.color }} />
                      <span className="font-medium text-slate-700">{label.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => startEditingLabel(label)}
                        className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary-light rounded-md transition-colors"
                        title="Editar Etiqueta"
                      >
                        <Settings2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => onDeleteLabel(label.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                        title="Excluir Etiqueta"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              <form onSubmit={handleAddAutomation} className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200/60">
                <input
                  type="text"
                  value={newAutoName}
                  onChange={(e) => setNewAutoName(e.target.value)}
                  placeholder="Nome da automação..."
                  className="w-full bg-white border-slate-200 rounded-lg focus:ring-primary focus:border-primary px-4 py-2"
                />
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Gatilho (Trigger)</label>
                    <select 
                      value={trigger}
                      onChange={(e) => setTrigger(e.target.value as AutomationTrigger)}
                      className="w-full bg-white border-slate-200 rounded-lg focus:ring-primary h-10 px-2 text-sm"
                    >
                      <option value="task_completed">Tarefa for concluída</option>
                      <option value="task_moved_to_card">Tarefa for movida para card</option>
                      <option value="task_created">Tarefa for criada</option>
                      <option value="task_assigned">Tarefa for atribuída</option>
                    </select>
                  </div>

                  {trigger === 'task_moved_to_card' && (
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Qual Card?</label>
                      <select 
                        value={triggerCardId}
                        onChange={(e) => setTriggerCardId(e.target.value)}
                        className="w-full bg-white border-slate-200 rounded-lg focus:ring-primary h-10 px-2 text-sm"
                      >
                        {cards.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                      </select>
                    </div>
                  )}

                  {trigger === 'task_assigned' && (
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Para quem?</label>
                      <select 
                        value={triggerMemberId}
                        onChange={(e) => setTriggerMemberId(e.target.value)}
                        className="w-full bg-white border-slate-200 rounded-lg focus:ring-primary h-10 px-2 text-sm"
                      >
                        <option value="">Qualquer pessoa</option>
                        {teamMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ação (Action)</label>
                    <select 
                      value={action}
                      onChange={(e) => setAction(e.target.value as AutomationAction)}
                      className="w-full bg-white border-slate-200 rounded-lg focus:ring-primary h-10 px-2 text-sm"
                    >
                      <option value="change_label">Mudar Etiqueta</option>
                      <option value="assign_member">Atribuir Pessoa</option>
                    </select>
                  </div>

                  {action === 'change_label' ? (
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Mudar Etiqueta para:</label>
                      <select 
                        value={actionLabelId}
                        onChange={(e) => setActionLabelId(e.target.value)}
                        className="w-full bg-white border-slate-200 rounded-lg focus:ring-primary h-10 px-2 text-sm"
                      >
                        <option value="">Nenhuma</option>
                        {labels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Atribuir para:</label>
                      <select 
                        value={actionMemberId}
                        onChange={(e) => setActionMemberId(e.target.value)}
                        className="w-full bg-white border-slate-200 rounded-lg focus:ring-primary h-10 px-2 text-sm"
                      >
                        <option value="">Desatribuir</option>
                        {teamMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                    </div>
                  )}
                </div>

                <button 
                  type="submit"
                  className="w-full py-2 bg-primary text-white rounded-lg font-bold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Criar Automação
                </button>
              </form>

              <div className="space-y-3">
                {automations.map(auto => {
                  const targetLabel = labels.find(l => l.id === auto.actionLabelId);
                  const targetMemberAction = teamMembers.find(m => m.id === auto.actionMemberId);
                  const targetCard = cards.find(c => c.id === auto.triggerCardId);
                  const targetMemberTrigger = teamMembers.find(m => m.id === auto.triggerMemberId);
                  
                  let triggerText = '';
                  if (auto.trigger === 'task_completed') triggerText = 'Ao concluir';
                  else if (auto.trigger === 'task_moved_to_card') triggerText = `Ao mover para "${targetCard?.title || 'Card'}"`;
                  else if (auto.trigger === 'task_created') triggerText = 'Ao criar';
                  else if (auto.trigger === 'task_assigned') triggerText = targetMemberTrigger ? `Ao atribuir para "${targetMemberTrigger.name}"` : 'Ao atribuir';

                  let actionText = '';
                  if (auto.action === 'change_label') actionText = `Etiqueta: ${targetLabel?.name || 'Remover'}`;
                  else if (auto.action === 'assign_member') actionText = `Atribuir: ${targetMemberAction?.name || 'Desatribuir'}`;

                  return (
                    <div key={auto.id} className="p-4 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-4 group">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-slate-800 truncate">{auto.name}</h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {triggerText} {' -> '} {actionText}
                        </p>
                      </div>
                      <button 
                        onClick={() => onDeleteAutomation(auto.id)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
