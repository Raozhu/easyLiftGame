
import { JobType, StatType, GameEvent, Enemy } from './types';

// ----------------------
// 职业基础数值配置
// ----------------------
export const JOB_BASE_STATS: Record<JobType, Record<string, number>> = {
  [JobType.GUARD]: { baseHp: 140, baseAtk: 10, baseDef: 15, baseSpd: 8, baseAcc: 80, baseEva: 5, baseCrt: 5 },
  [JobType.WARRIOR]: { baseHp: 100, baseAtk: 15, baseDef: 10, baseSpd: 10, baseAcc: 90, baseEva: 10, baseCrt: 10 },
  [JobType.ASSASSIN]: { baseHp: 70, baseAtk: 20, baseDef: 5, baseSpd: 18, baseAcc: 95, baseEva: 25, baseCrt: 25 },
  [JobType.RANGER]: { baseHp: 65, baseAtk: 18, baseDef: 6, baseSpd: 14, baseAcc: 110, baseEva: 15, baseCrt: 20 },
  [JobType.ESPER]: { baseHp: 70, baseAtk: 22, baseDef: 7, baseSpd: 9, baseAcc: 100, baseEva: 10, baseCrt: 15 },
  [JobType.SUPPORT]: { baseHp: 80, baseAtk: 8, baseDef: 8, baseSpd: 11, baseAcc: 90, baseEva: 12, baseCrt: 5 },
};

// 初始成长模板 (对应 F/E/D/C 等级)
export const INITIAL_GROWTHS: Record<JobType, Record<StatType, number>> = {
  [JobType.GUARD]: { STR: 0.4, DEX: 0.05, CON: 0.6, INT: 0.05, PER: 0.2, CHA: 0.2 },
  [JobType.WARRIOR]: { STR: 0.5, DEX: 0.2, CON: 0.4, INT: 0.1, PER: 0.3, CHA: 0.3 },
  [JobType.ASSASSIN]: { STR: 0.2, DEX: 0.6, CON: 0.2, INT: 0.1, PER: 0.5, CHA: 0.1 },
  [JobType.RANGER]: { STR: 0.2, DEX: 0.5, CON: 0.2, INT: 0.2, PER: 0.6, CHA: 0.1 },
  [JobType.ESPER]: { STR: 0.05, DEX: 0.2, CON: 0.2, INT: 0.7, PER: 0.4, CHA: 0.2 },
  [JobType.SUPPORT]: { STR: 0.1, DEX: 0.3, CON: 0.3, INT: 0.4, PER: 0.3, CHA: 0.6 },
};

// ----------------------
// 敌人池
// ----------------------
export const ENEMY_TEMPLATES: Record<string, Enemy> = {
  'ZOMBIE_WALKER': { id: 'walker', name: '枯尸', hp: 80, maxHp: 80, atk: 15, def: 2, spd: 5, acc: 80, eva: 0, isElite: false },
  'ZOMBIE_RUNNER': { id: 'runner', name: '奔跑者', hp: 50, maxHp: 50, atk: 20, def: 1, spd: 20, acc: 90, eva: 15, isElite: false },
  'ZOMBIE_TANK': { id: 'tank', name: '重装丧尸', hp: 200, maxHp: 200, atk: 25, def: 20, spd: 4, acc: 70, eva: 0, isElite: true },
  'BOSS_ELEVATOR': { id: 'boss_elevator', name: '电梯梦魇', hp: 350, maxHp: 350, atk: 25, def: 5, spd: 7, acc: 85, eva: 0, isElite: true },
};

// ----------------------
// 事件库 (示例)
// ----------------------
export const EVENTS: GameEvent[] = [
  {
    id: 'evt_survivor_meet',
    title: '幸存者的踪迹',
    description: '你在探索B栋时，发现一间反锁的房间里传出微弱的声音。',
    choices: [
      {
        text: '破门而入',
        effect: (state) => ({
          resources: { ...state.resources, food: state.resources.food + 2, materials: state.resources.materials + 1 },
          logs: [...state.logs, '你破开门，里面的人已经离开了，但留下了一些物资。']
        })
      },
      {
        text: '呼喊询问',
        effect: (state) => ({
          morale: Math.min(300, state.morale + 10),
          logs: [...state.logs, '里面传出感谢声，对方虽然不敢开门，但和你交流了一会儿，你们感到不再孤单。']
        })
      }
    ]
  },
  {
    id: 'evt_broken_pipe',
    title: '水管破裂',
    description: '小区的供水管道似乎出现问题，如果不修理，可能会影响士气。',
    choices: [
      {
        text: '消耗材料修理 (材料-2)',
        effect: (state) => {
          if (state.resources.materials >= 2) {
             return {
                resources: { ...state.resources, materials: state.resources.materials - 2 },
                security: Math.min(100, state.security + 5),
                logs: [...state.logs, '你修好了水管，大家的用水得到了保障。安居率上升。']
             };
          } else {
             return {
                morale: Math.max(0, state.morale - 10),
                logs: [...state.logs, '材料不足，无法修理！大家对此抱怨纷纷。士气下降。']
             };
          }
        }
      },
      {
        text: '无视',
        effect: (state) => ({
           morale: Math.max(0, state.morale - 5),
           logs: [...state.logs, '你决定暂时无视这个问题。']
        })
      }
    ]
  }
];

// 初始状态生成器
export const INITIAL_GAME_STATE: any = {
  day: 1,
  timeSlot: 0,
  resources: { food: 0, materials: 0, zombieParts: 0, crystals: 0, meds: 0 }, // 序章初始资源全空
  security: 0,
  threat: 0,
  morale: 100,
  disasterCount: 0,
  characters: [],
  prologue: {
    isActive: true,
    location: 'HOME',
    flags: {},         // 使用新的 flag 系统
    nodeProgress: {},   // 使用新的节点探索系统
    currentFloor: 5,    // 默认从5楼开始
    exploredRooms: []   // 已探索的房间 ID
  },
  activeEvent: null,
  logs: ['你从昏迷中醒来...', '头痛欲裂，门外似乎有什么东西在疯狂撞击。'],
  gameOver: false,
  gameWon: false
};
