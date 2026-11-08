// js/score.js
// 《山河岁月》计分系统纯函数。提供得分计算、章节评级、称号阈值、存档管理等纯函数接口。
// 与游戏状态机（app.js）无依赖关系，可独立单元测试。

window.SHY_SCORE = {
  // 常数：基础得分与特殊分值
  BASE_CORRECT: 100,
  LEARN: 20,
  EXTRA: 10,

  /**
   * 连击倍率计算
   * @param {number} combo - 当前连击数
   * @returns {number} 倍率（1.0 | 1.1 | 1.2 | 1.3）
   */
  comboMultiplier: function(combo) {
    if (combo <= 1) return 1.0;
    if (combo === 2) return 1.1;
    if (combo === 3) return 1.2;
    return 1.3; // combo >= 4
  },

  /**
   * 单道题答题得分
   * @param {boolean} firstTryCorrect - 首次是否答对
   * @param {number} combo - 当前连击数
   * @returns {number} 得分（首次答对时返回 BASE_CORRECT × comboMultiplier，否则 0）
   */
  scoreForAnswer: function(firstTryCorrect, combo) {
    if (!firstTryCorrect) return 0;
    return Math.round(100 * this.comboMultiplier(combo));
  },

  /**
   * 章节评级
   * @param {number} earned - 本章已获得分数
   * @param {number} possible - 本章总可能分数
   * @returns {string} 评级（"甲" | "乙" | "丙"）
   *   - 得分率 >= 0.85 → "甲"
   *   - 得分率 >= 0.60 → "乙"
   *   - 否则 → "丙"
   *   - possible <= 0 → "丙"
   */
  chapterGrade: function(earned, possible) {
    if (possible <= 0) return "丙";
    const rate = earned / possible;
    if (rate >= 0.85) return "甲";
    if (rate >= 0.60) return "乙";
    return "丙";
  },

  /**
   * 总分对应称号
   * @param {number} total - 累计总分
   * @returns {string} 称号
   *   - total < 1200 → "初识风云"
   *   - total < 2400 → "洞察者"
   *   - total < 3600 → "史家"
   *   - total >= 3600 → "民族脊梁"
   */
  titleForTotal: function(total) {
    if (total < 1200) return "初识风云";
    if (total < 2400) return "洞察者";
    if (total < 3600) return "史家";
    return "民族脊梁";
  },

  /**
   * 创建初始游戏状态
   * @returns {object} 新状态对象
   */
  newState: function() {
    return {
      unlockedCount: 1,
      total: 0,
      combo: 0,
      answered: {},
      readExtra: {},
      litPersons: [],
      chapterEarned: {},
      finished: false
    };
  },

  /**
   * 保存游戏状态到 localStorage
   * @param {object} state - 游戏状态对象
   */
  saveState: function(state) {
    try {
      localStorage.setItem('shanhe_save_v1', JSON.stringify(state));
    } catch (e) {
      // file:// 协议下 localStorage 受限；静默失败，避免页面崩溃
    }
  },

  /**
   * 从 localStorage 加载游戏状态
   * @returns {object|null} 已解析的状态对象，或 null（若不存在或解析失败）
   */
  loadState: function() {
    try {
      const json = localStorage.getItem('shanhe_save_v1');
      if (json === null) return null;
      const parsed = JSON.parse(json);
      // 确保解析结果是对象（排除数组等非对象值）
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return parsed;
      }
      return null;
    } catch (e) {
      // 解析失败、localStorage 不可用等；返回 null
      return null;
    }
  }
};
