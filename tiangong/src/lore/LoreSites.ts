/**
 * LoreSites.ts —— 「书中此处」剧情点｜规格 docs/superpowers/specs/2026-08-09-书中此处-design.md
 *
 * content/dialogue/shuoshu.yaml 的 topics 即剧情点：
 * 每个 topic 带 place（区域 id）、at（世界坐标）、source（出处回目）。
 * 该 yaml 同时是 gen-voice / pack-audio / validate 的输入，故是单一事实来源。
 */
import * as THREE from 'three/webgpu';
import shuoshu from '@content/dialogue/shuoshu.yaml';
import type { DialogueFile, DialogueLine } from '../dialogue/types';

export interface LoreSite {
  id: string;
  label: string;
  /** 所属区域 id（content/places.json） */
  place: string;
  position: THREE.Vector3;
  /** 出处回目，播完推给考据栏 */
  source: string;
  lines: DialogueLine[];
}

/** 说书人语音包 id（= yaml 文件名，gen-voice 按此分包） */
export const SHUOSHU_PACK = 'shuoshu';

const file = shuoshu as unknown as DialogueFile;

/** 一次性引子：仅在玩家有史以来第一次触发剧情点时播 */
export const LORE_INTRO: DialogueLine | null = file.greet?.[0] ?? null;

export function loadLoreSites(): LoreSite[] {
  const out: LoreSite[] = [];
  for (const t of file.topics ?? []) {
    if (!t.at || !t.place) continue; // 防御：缺坐标的 topic 不作为剧情点
    out.push({
      id: t.id,
      label: t.label,
      place: t.place,
      position: new THREE.Vector3(t.at[0], t.at[1], t.at[2]),
      source: t.source ?? '',
      lines: t.lines ?? [],
    });
  }
  return out;
}
