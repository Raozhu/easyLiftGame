
// 基础属性枚举
export enum StatType {
  STR = 'STR', // 力量
  DEX = 'DEX', // 敏捷
  CON = 'CON', // 体质
  INT = 'INT', // 智力
  PER = 'PER', // 感知
  CHA = 'CHA'  // 魅力
}

// 职业枚举
export enum JobType {
  GUARD = 'GUARD',   // 守卫
  WARRIOR = 'WARRIOR', // 战士
  ASSASSIN = 'ASSASSIN', // 刺客
  RANGER = 'RANGER',   // 射手
  ESPER = 'ESPER',    // 异能者
  SUPPORT = 'SUPPORT'  // 支援
}

// 时间段枚举
export enum TimeSlot {
  MORNING = 0,    // 清晨
  NOON = 1,       // 上午
  AFTERNOON = 2,  // 下午
  DUSK = 3,       // 黄昏
  NIGHT = 4,      // 夜晚 (行动阶段)
  SLEEP = 5       // 深夜 (战斗阶段)
}

// 角色数据结构
export interface Character {
  id: string;
  name: string;
  job: JobType;
  level: number;
  exp: number;
  
  // 核心：当前成长值 (浮点数，如 0.05, 1.2 等)
  growthRates: Record<StatType, number>;
  
  // 当前生命值 (最大生命值通过公式动态计算)
  currentHp: number;
  
  // 世界线同步度 (简化版：针对某一条主线的同步分)
  syncScore: number;
  
  // 已觉醒特性/技能 (简化为字符串ID)
  traits: string[];

  // 当前装备 (简化：主武器名称)
  equipment: string | null;
}

// 战斗面板属性 (计算后)
export interface CombatStats {
  hpMax: number;
  atk: number;
  def: number;
  spd: number;
  acc: number; // 命中评级
  eva: number; // 闪避评级
  crt: number; // 暴击评级
}

// 资源结构
export interface Resources {
  food: number;         // 食物
  materials: number;    // 通用材料
  zombieParts: number;  // 丧尸材料
  crystals: number;     // 丧尸结晶 (抽卡资源)
  meds: number;         // 药品
}

// ----------------------
// 序章新系统类型定义
// ----------------------

export type PrologueLocationId = 'HOME' | 'CORRIDOR';

// 序章状态追踪
export interface PrologueState {
  isActive: boolean;        
  location: PrologueLocationId;
  
  // 通用标记 (代替原来的 searchCount, hasPeeped 等硬编码字段)
  // 例如: { 'found_crowbar': true, 'checked_tv': true }
  flags: Record<string, boolean>;

  // 节点探索深度 (用于计算探索率)
  // key 是 actionId 或 nodeId, value 是当前探索层数 (0, 1, 2...)
  nodeProgress: Record<string, number>;
}

// 游戏全局状态
export interface GameState {
  day: number;
  timeSlot: TimeSlot;
  
  resources: Resources;
  
  // 小区状态
  security: number;     // 安居率 (0-100)
  threat: number;       // 威胁度
  morale: number;       // 士气 (0-300)
  disasterCount: number; // 灾变计数
  
  // 序章状态
  prologue: PrologueState;

  // 角色列表 (idx 0 为主角)
  characters: Character[];
  
  // 当前队列中的事件
  activeEvent: GameEvent | null;
  
  // 日志
  logs: string[];

  // 游戏结束标记
  gameOver: boolean;
  gameWon: boolean;
}

// 事件结构
export interface GameEventChoice {
  text: string;
  effect: (state: GameState) => Partial<GameState>; // 返回需要更新的状态片段
}

export interface GameEvent {
  id: string;
  title: string;
  description: string;
  choices: GameEventChoice[];
}

// 敌人结构
export interface Enemy {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  spd: number;
  acc: number;
  eva: number;
  isElite: boolean;
}

// 抽卡候选结果结构
export interface GachaCandidate {
  rank: 'SILVER' | 'GOLD' | 'RAINBOW'; // 银/金/彩
  score: number;
  newGrowthRates: Record<StatType, number>;
  deltas: Record<StatType, number>; // 变化量，用于UI展示 (e.g. +0.25)
  bonusTrait?: string; // 附带特性
}

// 行动定义 (用于UI渲染)
export interface ActionDefinition {
  id: string;
  label: string;
  desc: string;
  disabled?: boolean;
  hidden?: boolean;
}
