
import { GameState, PrologueLocationId, PrologueState, StatType } from './types';

// ==========================================
// 1. 地点与环境描述 (Location Flavors)
// ==========================================

export interface LocationFlavor {
  id: PrologueLocationId;
  name: string;
  baseDesc: string;      // 基础环境描写
  functionDesc: string;  // 功能性/目标性描写
}

export const PROLOGUE_LOCATIONS: Record<PrologueLocationId, LocationFlavor> = {
  HOME: {
    id: 'HOME',
    name: '自己的房间',
    baseDesc:
      '这是你在末日前最后的据点：一室一厅的老小区住宅。旧沙发上还残留着昨晚的折叠痕迹，茶几上摊着几本来不及收拾的杂志。窗帘紧闭，透出一种压抑的昏黄。',
    functionDesc:
      '这里暂时是安全的，但你很清楚这种安全正在倒计时。你可以整理物资，或者鼓起勇气看向门外。'
  },
  CORRIDOR: {
    id: 'CORRIDOR',
    name: '五楼楼道',
    baseDesc:
      '推开门，一股腐烂与铁锈混合的腥味扑面而来。感应灯接触不良，滋滋作响。你刚刚解决掉的那具尸体倒在门口，暗红色的血迹顺着地砖缝隙，像树根一样缓慢蔓延。',
    functionDesc:
      '这里是你与外界的第一道缓冲区。中间是死寂的电梯，两边通向未知的邻居家。想要活下去，你必须把这层楼变成绝对安全的“据点”。'
  }
};

// ==========================================
// 2. 探索节点权重 (Exploration Weights)
// ==========================================

// 定义哪些 actionId 会贡献探索进度，以及它们的权重（总进度 = sum(currentLevel * weight) / sum(maxLevel * weight)）
export interface ExplorationNode {
  maxLevel: number; // 这个节点最多能探索几次
  weight: number;   // 这个节点对总进度的贡献权重
}

export const EXPLORATION_NODES: Record<string, ExplorationNode> = {
  // 楼道阶段的探索节点
  'COR_NEIGHBOR': { maxLevel: 2, weight: 2 }, // 邻居家：进门1次，搜刮1次
  'COR_END': { maxLevel: 1, weight: 1 },      // 走廊尽头：1次
  'COR_STAIRS': { maxLevel: 1, weight: 1 },   // 楼梯间：1次
  // 电梯不算在探索进度分母里，因为它是BOSS战触发点，但可以作为进度锁
};

// 计算当前探索率 (0-100)
export const calculateExploration = (state: PrologueState): number => {
  // 目前只计算 CORRIDOR 阶段的探索率
  if (state.location !== 'CORRIDOR') return 0;

  let currentScore = 0;
  let maxScore = 0;

  for (const [key, config] of Object.entries(EXPLORATION_NODES)) {
    const currentLevel = state.nodeProgress[key] || 0;
    currentScore += Math.min(currentLevel, config.maxLevel) * config.weight;
    maxScore += config.maxLevel * config.weight;
  }

  if (maxScore === 0) return 0;
  return Math.floor((currentScore / maxScore) * 100);
};

// ==========================================
// 3. 动作配置 (Action Logic)
// ==========================================

export interface PrologueActionConfig {
  id: string;
  label: string;
  desc: string;
  
  // 是否显示该动作
  condition?: (state: GameState) => boolean;
  
  // 执行逻辑：返回更新的状态片段 + 日志文本
  // 特殊返回值：'TRIGGER_COMBAT_PROLOGUE' | 'TRIGGER_COMBAT_BOSS' | 'TRIGGER_EQUIP_ALERT'
  effect: (state: GameState) => { 
    updates?: Partial<GameState> | Partial<PrologueState>; // 支持深层更新比较麻烦，这里简化为由 App 处理混合
    log: string;
    specialEvent?: 'TRIGGER_COMBAT_PROLOGUE' | 'TRIGGER_COMBAT_BOSS' | 'TRIGGER_EQUIP_ALERT'; 
  };
}

export const PROLOGUE_ACTIONS: PrologueActionConfig[] = [
  // -----------------------------------------------------------
  // 阶段一：家里 (HOME)
  // -----------------------------------------------------------
  {
    id: 'HOME_LISTEN',
    label: '贴耳听门',
    desc: '屏住呼吸确认门外动静',
    condition: (s) => s.prologue.location === 'HOME' && !s.prologue.flags['heard_neighbor'],
    effect: (s) => ({
      updates: { prologue: { ...s.prologue, flags: { ...s.prologue.flags, 'heard_neighbor': true } } },
      log: '你把耳朵贴在冰冷的防盗门上。除了那机械的撞门声，你隐约听到一种湿润的喉音，那绝对不是活人能发出的声音... 隔壁王阿姨似乎也没了动静。'
    })
  },
  {
    id: 'HOME_TV',
    label: '打开电视',
    desc: '试图获取外界信息',
    condition: (s) => s.prologue.location === 'HOME' && !s.prologue.flags['checked_tv'],
    effect: (s) => ({
      updates: { prologue: { ...s.prologue, flags: { ...s.prologue.flags, 'checked_tv': true } } },
      log: '你按下遥控器。屏幕上只有雪花点和刺耳的白噪音。信号中断了，互联网也连不上。你现在是一座孤岛。'
    })
  },
  {
    id: 'HOME_BALCONY',
    label: '去阳台看看',
    desc: '观察楼下的情况',
    condition: (s) => s.prologue.location === 'HOME' && !s.prologue.flags['checked_balcony'],
    effect: (s) => ({
      updates: { prologue: { ...s.prologue, flags: { ...s.prologue.flags, 'checked_balcony': true } } },
      log: '你透过窗帘缝隙往下看。小区花园里游荡着几个摇晃的人影。地上散落着几份报纸，标题依稀可见：“不明流感爆发...切勿接触...”。'
    })
  },
  {
    id: 'HOME_PEEP',
    label: '查看猫眼',
    desc: '直面门外的恐惧',
    condition: (s) => s.prologue.location === 'HOME' && !s.prologue.flags['has_peeped'],
    effect: (s) => ({
      updates: { prologue: { ...s.prologue, flags: { ...s.prologue.flags, 'has_peeped': true } } },
      log: '你凑近猫眼... 天哪！门口站着一只浑身干瘪的“枯尸”，它正用头机械地撞击着防盗门！额头已经撞烂了，黑血涂满了你的门镜。如果不行动，你撑不过3天。'
    })
  },
  {
    id: 'HOME_SEARCH',
    label: '搜刮家里',
    desc: '寻找任何能用的东西',
    condition: (s) => s.prologue.location === 'HOME' && (s.prologue.nodeProgress['home_search'] || 0) < 3,
    effect: (s) => {
      const currentLevel = s.prologue.nodeProgress['home_search'] || 0;
      const nextLevel = currentLevel + 1;
      let log = '';
      let specialEvent: any = undefined;

      if (nextLevel === 1) {
        log = '你翻箱倒柜找遍了厨房和客厅。很遗憾，除了半瓶矿泉水，家里已经没有一点吃的了。饥饿感开始上涌。';
      } else if (nextLevel === 2) {
        log = '你不甘心，撬开了床底尘封的工具箱... 找到了一根【撬棍】！这沉甸甸的手感给了你久违的安全感。';
        specialEvent = 'TRIGGER_EQUIP_ALERT';
      } else {
        log = '家里已经被你翻了个底朝天，连沙发缝里的硬币都抠出来了，再也找不到有用的东西。';
      }

      return {
        updates: { prologue: { ...s.prologue, nodeProgress: { ...s.prologue.nodeProgress, 'home_search': nextLevel } } },
        log,
        specialEvent
      };
    }
  },
  // 战斗与成长解锁：需要看过猫眼，且拿到撬棍
  {
    id: 'HOME_FIGHT',
    label: '开门战斗',
    desc: '拿起武器，杀出一条血路',
    condition: (s) => s.prologue.location === 'HOME' && s.prologue.flags['has_peeped'] && (s.prologue.nodeProgress['home_search'] || 0) >= 2,
    effect: (s) => ({
      log: '你深吸一口气，握紧了撬棍，猛地拉开了防盗门！',
      specialEvent: 'TRIGGER_COMBAT_PROLOGUE'
    })
  },
  {
    id: 'HOME_SLEEP',
    label: '睡觉',
    desc: '逃避现实 (精神-10)',
    condition: (s) => s.prologue.location === 'HOME' && s.prologue.flags['has_peeped'],
    effect: (s) => ({
      updates: { morale: Math.max(0, s.morale - 10) },
      log: '你蒙头大睡，试图告诉自己这一切都是梦。但门口那永不停歇的撞击声让你噩梦连连。醒来时，你感到更加疲惫了。'
    })
  },
  {
    id: 'HOME_TRAIN',
    label: '锻炼一下',
    desc: '临阵磨枪 (STR成长+0.02)',
    condition: (s) => s.prologue.location === 'HOME' && s.prologue.flags['has_peeped'] && !s.prologue.flags['trained_today'],
    effect: (s) => {
        // 深层更新 Character 需要 App 处理，这里通过 updates 传递标识或在 App 里做
        // 简单起见，这里只更新 flag，实际属性加成在 App 里的 executeAction 补丁处理，或者这里不做深层更新
        return {
            updates: { prologue: { ...s.prologue, flags: { ...s.prologue.flags, 'trained_today': true } } },
            log: '你在狭窄的客厅做了几组俯卧撑，感觉肌肉稍微充实了一点点。虽然不多，但这让你找回了一点对自己身体的掌控感。'
        };
    }
  },

  // -----------------------------------------------------------
  // 阶段二：楼道 (CORRIDOR)
  // -----------------------------------------------------------
  {
    id: 'COR_LOOK',
    label: '查看环境',
    desc: '仔细观察走廊的痕迹',
    condition: (s) => s.prologue.location === 'CORRIDOR',
    effect: (s) => ({
        log: '走廊的墙壁上满是黑色的手印。地上的血迹有些已经干涸，有些还很新鲜。空气中弥漫着一股说不出的腥甜味。你注意到楼道灯的感应器似乎坏了，必须跺脚才会亮。'
    })
  },
  {
    id: 'COR_NEIGHBOR',
    label: '对门住户',
    desc: '探索邻居家',
    condition: (s) => s.prologue.location === 'CORRIDOR' && (s.prologue.nodeProgress['COR_NEIGHBOR'] || 0) < 2,
    effect: (s) => {
        const lv = s.prologue.nodeProgress['COR_NEIGHBOR'] || 0;
        let log = '';
        let resourceUpdate = {};

        if (lv === 0) {
            log = '你试着推了推对门的门，没锁。这是王老太的家，独居。进门处散落着拐杖和打翻的鞋柜。客厅里虽然乱，但似乎没有血迹。';
        } else {
            log = '你深入到卧室和厨房。在冰箱里你找到了两罐还没有过期的肉罐头，在床头柜里发现了一些止痛药。';
            resourceUpdate = { food: s.resources.food + 2, meds: s.resources.meds + 1 };
        }

        return {
            updates: { 
                prologue: { ...s.prologue, nodeProgress: { ...s.prologue.nodeProgress, 'COR_NEIGHBOR': lv + 1 } },
                resources: { ...s.resources, ...resourceUpdate }
            },
            log
        };
    }
  },
  {
    id: 'COR_END',
    label: '走廊尽头',
    desc: '检查倒地的黑影',
    condition: (s) => s.prologue.location === 'CORRIDOR' && (s.prologue.nodeProgress['COR_END'] || 0) < 1,
    effect: (s) => ({
        updates: { 
            prologue: { ...s.prologue, nodeProgress: { ...s.prologue.nodeProgress, 'COR_END': 1 } },
            resources: { ...s.resources, materials: s.resources.materials + 3 }
        },
        log: '你小心翼翼地走过去。那是一具尸体，穿着快递员的制服。他的手里还紧紧攥着一把美工刀。你忍着恶心搜身，找到了一些可用的零件材料。'
    })
  },
  {
    id: 'COR_STAIRS',
    label: '楼梯间',
    desc: '查看上下楼路况',
    condition: (s) => s.prologue.location === 'CORRIDOR' && (s.prologue.nodeProgress['COR_STAIRS'] || 0) < 1,
    effect: (s) => ({
        updates: { 
            prologue: { ...s.prologue, nodeProgress: { ...s.prologue.nodeProgress, 'COR_STAIRS': 1 } }
        },
        log: '安全门依然沉重。你推开一条缝，楼道里漆黑一片。下方传来密集的脚步声和嘶吼声，上方则死一般的寂静。理智告诉你，现在不是离开这一层的时候。'
    })
  },
  {
    id: 'COR_ELEVATOR',
    label: '电梯前',
    desc: '调查电梯异响 (需探索度100%)',
    condition: (s) => s.prologue.location === 'CORRIDOR',
    effect: (s) => {
        const exploration = calculateExploration(s.prologue);
        if (exploration < 100) {
            return {
                log: `电梯门紧闭着，门缝里渗出黑色的粘液。里面有什么东西正在撞击轿厢。你需要先把周围环境确认安全(当前探索度${exploration}%)，才能专心处理这个大家伙。`
            };
        } else {
            return {
                log: '你用力把撬棍插进电梯门缝，随着金属扭曲的尖啸声，门被撬开了... 里面那个与缆绳融合的怪物转过头来看着你！',
                specialEvent: 'TRIGGER_COMBAT_BOSS'
            };
        }
    }
  },
  {
    id: 'COR_RETURN',
    label: '返回房间',
    desc: '暂时撤退回安全区',
    condition: (s) => s.prologue.location === 'CORRIDOR',
    effect: (s) => ({
        updates: { prologue: { ...s.prologue, location: 'HOME' } },
        log: '你退回了自己的房间，锁好门。外面的恐怖暂时被隔绝了。'
    })
  },
  // 从房间再次出门到楼道
  {
    id: 'HOME_GO_OUT',
    label: '前往楼道',
    desc: '继续探索外部',
    condition: (s) => s.prologue.location === 'HOME' && s.prologue.nodeProgress['home_search'] >= 2 && s.prologue.flags['has_peeped'], // 只要拿到撬棍且知道外面情况就可以出去
    effect: (s) => ({
        updates: { prologue: { ...s.prologue, location: 'CORRIDOR' } },
        log: '你握紧武器，再次推开门走进楼道。'
    })
  }
];
