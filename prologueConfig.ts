import { GameState, PrologueLocationId, PrologueState, StatType } from './types';

// ========================================== 
// 1. 地点与环境描述 (Location Flavors)
// ========================================== 

export interface LocationFlavor {
  id: PrologueLocationId;
  name: string;
  baseDesc: string | ((state: GameState) => string);      // 基础环境描写，支持动态生成
  functionDesc: string;  // 功能性/目标性描写
}

export const PROLOGUE_LOCATIONS: Record<PrologueLocationId, LocationFlavor> = {
  HOME: {
    id: 'HOME',
    name: '自己的房间 (502)',
    baseDesc:
      '这是你在末日前最后的据点：5楼的一室一厅。旧沙发上还残留着昨晚的折叠痕迹，茶几上摊着几本来不及收拾的杂志。窗帘紧闭，透出一种压抑的昏黄。',
    functionDesc:
      '这里暂时是安全的，但你很清楚这种安全正在倒计时。你可以整理物资，或者鼓起勇气看向门外。'
  },
  CORRIDOR: {
    id: 'CORRIDOR',
    name: '楼道',
    baseDesc: (state: GameState) => {
        const floor = state.prologue.currentFloor;
        const rooms = [`${floor}-1`, `${floor}-2`];
        const explored = rooms.filter(r => state.prologue.exploredRooms.includes(r)).length;
        
        let desc = `你现在位于 ${floor} 楼的楼道。`;
        if (floor === 1) desc += ' 一楼大厅的大门被密密麻麻的电线缠绕死锁，那是你通往外界的唯一出口，但似乎需要某种特定的工具或权限才能打开。';
        if (floor === 8) desc += ' 这里是顶楼，天花板上有严重的渗水痕迹。';
        
        desc += `\n空气中弥漫着腐败的气息。这一层的两个住户 (${floor}01, ${floor}02) 探索进度: ${explored}/2。`;
        return desc;
    },
    functionDesc:
      '你可以上下楼层移动，或者破门探索这一层的住户。你的目标是彻底搜索整栋楼 (8层 x 2户)，找到逃离的方法。'
  }
};

// ========================================== 
// 2. 探索进度计算
// ========================================== 

// 计算当前探索率 (0-100)
export const calculateExploration = (state: PrologueState): number => {
  if (state.location !== 'CORRIDOR') return 0;
  
  // 总共 16 个房间
  const totalRooms = 16;
  const currentExplored = state.exploredRooms ? state.exploredRooms.length : 0;
  
  return Math.floor((currentExplored / totalRooms) * 100);
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
  
  // 执行逻辑
  effect: (state: GameState) => { 
    updates?: Partial<GameState> | Partial<PrologueState>; 
    log: string;
    specialEvent?: 'TRIGGER_COMBAT_PROLOGUE' | 'TRIGGER_COMBAT_BOSS' | 'TRIGGER_EQUIP_ALERT' | 'TRIGGER_PROLOGUE_EVENT'; 
  };
}

// ==========================================
// 4. 序章事件配置 (Prologue Specific Events)
// ==========================================

export const getRoomExplorationEvent = (floor: number, roomNum: number): GameEvent => {
    const roomId = `${floor}-${roomNum}`;
    return {
        id: `ROOM_EXPLORE_${roomId}`,
        title: `${floor}0${roomNum} 室：探索`,
        description: `你推开了 ${floor}0${roomNum} 室的大门，里面一片狼藉，是灾难发生后的正常景象。你决定如何搜刮这个房间？`,
        choices: [
            {
                text: '仔细翻找 (耗时更久，收益可能更高)',
                effect: (state) => {
                    const newExplored = [...state.prologue.exploredRooms, roomId];
                    return {
                        prologue: { ...state.prologue, exploredRooms: newExplored, activeEventId: undefined },
                        resources: { ...state.resources, food: state.resources.food + 2, materials: state.resources.materials + 1 },
                        logs: [...state.logs, `你仔细搜刮了 ${floor}0${roomNum} 室，耗费了一些时间。你找到了一些食物和材料。日志暗示你在里面拖了一会儿。`]
                    };
                }
            },
            {
                text: '抓紧时间 (快速搜刮，迅速离开)',
                effect: (state) => {
                    const newExplored = [...state.prologue.exploredRooms, roomId];
                    return {
                        prologue: { ...state.prologue, exploredRooms: newExplored, activeEventId: undefined },
                        resources: { ...state.resources, food: state.resources.food + 1 },
                        logs: [...state.logs, `你快速搜刮了 ${floor}0${roomNum} 室，你刻意压抑住翻看旧照片的冲动，迅速离开。你找到了一些食物。`]
                    };
                }
            }
        ]
    };
};

export const PROLOGUE_STATIC_EVENTS: Record<string, GameEvent> = {
    // 可以在这里添加其他静态的序章事件，例如第一次去某个地方的事件等
};


export const PROLOGUE_ACTIONS: PrologueActionConfig[] = [
  // -----------------------------------------------------------
  // 阶段一：家里 (HOME) - 保持不变
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
    
      // --- 家里新增互动 (Life Residue) ---
      {
        id: 'HOME_TV_CABINET',
        label: '检查电视柜',
        desc: '寻找遥控器，看看电视是否还能打开',
        condition: (s) => s.prologue.location === 'HOME' && !s.prologue.flags['checked_tv_cabinet'],
        effect: (s) => ({
          updates: { prologue: { ...s.prologue, flags: { ...s.prologue.flags, 'checked_tv_cabinet': true } } },
          log: '你打开电视柜，里面躺着一个沾满灰尘的遥控器。屏幕上卡在灾前某档综艺节目的画面，一群人在舞台上载歌载舞，与窗外的末日景象格格不入。你默默地关上了它。'
        })
      },
      {
        id: 'HOME_SLEEP',
        label: '睡觉',
        desc: '逃避现实 (精神-10)',
        condition: (s) => s.prologue.location === 'HOME' && s.prologue.flags['has_peeped'],
        effect: (s) => {
            const isFirstSleep = !s.prologue.flags['slept_once'];
            let log = '';
            let updates: Partial<PrologueState> = { ...s.prologue, flags: { ...s.prologue.flags, slept_once: true } };
            let moraleChange = -10;
    
            if (isFirstSleep) {
                log = '你蒙头大睡，试图告诉自己这一切都是梦。但门口那永不停歇的撞击声让你噩梦连连。醒来时，你感到更加疲惫了。';
            } else {
                log = '你再次选择逃避，沉入了昏沉的梦境。门外的撞击声不知道什么时候停了，你不知道那东西是走了，还是只是换了个地方等你。当你再次醒来，透过猫眼，你发现走廊的地板上似乎多了一滩暗红色的污迹...';
                moraleChange -= 5;
            }
    
            return {
                updates: { 
                    morale: Math.max(0, s.morale + moraleChange),
                    prologue: updates 
                },
                log
            };
        }
      },
      {
        id: 'HOME_TRAIN',
        label: '锻炼一下',
        desc: '临阵磨枪 (STR成长+0.02)',
        condition: (s) => s.prologue.location === 'HOME' && s.prologue.flags['has_peeped'] && !s.prologue.flags['trained_today'],
        effect: (s) => ({
            updates: { prologue: { ...s.prologue, flags: { ...s.prologue.flags, 'trained_today': true } } },
            log: '你在狭窄的客厅做了几组俯卧撑，感觉肌肉稍微充实了一点点。虽然不多，但这让你找回了一点对自己身体的掌控感。'
        })
      },
      
      // -----------------------------------------------------------
      // 阶段二：整栋楼探索 (CORRIDOR)
      // -----------------------------------------------------------    
    // --- 楼层移动 ---
    {
      id: 'COR_UP',
      label: '上楼',
      desc: '前往上一层',
      condition: (s) => s.prologue.location === 'CORRIDOR' && s.prologue.currentFloor < 8,
      effect: (s) => ({
          updates: { prologue: { ...s.prologue, currentFloor: s.prologue.currentFloor + 1 } },
          log: `你沿着楼梯小心翼翼地走上了 ${s.prologue.currentFloor + 1} 楼。`
      })
    },
    {
      id: 'COR_DOWN',
      label: '下楼',
      desc: '前往下一层',
      condition: (s) => s.prologue.location === 'CORRIDOR' && s.prologue.currentFloor > 1,
      effect: (s) => ({
          updates: { prologue: { ...s.prologue, currentFloor: s.prologue.currentFloor - 1 } },
          log: `你顺着楼梯下到了 ${s.prologue.currentFloor - 1} 楼。`
      })
    },
  
    // --- 房间探索 (Generic) ---
    // 左边房间 (01)
    {
      id: 'COR_EXPLORE_ROOM_1',
      label: '探索 01 室',
      desc: '查看左边的住户',
      condition: (s) => {
          if (s.prologue.location !== 'CORRIDOR') return false;
          const roomId = `${s.prologue.currentFloor}-1`;
          return !s.prologue.exploredRooms.includes(roomId); // 只有未探索的房间才能探索
      },
      effect: (s) => {
          const floor = s.prologue.currentFloor;
          const roomNum = 1;
          const roomId = `${floor}-${roomNum}`;
          
          return {
              updates: { prologue: { ...s.prologue, activeEventId: `ROOM_EXPLORE_${roomId}` } },
              log: `你来到了 ${floor}0${roomNum} 室门前。`,
              specialEvent: 'TRIGGER_PROLOGUE_EVENT'
          };
      }
    },
    // 右边房间 (02)
    {
      id: 'COR_EXPLORE_ROOM_2',
      label: '探索 02 室',
      desc: '查看右边的住户',
      condition: (s) => {
          if (s.prologue.location !== 'CORRIDOR') return false;
          const roomId = `${s.prologue.currentFloor}-2`;
          return !s.prologue.exploredRooms.includes(roomId); // 只有未探索的房间才能探索
      },
      effect: (s) => {
          const floor = s.prologue.currentFloor;
          const roomNum = 2;
          const roomId = `${floor}-${roomNum}`;
  
          return {
              updates: { prologue: { ...s.prologue, activeEventId: `ROOM_EXPLORE_${roomId}` } },
              log: `你来到了 ${floor}0${roomNum} 室门前。`,
              specialEvent: 'TRIGGER_PROLOGUE_EVENT'
          };
      }
    },
  
    // --- 楼道新增互动 (Life Residue) ---
    {
      id: 'COR_CHECK_MAILBOX',
      label: '翻看信箱',
      desc: '看看有没有什么遗漏的信息',
      condition: (s) => s.prologue.location === 'CORRIDOR' && !s.prologue.flags[`checked_mailbox_${s.prologue.currentFloor}`],
      effect: (s) => ({
        updates: { prologue: { ...s.prologue, flags: { ...s.prologue.flags, [`checked_mailbox_${s.prologue.currentFloor}`]: true } } },
        log: `你检查了 ${s.prologue.currentFloor} 楼的信箱，里面塞满了逾期未取的快递单、催款单，还有一些已经泛黄的商业传单。这里曾是普通人生活的缩影。`
      })
    },
    {
      id: 'COR_CHECK_GARBAGE',
      label: '查看废弃物',
      desc: '搜寻生活残骸',
      condition: (s) => s.prologue.location === 'CORRIDOR' && !s.prologue.flags[`checked_garbage_${s.prologue.currentFloor}`],
      effect: (s) => ({
        updates: { prologue: { ...s.prologue, flags: { ...s.prologue.flags, [`checked_garbage_${s.prologue.currentFloor}`]: true } } },
        log: `你踢开了几个散落在地的外卖袋和快递箱。食物残渣已经腐烂，但从中你瞥见了一张电影票根，日期就在灾变发生前夕。末日前，这里的人们还在享受着平静的日常。`
      })
    },
  
    // --- 一楼大门 (Exit) ---
    {
      id: 'COR_CHECK_EXIT',
      label: '检查大门',
      desc: '查看一楼出口封锁情况',
      condition: (s) => s.prologue.location === 'CORRIDOR' && s.prologue.currentFloor === 1,
      effect: (s) => {
          const exploration = calculateExploration(s.prologue);
          if (exploration < 100) {
               return {
                   log: `大门被某种高压电线死死缠绕。门上的电子锁似乎连接着某种生物感应装置。系统提示：警告，楼内仍有高威胁生物反应，安全锁已启动。当前清理进度：${exploration}%。你需要清理每一层的每一个住户。`
               };
          } else {
               return {
                   log: '所有住户的威胁反应已消失。安全锁的红灯转为了绿灯。随着一声气压释放的巨响，缠绕的电线自动脱落，大门缓缓打开... 门外，是真正的地狱。',
                   specialEvent: 'TRIGGER_COMBAT_BOSS' // 这里可以触发最终 Boss 战，或者直接通关
               };
          }
      }
    },
  
    // --- 返回 ---
    {
      id: 'COR_RETURN',
      label: '返回自己的房间',
      desc: '暂时撤退 (回5楼)',
      condition: (s) => s.prologue.location === 'CORRIDOR' && s.prologue.currentFloor === 5,
      effect: (s) => ({
          updates: { prologue: { ...s.prologue, location: 'HOME' } },
          log: '你退回了502室，锁好门。外面的恐怖暂时被隔绝了。'
      })
    },
    // 从房间再次出门到楼道
    {
      id: 'HOME_GO_OUT',
      label: '前往楼道',
      desc: '继续探索外部',
      condition: (s) => s.prologue.location === 'HOME' && s.prologue.nodeProgress['home_search'] >= 2 && s.prologue.flags['has_peeped'], 
      effect: (s) => ({
          updates: { prologue: { ...s.prologue, location: 'CORRIDOR' } }, // 默认回到 5 楼，因为 currentFloor 存在 state 里
          log: '你握紧武器，再次推开门走进楼道。'
      })
    }
  ];