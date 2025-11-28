
import React, { useState, useEffect, useRef } from 'react';
import { GameState, Character, Enemy } from '../types';
import { simulateCombat, CombatResult, CombatLog, calculateStats } from '../services/gameEngine';
import { ENEMY_TEMPLATES } from '../constants';
import { Modal, Button, ProgressBar } from './UIComponents';

interface NightCombatProps {
  state: GameState;
  customEnemies?: Enemy[]; // 支持传入自定义敌人（如序章战斗）
  onCombatEnd: (result: CombatResult) => void;
}

const NightCombat: React.FC<NightCombatProps> = ({ state, customEnemies, onCombatEnd }) => {
  const [logs, setLogs] = useState<CombatLog[]>([]);
  const [isFinished, setIsFinished] = useState(false);
  const [finalResult, setFinalResult] = useState<CombatResult | null>(null);
  
  // 实时HP追踪 (用于UI显示)
  const [playerHps, setPlayerHps] = useState<Record<string, {current: number, max: number}>>({});
  const [enemyHps, setEnemyHps] = useState<Record<string, {current: number, max: number, name: string}>>({});

  // 滚动到底部
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 1. 生成敌人配置
    let enemies: Enemy[] = [];
    
    if (customEnemies) {
        enemies = customEnemies;
    } else {
        const enemyCount = Math.floor(2 + (state.day * 0.5) + (state.threat / 20));
        for(let i=0; i<enemyCount; i++) {
            const rand = Math.random();
            const uniqueId = `enemy_${i}_${Date.now()}`;
            if (state.threat > 50 && rand > 0.8) enemies.push({ ...ENEMY_TEMPLATES['ZOMBIE_TANK'], id: uniqueId });
            else if (rand > 0.6) enemies.push({ ...ENEMY_TEMPLATES['ZOMBIE_RUNNER'], id: uniqueId });
            else enemies.push({ ...ENEMY_TEMPLATES['ZOMBIE_WALKER'], id: uniqueId });
        }
    }

    // 初始化 HP 状态
    const initPlayerHp: Record<string, any> = {};
    state.characters.forEach(c => {
        const stats = calculateStats(c);
        initPlayerHp[c.id] = { current: c.currentHp, max: stats.hpMax };
    });
    setPlayerHps(initPlayerHp);

    const initEnemyHp: Record<string, any> = {};
    enemies.forEach(e => {
        initEnemyHp[e.id] = { current: e.hp, max: e.maxHp, name: e.name };
    });
    setEnemyHps(initEnemyHp);

    // 2. 运行战斗模拟 (同步计算)
    const result = simulateCombat(state.characters, enemies, state.morale);
    setFinalResult(result);

    // 3. 逐步显示日志 (模拟打字机效果)
    let currentLogIndex = 0;
    const interval = setInterval(() => {
      if (result && result.logs && currentLogIndex < result.logs.length) {
        const nextLog = result.logs[currentLogIndex];
        
        if (nextLog) {
            setLogs(prev => [...prev, nextLog]);
            
            // 解析日志更新 HP 显示 (简单的字符串匹配，或者最好 gameEngine 返回每一步的状态)
            // 这里为了简单，我们不做复杂的每一步回放，只在战斗结束直接显示最终结果，
            // 或者：简单根据 "造成 X 点伤害" 扣减 (正则解析)
            
            const damageMatch = nextLog.message.match(/对 (.*) 造成 (\d+) 点伤害/);
            const killMatch = nextLog.message.match(/击杀/);
            
            if (damageMatch) {
               const targetName = damageMatch[1];
               const dmg = parseInt(damageMatch[2]);
               
               // 尝试更新 Player HP
               setPlayerHps(prev => {
                   const newState = { ...prev };
                   for(const key in newState) {
                       const char = state.characters.find(c => c.id === key);
                       if (char && char.name === targetName) {
                           newState[key] = { ...newState[key], current: Math.max(0, newState[key].current - dmg) };
                       }
                   }
                   return newState;
               });

               // 尝试更新 Enemy HP
               setEnemyHps(prev => {
                   const newState = { ...prev };
                   for(const key in newState) {
                       if (newState[key].name === targetName) {
                           newState[key] = { ...newState[key], current: Math.max(0, newState[key].current - dmg) };
                       }
                   }
                   return newState;
               });
            }
        }
        
        currentLogIndex++;
        
        if (logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      } else {
        setIsFinished(true);
        clearInterval(interval);
      }
    }, 400); // 速度稍快一点

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Modal title={customEnemies ? "⚔️ 遭遇战" : `第 ${state.day} 夜 - 入口防卫战`}>
      {/* 战场状态显示 */}
      <div className="flex justify-between mb-4 bg-gray-800 p-2 rounded gap-4 text-xs md:text-sm">
         <div className="flex-1">
            <h4 className="text-blue-400 font-bold mb-2">我方小队</h4>
            {state.characters.map(c => {
                const hp = playerHps[c.id] || { current: 0, max: 100 };
                return (
                    <div key={c.id} className="mb-1">
                        <div className="flex justify-between">
                            <span>{c.name}</span>
                            <span>{hp.current}/{hp.max}</span>
                        </div>
                        <div className="w-full bg-gray-700 h-1.5 rounded">
                            <div className="bg-blue-500 h-1.5 rounded" style={{ width: `${(hp.current/hp.max)*100}%` }}></div>
                        </div>
                    </div>
                );
            })}
         </div>
         <div className="w-px bg-gray-600 mx-2"></div>
         <div className="flex-1">
            <h4 className="text-red-400 font-bold mb-2">敌方单位</h4>
            {Object.keys(enemyHps).map(eid => {
                const hp = enemyHps[eid];
                if (hp.current <= 0 && !isFinished) return null; // 死亡暂时隐藏，或者变灰
                return (
                    <div key={eid} className="mb-1">
                        <div className="flex justify-between">
                            <span className={hp.current <=0 ? 'text-gray-500 line-through' : ''}>{hp.name}</span>
                            <span>{hp.current}/{hp.max}</span>
                        </div>
                        <div className="w-full bg-gray-700 h-1.5 rounded">
                            <div className="bg-red-500 h-1.5 rounded" style={{ width: `${(hp.current/hp.max)*100}%` }}></div>
                        </div>
                    </div>
                );
            })}
         </div>
      </div>

      {/* 战斗日志 */}
      <div className="bg-black bg-opacity-50 p-4 rounded h-64 overflow-y-auto font-mono text-xs md:text-sm space-y-1 border border-gray-700 mb-4">
        {logs.map((log, idx) => {
          if (!log) return null;
          return (
            <div key={idx} className={`${log.isPlayerAction ? 'text-blue-300' : 'text-red-400'} border-b border-gray-800 pb-1`}>
                <span className="text-gray-600 mr-2">[{log.turn}]</span>
                {log.message}
            </div>
          );
        })}
        <div ref={logsEndRef} />
      </div>

      {/* 结算按钮 */}
      {isFinished && finalResult && (
        <div className="flex justify-center animate-bounce">
           <Button 
             variant={finalResult.won ? "success" : "danger"} 
             onClick={() => onCombatEnd(finalResult)}
             className="w-full md:w-1/2 py-3 text-lg"
           >
             {finalResult.won ? "战斗胜利 - 结算" : "战斗失败 - 撤退"}
           </Button>
        </div>
      )}
    </Modal>
  );
};

export default NightCombat;
