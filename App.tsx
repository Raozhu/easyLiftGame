
import React, { useState, useEffect } from 'react';
import { GameState, TimeSlot, JobType, Character, GameEvent, GachaCandidate, ActionDefinition, StatType } from './types';
import { INITIAL_GAME_STATE, JOB_BASE_STATS, INITIAL_GROWTHS, EVENTS, ENEMY_TEMPLATES } from './constants';
import { PROLOGUE_ACTIONS, PROLOGUE_LOCATIONS, calculateExploration } from './prologueConfig';
import StatusPanel from './components/StatusPanel';
import ActionPanel from './components/ActionPanel';
import EventModal from './components/EventModal';
import WorldLineGacha from './components/WorldLineGacha';
import NightCombat from './components/NightCombat';
import { Modal, Button, Card } from './components/UIComponents';

const App = () => {
  // 核心状态
  const [gameState, setGameState] = useState<GameState>(INITIAL_GAME_STATE);
  
  // UI 模态框状态
  const [showGacha, setShowGacha] = useState<string | null>(null); // 存储 charId
  const [showCombat, setShowCombat] = useState(false);
  const [combatType, setCombatType] = useState<'NIGHT' | 'PROLOGUE' | 'BOSS'>('NIGHT');
  const [showEvent, setShowEvent] = useState<GameEvent | null>(null);
  const [showEquipAlert, setShowEquipAlert] = useState<boolean>(false); // 装备提示框

  // 初始化主角
  useEffect(() => {
    const hero: Character = {
      id: 'hero',
      name: '指挥官(你)',
      job: JobType.WARRIOR,
      level: 1,
      exp: 0,
      growthRates: { ...INITIAL_GROWTHS[JobType.WARRIOR] },
      currentHp: JOB_BASE_STATS[JobType.WARRIOR].baseHp, 
      syncScore: 10,
      traits: [],
      equipment: null
    };
    setGameState(prev => ({ ...prev, characters: [hero] }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- 获取当前目标 ---
  const getCurrentObjective = (): string => {
    if (!gameState.prologue.isActive) return '在小区中生存下去，寻找幸存者。';

    if (gameState.prologue.location === 'HOME') {
      if (!gameState.prologue.flags['has_peeped']) return '查看门外情况，确认危险等级。';
      if ((gameState.prologue.nodeProgress['home_search'] || 0) < 2) return '搜刮家里，寻找武器。';
      return '拿起武器，冲出房间，进入楼道！';
    }

    if (gameState.prologue.location === 'CORRIDOR') {
      const exploredCount = gameState.prologue.exploredRooms.length;
      const totalRooms = 16;
      if (exploredCount < totalRooms) return `探索整栋楼的所有住户 (${exploredCount}/${totalRooms} 已探索)。`;
      if (gameState.prologue.currentFloor !== 1) return '回到一楼，检查大门。';
      return '检查大门，尝试逃离小区！';
    }
    return ''; // Fallback
  };

  // --- 核心循环逻辑 ---

  // 1. 执行行动
  const handleAction = (actionId: string) => {
    // 特殊流程：装备撬棍 (UI Button 触发)
    if (actionId === 'PROLOGUE_EQUIP_CROWBAR') {
        setGameState(prev => {
            const char = { ...prev.characters[0] };
            char.traits = [...char.traits, '撬棍']; // 增加特性标记
            char.equipment = '撬棍'; // 显式装备
            const newChars = [...prev.characters];
            newChars[0] = char;
            return {
                ...prev,
                characters: newChars,
                logs: [...prev.logs, '你装备了撬棍。手中沉甸甸的铁器让你稍微安心了一点。']
            };
        });
        setShowEquipAlert(false);
        return;
    }

    // 正式夜战触发
    if (actionId === 'NIGHT_PHASE') {
      setCombatType('NIGHT');
      startNightPhase();
      return;
    }

    // === 序章通用逻辑引擎 ===
    if (gameState.prologue.isActive) {
        executePrologueAction(actionId);
        return;
    }

    // === 正常游戏逻辑 ===
    let newState = { ...gameState };
    let logMsg = '';

    switch (actionId) {
      case 'EXPLORE':
        newState.resources.materials += 2;
        newState.resources.food += 1;
        newState.security += 5;
        logMsg = '你探索了小区，找到了一些物资，并清理了部分游荡丧尸。';
        break;
      case 'TRAIN':
        newState.characters[0].exp += 20;
        newState.morale += 2;
        logMsg = '你在健身房挥洒汗水，感觉身体更强壮了。';
        break;
      case 'FARM':
        newState.resources.food += 0; 
        logMsg = '你照料了楼顶的菜园。';
        break;
      case 'CRAFT':
        newState.resources.materials -= 1;
        logMsg = '你加固了一些防具。';
        break;
      case 'REST':
        newState.characters[0].currentHp = newState.characters[0].growthRates[StatType.CON] * 30 + 100; // 简单回满
        logMsg = '你睡了一觉，精神焕发。';
        break;
      case 'FORTIFY':
        if (newState.resources.materials >= 2) {
            newState.resources.materials -= 2;
            newState.security += 10;
            logMsg = '你加固了入口大门。';
        } else {
            logMsg = '材料不足，无法加固！';
        }
        break;
      case 'MEDICAL':
        newState.characters[0].currentHp += 50;
        logMsg = '你在医务室简单处理了伤口。';
        break;
      case 'SCAVENGE':
        newState.resources.zombieParts += 3;
        newState.security += 2;
        logMsg = '你清理了围墙外的丧尸残骸。';
        break;
      case 'RADIO':
        newState.threat += 5;
        logMsg = '你尝试破译电台讯号... 似乎被不怀好意的人注意到了。';
        break;
      case 'SCOUT':
        logMsg = '你侦查了周边，今晚可能会有袭击。';
        break;
      default:
        logMsg = '你度过了一段时光。';
    }

    // 推进时间
    newState.timeSlot += 1;
    newState.logs = [...newState.logs, `[${actionId}] ${logMsg}`];

    // 随机触发事件 (30%概率)
    const rand = Math.random();
    if (rand < 0.3) {
      const evt = EVENTS[Math.floor(Math.random() * EVENTS.length)];
      setGameState(newState);
      setTimeout(() => setShowEvent(evt), 100); 
    } else {
      setGameState(newState);
    }
  };

  // 序章动作执行器 (查表)
  const executePrologueAction = (actionId: string) => {
    const actionConfig = PROLOGUE_ACTIONS.find(a => a.id === actionId);
    if (!actionConfig) return;

    // 执行效果
    const result = actionConfig.effect(gameState);
    
    // 处理更新
    setGameState(prev => {
        let newState = { ...prev };
        
        // 合并更新 (简单浅合并，如果需要深层合并需注意)
        // config 中返回的 update 结构通常是 { prologue: {...}, resources: {...} }
        if (result.updates) {
            // 手动处理 prologue 和 resources 的合并，防止覆盖整个对象
            const updates = result.updates as any;
            if (updates.prologue) {
                newState.prologue = { ...newState.prologue, ...updates.prologue };
            }
            if (updates.resources) {
                newState.resources = { ...newState.resources, ...updates.resources };
            }
            if (updates.morale) {
                newState.morale = updates.morale;
            }
            
            // 特殊处理：如果是锻炼，增加属性 (这里简单硬编码，理想情况应在 config 里做，但 config 不好操作 Character 对象)
            if (actionId === 'HOME_TRAIN') {
                const char = { ...newState.characters[0] };
                char.growthRates = { ...char.growthRates };
                char.growthRates[StatType.STR] += 0.02;
                newState.characters = [char];
            }
        }
        
        newState.logs = [...newState.logs, `[${actionConfig.label}] ${result.log}`];
        return newState;
    });

    // 处理特殊事件触发
    if (result.specialEvent) {
        if (result.specialEvent === 'TRIGGER_EQUIP_ALERT') {
            setTimeout(() => setShowEquipAlert(true), 500);
        } else if (result.specialEvent === 'TRIGGER_COMBAT_PROLOGUE') {
            setCombatType('PROLOGUE');
            setTimeout(() => setShowCombat(true), 500);
        } else if (result.specialEvent === 'TRIGGER_COMBAT_BOSS') {
            setCombatType('BOSS');
            setTimeout(() => setShowCombat(true), 500);
        } else if (result.specialEvent === 'TRIGGER_PROLOGUE_EVENT') {
            // 处理序章事件，例如房间探索事件
            if (newState.prologue.activeEventId) { // Use newState here
                const eventId = newState.prologue.activeEventId;
                const match = eventId.match(/ROOM_EXPLORE_(\d+)-(\d+)/);
                if (match) {
                    const floor = parseInt(match[1]);
                    const roomNum = parseInt(match[2]);
                    const roomEvent = getRoomExplorationEvent(floor, roomNum);
                    setTimeout(() => setShowEvent(roomEvent), 100);
                }
            }
        }
    }
  };


  // 2. 事件选择回调
  const handleEventChoice = (choiceIdx: number) => {
    if (!showEvent) return;
    const choice = showEvent.choices[choiceIdx];
    
    // 对 EventModal 返回的 updates 进行特殊处理，因为 prologueEvent 的 updates 是 GameState partial
    const updateResult = choice.effect(gameState) as Partial<GameState>;
    
    setGameState(prev => {
        let newState = { ...prev };
        if (updateResult.prologue) {
            newState.prologue = { ...newState.prologue, ...updateResult.prologue };
        }
        if (updateResult.resources) {
            newState.resources = { ...newState.resources, ...updateResult.resources };
        }
        // Logs from event choices are appended to existing logs
        if (updateResult.logs) {
            newState.logs = [...newState.logs, ...updateResult.logs];
        }
        if (updateResult.morale !== undefined) { // Check for undefined, not just falsy
            newState.morale = updateResult.morale;
        }

        // Reset activeEventId if this was a prologue event
        if (prev.prologue.activeEventId && newState.prologue) {
            newState.prologue.activeEventId = undefined;
        }

        return newState;
    });
    setShowEvent(null);
  };

  // 3. 进入夜战
  const startNightPhase = () => {
    setGameState(prev => ({ ...prev, timeSlot: TimeSlot.NIGHT }));
    setShowCombat(true);
  };

  // 4. 夜战结束回调
  const handleCombatEnd = (result: any) => {
    setShowCombat(false);
    
    // --- 序章战斗1：门口枯尸 ---
    if (combatType === 'PROLOGUE') {
        setGameState(prev => {
            if (result.won) {
                // 胜利：进入楼道阶段
                const newState = { ...prev };
                newState.prologue.location = 'CORRIDOR';
                newState.characters = result.survivingCharacters;
                newState.logs = [...prev.logs, '战斗胜利！你击碎了枯尸的头颅。推开防盗门，外面是阴森的【楼道】。你必须清理这一层。'];
                return newState;
            } else {
                return { ...prev, gameOver: true, logs: [...prev.logs, '你被门口的丧尸咬断了喉咙... (序章失败)'] };
            }
        });
        return;
    }

    // --- 序章战斗2：电梯BOSS ---
    if (combatType === 'BOSS') {
        setGameState(prev => {
            if (result.won) {
                // 序章通关！
                const newState = { ...prev };
                newState.characters = result.survivingCharacters;
                newState.prologue.isActive = false; // 关闭序章
                newState.day = 1;
                newState.timeSlot = TimeSlot.MORNING;
                // 给予初始资源
                newState.resources = { food: 5, materials: 5, zombieParts: 2, crystals: 1, meds: 1 };
                newState.security = 10;
                newState.logs = [
                    ...prev.logs, 
                    '【序章结束】',
                    '你成功击杀了盘踞在电梯井的怪物，并将电梯门封死。',
                    '现在，这层楼暂时是安全的。你以此为据点，开始了在这末世小区的生存之旅...',
                    '----- 正式游戏开始：第 1 天 清晨 -----'
                ];
                return newState;
            } else {
                return { ...prev, gameOver: true, logs: [...prev.logs, '你倒在了电梯怪物触手下... (序章失败)'] };
            }
        });
        return;
    }

    // --- 正常夜战结算 ---
    setGameState(prev => {
        const newState = { ...prev };
        newState.characters = result.survivingCharacters;
        
        if (result.won) {
            newState.morale = Math.min(300, newState.morale + 10);
            newState.resources.zombieParts += 5;
            newState.resources.crystals += 1;
        } else {
            newState.security = Math.max(0, newState.security - 30);
            newState.morale = Math.max(0, newState.morale - 50);
            if (newState.security <= 0) {
                newState.disasterCount += 1;
            }
        }

        newState.day += 1;
        newState.timeSlot = TimeSlot.MORNING;
        newState.resources.food = Math.max(0, newState.resources.food - newState.characters.length * 2);
        
        if (newState.resources.food === 0) {
             newState.morale -= 30;
             newState.logs.push("食物耗尽！大家饿着肚子，士气低落。");
        }

        if (newState.disasterCount >= 3) {
            newState.gameOver = true;
        }

        newState.logs.push(`----- 第 ${newState.day} 天开始 -----`);
        return newState;
    });
  };

  // 5. 打开抽卡
  const openGacha = (charId: string) => setShowGacha(charId);
  const confirmGacha = (candidate: GachaCandidate) => {
    if (!showGacha) return;
    setGameState(prev => {
      const charIndex = prev.characters.findIndex(c => c.id === showGacha);
      if (charIndex === -1) return prev;
      if (prev.resources.crystals < 1) {
          alert("丧尸结晶不足！");
          return prev;
      }
      const newChars = [...prev.characters];
      const char = { ...newChars[charIndex] };
      char.growthRates = candidate.newGrowthRates;
      if (candidate.bonusTrait) char.traits = [...char.traits, candidate.bonusTrait];
      newChars[charIndex] = char;
      return {
          ...prev,
          resources: { ...prev.resources, crystals: prev.resources.crystals - 1 },
          characters: newChars,
          logs: [...prev.logs, `${char.name} 完成了世界线观测，潜力发生了变化！`]
      };
    });
    setShowGacha(null);
  };

  // --- 动态计算可用行动 ---
  const getActions = (): ActionDefinition[] => {
    // 1. 序章逻辑 (动态查表)
    if (gameState.prologue.isActive) {
        // 根据 condition 筛选
        return PROLOGUE_ACTIONS
            .filter(act => !act.condition || act.condition(gameState))
            .map(act => ({
                id: act.id,
                label: act.label,
                desc: act.desc
            }));
    }

    // 2. 正常游戏逻辑
    return [
        { id: 'EXPLORE', label: '探索住宅', desc: '搜索物资，清理丧尸' },
        { id: 'TRAIN', label: '健身锻炼', desc: '提升属性 (STR/CON)' },
        { id: 'FARM', label: '楼顶种菜', desc: '消耗种子，数日后收获食物' },
        { id: 'CRAFT', label: '手工制作', desc: '制作装备或加固材料' },
        { id: 'REST', label: '回家休息', desc: '恢复HP，清除负面状态' },
        { id: 'FORTIFY', label: '设施加固', desc: '消耗材料，提升安居率' },
        { id: 'MEDICAL', label: '医疗救助', desc: '治疗伤势，使用药品' },
        { id: 'SCAVENGE', label: '残骸清扫', desc: '回收丧尸材料' },
        { id: 'RADIO', label: '电台破译', desc: '获取情报 (有风险)' },
        { id: 'SCOUT', label: '周边侦查', desc: '预测今晚袭击强度' },
    ];
  };

  // --- 渲染 ---

  if (gameState.gameOver) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-red-900 text-white p-8 text-center">
        <h1 className="text-6xl font-bold mb-4">GAME OVER</h1>
        <p className="text-2xl">生存挑战失败。</p>
        <p className="mt-4 text-gray-300">生存天数: {gameState.day}</p>
        <Button className="mt-8" onClick={() => window.location.reload()}>重新开始</Button>
      </div>
    );
  }

  const targetChar = gameState.characters.find(c => c.id === showGacha);

  // 获取当前序章场景描述
  const prologueFlavor = gameState.prologue.isActive 
    ? PROLOGUE_LOCATIONS[gameState.prologue.location] 
    : null;
  const currentExploration = calculateExploration(gameState.prologue);

  return (
    <div className="h-screen w-full bg-gray-900 flex flex-col md:flex-row overflow-hidden">
      
      {/* 左侧：操作区 */}
      <div className="w-full md:w-2/3 flex flex-col p-4 gap-4 h-1/2 md:h-full order-2 md:order-1">
        {/* 顶部日志区 */}
        <div className="bg-black bg-opacity-30 p-2 rounded h-32 overflow-y-auto text-sm text-gray-400 font-mono scrollbar-hide border border-gray-800 flex flex-col-reverse">
           {gameState.logs.slice().reverse().map((log, i) => <div key={i}>{log}</div>)}
        </div>

        {/* 当前目标 */}
        {gameState.prologue.isActive && (
            <Card className="border-green-700 bg-gray-800/80 shadow-lg px-4 py-2">
                <p className="text-sm font-bold text-green-300">目标: {getCurrentObjective()}</p>
            </Card>
        )}

        {/* 场景描述卡片 (新增) */}
        {prologueFlavor && (
            <Card className="border-blue-900 bg-gray-800/80 shadow-lg">
                <div className="flex justify-between items-center mb-2 border-b border-gray-700 pb-1">
                    <h3 className="text-xl font-serif text-blue-200">{prologueFlavor.name}</h3>
                    {gameState.prologue.location === 'CORRIDOR' && (
                        <div className="text-xs text-yellow-500 font-bold bg-black bg-opacity-50 px-2 py-1 rounded">
                            探索度: {currentExploration}%
                        </div>
                    )}
                </div>
                <div className="text-sm text-gray-300 leading-relaxed mb-2 whitespace-pre-wrap">
                    {typeof prologueFlavor.baseDesc === 'function' 
                        ? prologueFlavor.baseDesc(gameState) 
                        : prologueFlavor.baseDesc}
                </div>
                <div className="text-xs text-gray-500 italic border-l-2 border-gray-600 pl-2">
                    {prologueFlavor.functionDesc}
                </div>
            </Card>
        )}

        {/* 核心行动面板 */}
        <div className="flex-1 bg-gray-800 rounded-lg p-1 border border-gray-700 overflow-hidden relative">
           <ActionPanel 
             timeSlot={gameState.timeSlot} 
             actions={getActions()}
             onAction={handleAction} 
             disabled={!!showEvent} 
             isPrologue={gameState.prologue.isActive}
           />
        </div>
      </div>

      {/* 右侧：状态区 */}
      <div className="w-full md:w-1/3 bg-gray-950 p-4 border-l border-gray-800 h-1/2 md:h-full order-1 md:order-2 overflow-hidden">
         <StatusPanel state={gameState} onOpenGacha={openGacha} />
      </div>

      {/* 模态框层 */}
      {showEvent && <EventModal event={showEvent} onChoice={handleEventChoice} />}
      
      {showGacha && targetChar && (
        <WorldLineGacha 
           character={targetChar} 
           crystals={gameState.resources.crystals} 
           onClose={() => setShowGacha(null)}
           onConfirm={confirmGacha}
        />
      )}

      {showCombat && (
        <NightCombat 
            state={gameState} 
            customEnemies={
                combatType === 'PROLOGUE' 
                ? [{ ...ENEMY_TEMPLATES['ZOMBIE_WALKER'], id: 'prologue_zombie', name: '门口的枯尸' }] 
                : combatType === 'BOSS'
                ? [{ ...ENEMY_TEMPLATES['BOSS_ELEVATOR'] }]
                : undefined
            }
            onCombatEnd={handleCombatEnd} 
        />
      )}

      {/* 装备提示弹窗 */}
      {showEquipAlert && (
        <Modal title="获得新装备">
            <div className="text-center p-4">
                <p className="text-lg text-yellow-400 mb-4">获得武器：【撬棍】</p>
                <p className="text-gray-300 mb-6">一把沉重的铁质撬棍，既是工具也是防身利器。</p>
                <Button variant="primary" onClick={() => handleAction('PROLOGUE_EQUIP_CROWBAR')}>
                    立即装备
                </Button>
            </div>
        </Modal>
      )}
      
    </div>
  );
};

export default App;
