/**
 * regions/index.ts —— 区域注册表（16 区域 + 天河渡口）｜文档 01 §1.2
 */
import type { RegionBuilder } from '../Region';
import { buildNanTianMen } from './NanTianMen';
import { buildDongTianMen, buildXiTianMen, buildBeiTianMen } from './TianMen';
import { buildTianHe } from './TianHeDuKou';
import { buildGongDianHai } from './PalaceSeaRegion';
import { buildShouXingTai } from './ShouXingTai';
import { buildChaoShengLou } from './ChaoShengLou';
import { buildTongMingDian } from './TongMingDian';
import { buildLingXiaoDian } from './LingXiaoDian';
import { buildDouNiuGong } from './DouNiuGong';
import { buildYuMaJian } from './YuMaJian';
import { buildPiXiangDian } from './PiXiangDian';
import { buildZhanYaoTai } from './ZhanYaoTai';
import { buildPanTaoYuan } from './PanTaoYuan';
import { buildQiTianFu } from './QiTianFu';
import { buildYaoChi } from './YaoChi';
import { buildGuangHanGong } from './GuangHanGong';
import { buildDouShuaiGong } from './DouShuaiGong';

export const REGION_BUILDERS: Record<string, RegionBuilder> = {
  'nantianmen': buildNanTianMen,
  'dongtianmen': buildDongTianMen,
  'xitianmen': buildXiTianMen,
  'beitianmen': buildBeiTianMen,
  'tianhe': buildTianHe,
  'gongdianhai': buildGongDianHai,
  'shouxingtai': buildShouXingTai,
  'chaoshenglou': buildChaoShengLou,
  'tongmingdian': buildTongMingDian,
  'lingxiaodian': buildLingXiaoDian,
  'douniugong': buildDouNiuGong,
  'yumajian': buildYuMaJian,
  'pixiangdian': buildPiXiangDian,
  'zhanyaotai': buildZhanYaoTai,
  'pantaoyuan': buildPanTaoYuan,
  'qitian-fu': buildQiTianFu,
  'yaochi': buildYaoChi,
  'guanghangong': buildGuangHanGong,
  'doushuaigong': buildDouShuaiGong,
};
