/**
 * types.ts —— 对话数据 Schema｜文档 02 §8.1
 * yaml 构建时编译为 JSON（vite 插件），运行时即是这份结构。
 */
export interface VoiceSetting {
  voice_id?: string;
  speed?: number;
  pitch?: number;
  vol?: number;
  emotion?: string;
}

export interface DialogueLine {
  id: string;
  speaker: 'npc' | 'pc' | 'narrator';
  text: string;
  /** 原文直引：UI 加考据角标，工具链校验白名单 */
  quote?: boolean;
  voice_setting?: VoiceSetting;
  model?: string;
}

export interface Topic {
  id: string;
  label: string;
  /** 考据栏引用（回目） */
  source?: string;
  /** 「书中此处」剧情点所属区域 id（仅 shuoshu.yaml 使用） */
  place?: string;
  /** 「书中此处」驻足点世界坐标 [x, y, z]（仅 shuoshu.yaml 使用） */
  at?: [number, number, number];
  lines: DialogueLine[];
  next?: { label: string; goto: string }[];
}

export interface DialogueFile {
  id: string;
  name: string;
  model?: string;
  voice_setting?: VoiceSetting;
  greet?: DialogueLine[];
  topics?: Topic[];
  fallback?: DialogueLine[];
  bye?: DialogueLine[];
}
