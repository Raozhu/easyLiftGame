
import { Character, CombatStats, StatType, JobType, GameState, TimeSlot, GachaCandidate, Enemy, Resources } from '../types';
import { JOB_BASE_STATS, ENEMY_TEMPLATES } from '../constants';

// ==========================================
// 数值推导系统 (Stats Calculation)
// ==========================================

// 辅助：Clamp函数
const clamp = (num: number, min: number, max: number) => Math.min(Math.max(num, min), max);

/**
 * 根据等级和成长值计算角色的实时面板
 * 实现文档 section 15 的公式
 */
export const calculateStats = (char: Character): CombatStats => {
  const base = JOB_BASE_STATS[char.job];
  const lv = char.level;
  
  // 基础六维 (简化：成长值 * 等级 + 基础修正)
  const STR = char.growthRates[StatType.STR] * lv * 10;
  const DEX = char.growthRates[StatType.DEX] * lv * 10;
  const CON = char.growthRates[StatType.CON] * lv * 10;
  const INT = char.growthRates[StatType.INT] * lv * 10;
  const PER = char.growthRates[StatType.PER] * lv * 10;
  const CHA = char.growthRates[StatType.CHA] * lv * 10;

  // HP 计算 (k_con:k_str ≈ 3:1)
  const hpMax = Math.floor(base.baseHp + (CON * 3) + (STR * 1));

  // ATK 计算
  let atk = 0;
  if ([JobType.GUARD, JobType.WARRIOR].includes(char.job)) {
    atk = base.baseAtk + STR * 2 + DEX * 0.5;
  } else if ([JobType.ASSASSIN, JobType.RANGER].includes(char.job)) {
    atk = base.baseAtk + STR * 0.5 + DEX * 2;
  } else {
    // 异能/支援
    atk = base.baseAtk + INT * 1.5 + PER * 0.5;
  }

  // 特殊装备加成：撬棍 (检查 equipment 字段)
  if (char.equipment === '撬棍') {
    atk += 15;
  }

  // DEF 计算 (CON为主，STR为辅)
  const def = Math.floor(base.baseDef + CON * 1.5 + STR * 0.5);

  // SPD 计算
  const spd = Math.floor(base.baseSpd + DEX * 0.8 + PER * 0.2);

  // 命中/闪避/暴击 (评级)
  const acc = Math.floor(base.baseAcc + PER * 1.5 + DEX * 0.5);
  const eva = Math.floor(base.baseEva + DEX * 1.2 + PER * 0.5);
  const crt = Math.floor(base.baseCrt + DEX * 1.0 + PER * 0.5);

  return {
    hpMax,
    atk: Math.floor(atk),
    def,
    spd,
    acc,
    eva,
    crt
  };
};

// ==========================================
// 战斗模拟系统 (Simple Auto-Battler)
// ==========================================

export interface CombatLog {
  turn: number;
  message: string;
  isPlayerAction: boolean;
}

export interface CombatResult {
  won: boolean;
  logs: CombatLog[];
  survivingCharacters: Character[]; // 返回存活状态
  damageTaken: Record<string, number>; // 记录伤害用于更新GameState
}

/**
 * 模拟一场夜战 (单入口)
 * 实现文档 section 8 & 9 的战斗公式
 */
export const simulateCombat = (characters: Character[], enemies: Enemy[], morale: number): CombatResult => {
  const logs: CombatLog[] = [];
  let turnCount = 1;
  
  // 战斗实体包装器
  interface CombatUnit {
    isPlayer: boolean;
    id: string;
    name: string;
    stats: CombatStats; // 或是 Enemy 的属性
    currentHp: number;
    maxHp: number;
    actionBar: number; // 行动条 0-1000
    sourceRef: Character | Enemy;
  }

  // 初始化战斗单位
  const units: CombatUnit[] = [
    ...characters.map(c => ({
      isPlayer: true,
      id: c.id,
      name: c.name,
      stats: calculateStats(c),
      currentHp: c.currentHp, // 继承当前血量
      maxHp: calculateStats(c).hpMax,
      actionBar: 0,
      sourceRef: c
    })),
    ...enemies.map(e => ({
      isPlayer: false,
      id: e.id,
      name: e.name,
      stats: { ...e, hpMax: e.maxHp, crt: 5 }, // 简化的 Enemy stats
      currentHp: e.hp,
      maxHp: e.maxHp,
      actionBar: 0,
      sourceRef: e
    }))
  ];

  logs.push({ turn: 0, message: `战斗开始！我方 ${characters.length} 人 vs 敌方 ${enemies.length} 体`, isPlayerAction: true });

  let battleOver = false;
  let playerWon = false;
  const MAX_CYCLES = 200; // 增加循环上限防止过早超时
  let cycles = 0;

  // 士气伤害系数 (section 6)
  let damageMulMorale = 1.0;
  if (morale < 100) damageMulMorale = 0.4 + 0.6 * (morale / 100);
  else if (morale >= 300) damageMulMorale = 1.6;
  else if (morale >= 250) damageMulMorale = 1.4;
  else if (morale >= 200) damageMulMorale = 1.2;
  else if (morale >= 150) damageMulMorale = 1.1;

  // 受伤系数 (低士气更易受伤)
  const damageTakenMul = morale < 100 ? 1.0 + 0.5 * (1 - morale / 100) : 1.0;

  while (!battleOver && cycles < MAX_CYCLES) {
    cycles++;
    
    // 1. 行动条增长
    // 为了防止所有人都行动条不足的情况，强制增加直到有人能行动
    let anyoneCanAct = false;
    let tickSafety = 0;
    while (!anyoneCanAct && tickSafety < 50) {
        units.forEach(u => {
            if (u.currentHp > 0) {
                u.actionBar += u.stats.spd * 5; 
                if (u.actionBar >= 1000) anyoneCanAct = true;
            }
        });
        tickSafety++;
    }

    // 2. 寻找行动者 (溢出最多的先动)
    const activeCandidates = units.filter(u => u.currentHp > 0 && u.actionBar >= 1000);
    activeCandidates.sort((a, b) => b.actionBar - a.actionBar);
    
    const activeUnit = activeCandidates[0];
    
    if (activeUnit) {
      activeUnit.actionBar -= 1000;
      
      // 3. 选择目标
      const targets = units.filter(u => u.isPlayer !== activeUnit.isPlayer && u.currentHp > 0);
      if (targets.length === 0) {
        battleOver = true;
        playerWon = activeUnit.isPlayer;
        break;
      }
      // 简单AI：打血量最低的 (收残)
      const target = targets.sort((a, b) => a.currentHp - b.currentHp)[0];

      // 4. 命中判定
      const hitDelta = activeUnit.stats.acc - target.stats.eva;
      const baseHit = 0.9 + hitDelta / 500.0;
      const finalHit = clamp(baseHit, 0.30, 0.98);
      const isHit = Math.random() <= finalHit;

      if (!isHit) {
        logs.push({ turn: turnCount, message: `${activeUnit.name} 攻击 ${target.name}，但是 MISS 了！`, isPlayerAction: activeUnit.isPlayer });
      } else {
        // 5. 暴击判定
        const critChance = clamp(activeUnit.stats.crt / (activeUnit.stats.crt + 200.0), 0.05, 1.0);
        const isCrit = Math.random() <= critChance;
        const critMul = isCrit ? 1.5 : 1.0;

        // 6. 伤害计算
        const skillPower = 1.0; // 普攻
        const atkEff = activeUnit.stats.atk * skillPower;
        const defEff = target.stats.def * 0.8;
        const rawDamage = atkEff - defEff;
        const baseDamage = Math.max(rawDamage, activeUnit.stats.atk * 0.25);
        const randMul = 0.9 + Math.random() * 0.2; // 0.9-1.1

        // 应用士气系数
        let finalDamage = baseDamage * randMul * critMul;
        if (activeUnit.isPlayer) {
          finalDamage *= damageMulMorale;
        } else {
          finalDamage *= damageTakenMul;
        }

        finalDamage = Math.floor(Math.max(finalDamage, 1));
        
        target.currentHp -= finalDamage;
        if (target.currentHp < 0) target.currentHp = 0;
        
        const critText = isCrit ? " [暴击!]" : "";
        logs.push({ 
          turn: turnCount, 
          message: `${activeUnit.name} 对 ${target.name} 造成 ${finalDamage} 点伤害${critText}。(${target.currentHp <= 0 ? '击杀' : 'HP:' + target.currentHp})`, 
          isPlayerAction: activeUnit.isPlayer 
        });

        if (target.currentHp <= 0) {
          // Check win condition immediately
          if (units.filter(u => u.isPlayer !== activeUnit.isPlayer && u.currentHp > 0).length === 0) {
            battleOver = true;
            playerWon = activeUnit.isPlayer;
            break;
          }
        }
      }
      turnCount++;
    }
  }

  // 整理结果
  const damageTakenRecord: Record<string, number> = {};
  const survivingChars: Character[] = [];
  
  units.forEach(u => {
    if (u.isPlayer) {
      damageTakenRecord[u.id] = (u.sourceRef as Character).currentHp - u.currentHp;
      survivingChars.push({
        ...(u.sourceRef as Character),
        currentHp: u.currentHp
      });
    }
  });

  if (cycles >= MAX_CYCLES) {
     logs.push({ turn: turnCount, message: "战斗胶着...双方暂时罢兵。", isPlayerAction: false });
  }
  
  logs.push({ turn: turnCount, message: playerWon ? "战斗胜利！" : "战斗失败！", isPlayerAction: playerWon });

  return {
    won: playerWon,
    logs,
    survivingCharacters: survivingChars,
    damageTaken: damageTakenRecord
  };
};

// ==========================================
// 世界线观测系统 ("俺寻思" - World Line Gacha)
// ==========================================

/**
 * 生成3个成长变异候选
 * 实现文档 section 17
 */
export const generateGachaCandidates = (char: Character): GachaCandidate[] => {
  const candidates: GachaCandidate[] = [];
  
  for (let i = 0; i < 3; i++) {
    const newGrowth: Record<StatType, number> = { ...char.growthRates };
    const deltas: Record<StatType, number> = {} as any;
    let totalScore = 0;

    // 遍历六维进行变异
    (Object.keys(newGrowth) as StatType[]).forEach(stat => {
      const rand = Math.random();
      let delta = 0;
      
      // 变异类型概率
      if (rand < 0.50) {
        // 稳态: -0.05 ~ +0.05
        delta = (Math.random() * 0.10) - 0.05;
      } else if (rand < 0.75) {
        // 良性: +0.10 ~ +0.20
        delta = (Math.random() * 0.10) + 0.10;
        totalScore += 10;
      } else if (rand < 0.95) {
        // 恶性: -0.20 ~ -0.10
        delta = (Math.random() * 0.10) - 0.20;
        totalScore -= 15;
      } else {
        // 天选: +0.25 ~ +0.35
        delta = (Math.random() * 0.10) + 0.25;
        totalScore += 30;
      }
      
      // 简单截断显示两位小数
      delta = Math.round(delta * 100) / 100;
      
      let val = newGrowth[stat] + delta;
      val = clamp(val, 0.01, 1.5); // 成长值硬限制
      
      newGrowth[stat] = Number(val.toFixed(2));
      deltas[stat] = delta;
      
      // 简单的分数加权，假设主要属性分更高 (简化)
      totalScore += delta * 100; 
    });

    // 评级
    let rank: 'SILVER' | 'GOLD' | 'RAINBOW' = 'SILVER';
    if (totalScore > 40) rank = 'RAINBOW';
    else if (totalScore > 15) rank = 'GOLD';

    // 概率附带特性 (简化：纯随机给个Mock特性)
    let bonusTrait: string | undefined = undefined;
    const traitChance = rank === 'RAINBOW' ? 0.8 : (rank === 'GOLD' ? 0.3 : 0.05);
    if (Math.random() < traitChance) {
      const traits = ["坚韧", "夜视", "怪力", "灵感", "领袖气质"];
      bonusTrait = traits[Math.floor(Math.random() * traits.length)];
    }

    candidates.push({
      rank,
      score: totalScore,
      newGrowthRates: newGrowth,
      deltas,
      bonusTrait
    });
  }

  return candidates.sort((a, b) => b.score - a.score); // 按分数排序方便展示
};
