import React from 'react';
import { Button, Card } from './UIComponents';
import { ActionDefinition, TimeSlot } from '../types';

interface ActionPanelProps {
  timeSlot: TimeSlot;
  actions: ActionDefinition[]; // 动态传入的行动列表
  onAction: (actionId: string) => void;
  disabled: boolean;
  isPrologue?: boolean;
}

const ActionPanel: React.FC<ActionPanelProps> = ({ timeSlot, actions, onAction, disabled, isPrologue }) => {
  
  if (!isPrologue && timeSlot >= TimeSlot.NIGHT) {
    return (
      <Card className="h-full flex flex-col justify-center items-center">
        <h3 className="text-xl text-red-400 mb-4">夜晚降临</h3>
        <p className="text-gray-400 mb-6">丧尸开始活跃，请做好防守准备。</p>
        <Button variant="danger" onClick={() => onAction('NIGHT_PHASE')} disabled={disabled}>
          进入夜战部署
        </Button>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 h-full content-start overflow-y-auto pb-4 scrollbar-hide">
      {actions.map(act => {
        if (act.hidden) return null;
        return (
          <button
            key={act.id}
            onClick={() => onAction(act.id)}
            disabled={disabled || act.disabled}
            className={`bg-gray-800 border border-gray-700 p-4 rounded-lg transition-all text-left group disabled:opacity-30 disabled:cursor-not-allowed ${
                act.disabled ? '' : 'hover:bg-gray-700 hover:border-blue-500'
            }`}
          >
            <div className={`font-bold group-hover:text-blue-200 ${act.disabled ? 'text-gray-600' : 'text-blue-300'}`}>
                {act.label}
            </div>
            <div className="text-xs text-gray-500 mt-1">{act.desc}</div>
          </button>
        );
      })}
    </div>
  );
};

export default ActionPanel;