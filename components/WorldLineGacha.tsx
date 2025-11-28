import React, { useState, useEffect } from 'react';
import { Character, GachaCandidate, StatType } from '../types';
import { generateGachaCandidates } from '../services/gameEngine';
import { Modal, Button } from './UIComponents';

interface WorldLineGachaProps {
  character: Character;
  crystals: number;
  onClose: () => void;
  onConfirm: (candidate: GachaCandidate) => void;
}

const StatDiff = ({ label, oldVal, diff }: { label: string, oldVal: number, diff: number }) => {
  const newVal = (oldVal + diff).toFixed(2);
  const isPositive = diff > 0;
  const isNegative = diff < 0;
  const color = isPositive ? 'text-green-400' : (isNegative ? 'text-red-400' : 'text-gray-400');
  
  return (
    <div className="flex justify-between text-xs my-1">
      <span className="text-gray-500 w-8">{label}</span>
      <span className="text-gray-300">{oldVal.toFixed(2)}</span>
      <span className="text-gray-500">→</span>
      <span className={`${color} font-mono font-bold w-12 text-right`}>{newVal}</span>
      <span className={`${color} text-[10px] w-8 text-right`}>({diff > 0 ? '+' : ''}{diff.toFixed(2)})</span>
    </div>
  );
};

const CandidateCard = ({ candidate, character, onSelect }: { candidate: GachaCandidate, character: Character, onSelect: () => void }) => {
  const borderColors = {
    'SILVER': 'border-gray-500 shadow-gray-900',
    'GOLD': 'border-yellow-500 shadow-yellow-900',
    'RAINBOW': 'border-purple-500 shadow-purple-900 animate-pulse'
  };

  const bgColors = {
    'SILVER': 'bg-gray-800',
    'GOLD': 'bg-gray-800 bg-opacity-90',
    'RAINBOW': 'bg-gray-800' // 可以加个渐变背景
  };

  return (
    <div className={`border-2 ${borderColors[candidate.rank]} ${bgColors[candidate.rank]} rounded-lg p-3 flex flex-col shadow-lg relative overflow-hidden`}>
      {candidate.rank === 'RAINBOW' && <div className="absolute top-0 right-0 bg-purple-600 text-white text-xs px-2 py-0.5 rounded-bl">天选</div>}
      
      <div className="text-center font-bold mb-2 text-sm tracking-widest text-gray-300">
        {candidate.rank === 'SILVER' ? '普通观测' : candidate.rank === 'GOLD' ? '良性变异' : '世界线收束'}
      </div>

      <div className="flex-1 space-y-1">
        {(Object.keys(candidate.deltas) as StatType[]).map(stat => (
          <StatDiff 
            key={stat} 
            label={stat} 
            oldVal={character.growthRates[stat]} 
            diff={candidate.deltas[stat]} 
          />
        ))}
      </div>

      {candidate.bonusTrait && (
        <div className="mt-2 text-xs bg-blue-900 text-blue-200 p-1 rounded text-center border border-blue-700">
          觉醒特性: {candidate.bonusTrait}
        </div>
      )}

      <Button variant="primary" className="mt-3 text-sm w-full" onClick={onSelect}>
        选择此线
      </Button>
    </div>
  );
};

const WorldLineGacha: React.FC<WorldLineGachaProps> = ({ character, crystals, onClose, onConfirm }) => {
  const [candidates, setCandidates] = useState<GachaCandidate[]>([]);
  const [loading, setLoading] = useState(true);

  // 初始化生成候选
  useEffect(() => {
    // 模拟一下计算延迟，更有感觉
    const timer = setTimeout(() => {
      setCandidates(generateGachaCandidates(character));
      setLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, [character]);

  if (loading) {
    return (
      <Modal title="正在观测平行世界..." onClose={() => {}}>
        <div className="flex flex-col items-center justify-center h-64">
           <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
           <p className="text-purple-300 animate-pulse">正在演算可能性...</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={`俺寻思: ${character.name}`} onClose={onClose}>
      <div className="text-sm text-gray-400 mb-4 flex justify-between">
        <p>消耗 1 丧尸结晶，观测3条平行世界线的成长可能性。</p>
        <span className="text-purple-400 font-bold">剩余结晶: {crystals}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {candidates.map((cand, idx) => (
          <CandidateCard 
            key={idx} 
            candidate={cand} 
            character={character} 
            onSelect={() => onConfirm(cand)} 
          />
        ))}
      </div>
    </Modal>
  );
};

export default WorldLineGacha;
