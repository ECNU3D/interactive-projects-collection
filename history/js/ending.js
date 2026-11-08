// js/ending.js
// 《山河岁月》终章卷轴：玩家走完 1839—1978 全部 93 个节点后进入的竖向红色主题卷轴。
// 提供 window.SHY_ENDING = { render() }
// 消费 window.SHY_APP.state、window.SHY_DATA.chapters/events/choices、window.SHY_SCORE。
// 由 app.js 的 shy:enter-ending 监听防御式调用（先 showView('ending') 再 render()）。

(function () {
  "use strict";

  var observer = null; // 各节淡入用 IntersectionObserver；每次 render() 重建 DOM 后需重新绑定

  // ------------------------- 工具函数 -------------------------

  function escapeHtml(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function getState() {
    return (window.SHY_APP && window.SHY_APP.state) || null;
  }

  function chaptersList() {
    return (window.SHY_DATA && window.SHY_DATA.chapters) || [];
  }

  function eventsList() {
    return (window.SHY_DATA && window.SHY_DATA.events) || [];
  }

  function choicesList() {
    return (window.SHY_DATA && window.SHY_DATA.choices) || [];
  }

  // canonical answered 形状（choice.js 定案）：{ firstTryCorrect, earned, tries, confirmed }。
  // 防御式兼容纯数字/{score} 等旧写法（与 scroll.js scoreFromAnsweredEntry 同一防御口径），
  // 但终章只关心"首次是否答对"这一枚判定，不关心具体分值。
  function firstTryCorrectOf(entry) {
    if (entry == null || typeof entry !== "object") return null;
    return typeof entry.firstTryCorrect === "boolean" ? entry.firstTryCorrect : null;
  }

  // historyNote 固定以"历史真实走向："开头（见 data/choices.js 全量数据），截取首句
  // （到第一个 。！？ 为止）供卡片一句话呈现；找不到句号则整段（防御式，理论上不会发生）。
  function firstSentence(note) {
    var text = String(note == null ? "" : note).replace(/^历史真实走向[：:]\s*/, "");
    var m = text.match(/^[^。！？]*[。！？]/);
    return m ? m[0] : text;
  }

  function yearOf(ev) {
    if (!ev) return "";
    var m = String(ev.date || "").match(/^\d{4}/);
    if (m) return m[0] + "年";
    return ev.dateText || "";
  }

  // ------------------------- 卷首：总分/称号/评级阵列 ------------------------

  function renderGradeSeals(state) {
    var chapters = chaptersList()
      .slice()
      .sort(function (a, b) {
        return a.order - b.order;
      });
    var earned = (state && state.chapterEarned) || {};
    return chapters
      .map(function (ch) {
        var grade = earned[ch.id] || "";
        var cls = grade === "甲" ? "is-jia" : grade === "乙" ? "is-yi" : grade === "丙" ? "is-bing" : "is-none";
        return (
          '<div class="ending-grade-seal ' +
          cls +
          '" title="' +
          escapeHtml(ch.title + (grade ? "：" + grade + "等" : "：未评级")) +
          '">' +
          '<span class="ending-grade-seal-mark">' +
          escapeHtml(grade || "—") +
          "</span>" +
          '<span class="ending-grade-seal-label">' +
          escapeHtml(ch.title) +
          "</span>" +
          "</div>"
        );
      })
      .join("");
  }

  function renderCover(state) {
    var total = (state && state.total) || 0;
    var title = window.SHY_SCORE ? window.SHY_SCORE.titleForTotal(total) : "";
    return (
      '<section class="ending-sect ending-sect--cover">' +
      '<div class="ending-cover-emblem" aria-hidden="true">卷</div>' +
      '<h2 class="ending-cover-title">山河岁月</h2>' +
      '<p class="ending-cover-years">1839—1978</p>' +
      '<div class="ending-cover-stats">' +
      '<div class="ending-stat"><span class="ending-stat-value">' +
      total +
      '</span><span class="ending-stat-label">总分</span></div>' +
      '<div class="ending-stat"><span class="ending-stat-value ending-stat-value--title">' +
      escapeHtml(title) +
      '</span><span class="ending-stat-label">称号</span></div>' +
      "</div>" +
      '<h3 class="ending-sect-title">十五章评级</h3>' +
      '<div class="ending-grade-grid">' +
      renderGradeSeals(state) +
      "</div>" +
      "</section>"
    );
  }

  // ------------------------- 抉择回顾 -------------------------

  function orderedChoiceEventPairs() {
    var events = eventsList();
    var eventIndex = {};
    events.forEach(function (e, i) {
      eventIndex[e.id] = i;
    });
    return choicesList()
      .map(function (c) {
        var idx = Object.prototype.hasOwnProperty.call(eventIndex, c.eventId) ? eventIndex[c.eventId] : events.length;
        return { choice: c, event: events[idx] || null, idx: idx };
      })
      .sort(function (a, b) {
        return a.idx - b.idx;
      });
  }

  function renderChoiceCard(pair, state) {
    var c = pair.choice;
    var ev = pair.event;
    var entry = state && state.answered ? state.answered[c.id] : null;
    var correct = firstTryCorrectOf(entry);

    var statusCls, mark, label;
    if (correct === true) {
      statusCls = "is-correct";
      mark = "明";
      label = "答对";
    } else if (correct === false) {
      statusCls = "is-wrong";
      mark = "鉴";
      label = "答错";
    } else {
      statusCls = "is-unanswered";
      mark = "？";
      label = "未历";
    }

    return (
      '<li class="ending-choice-card ' +
      statusCls +
      '">' +
      '<div class="ending-choice-seal" aria-hidden="true">' +
      escapeHtml(mark) +
      "</div>" +
      '<div class="ending-choice-body">' +
      '<p class="ending-choice-meta">' +
      '<span class="ending-choice-year">' +
      escapeHtml(ev ? yearOf(ev) : "") +
      "</span>" +
      '<span class="ending-choice-title">' +
      escapeHtml(ev ? ev.title : "") +
      "</span>" +
      '<span class="ending-choice-status">' +
      escapeHtml(label) +
      "</span>" +
      "</p>" +
      '<p class="ending-choice-note">' +
      escapeHtml(firstSentence(c.historyNote)) +
      "</p>" +
      "</div>" +
      "</li>"
    );
  }

  function renderChoiceReview(state) {
    var pairs = orderedChoiceEventPairs();
    return (
      '<section class="ending-sect ending-sect--choices">' +
      '<h3 class="ending-sect-title">抉择回顾</h3>' +
      '<ol class="ending-choice-list">' +
      pairs
        .map(function (pair) {
          return renderChoiceCard(pair, state);
        })
        .join("") +
      "</ol>" +
      "</section>"
    );
  }

  // ------------------------- 致敬段落（固定文案） -------------------------

  var TRIBUTE_TEXT =
    "虎门海滩，销烟池上气浪蒸腾，那是古老民族第一次向世界宣告：主权不可让，尊严不可辱。" +
    "此后百余年间，山河几度破碎，志士几度捐躯——戊戌喋血菜市口，长征跋涉雪山草地，卢沟桥畔枪声再起，" +
    "先辈以血肉之躯挡住炮火，以信念点亮长夜。一九四九年十月，天安门前五十四门礼炮齐鸣二十八响，" +
    "五星红旗第一次升起在废墟之上，那是牺牲者用生命换来的黎明。此后历经曲折，终在改革开放的晨光里看见通往富强的路。" +
    "无数先辈的牺牲与正确抉择，才换来新中国与今日中国。展卷至此，山河犹在：读史为明志，" +
    "吾辈自强，方不负先辈与山河。";

  function renderTribute() {
    return (
      '<section class="ending-sect ending-sect--tribute">' +
      '<div class="ending-flag-motif" aria-hidden="true">' +
      '<span class="ending-star ending-star--lg"></span>' +
      '<span class="ending-star ending-star--sm s1"></span>' +
      '<span class="ending-star ending-star--sm s2"></span>' +
      '<span class="ending-star ending-star--sm s3"></span>' +
      '<span class="ending-star ending-star--sm s4"></span>' +
      "</div>" +
      '<h3 class="ending-sect-title">致敬</h3>' +
      '<p class="ending-tribute-text">' +
      escapeHtml(TRIBUTE_TEXT) +
      "</p>" +
      "</section>"
    );
  }

  // ------------------------- 数据来源致谢 -------------------------

  function renderCredit() {
    return (
      '<section class="ending-sect ending-sect--credit">' +
      '<p class="ending-credit-text">本作历史节点、人物与史实表述均以中学、大学通行中国近代史教材口径为准；' +
      '配图为公有领域历史照片或标注"AI 生成想象图"的场景复原图，来源与说明详见页面右上角「关于」。</p>' +
      "</section>"
    );
  }

  // ------------------------- 重走长卷 -------------------------

  function doRestartFallback() {
    // 兜底实现：仅当 app.js 未导出 SHY_APP.restart（契约缺失或加载顺序异常）时使用，
    // 逻辑与 app.js bindRestart() 完全一致，避免按钮失效；正常路径下不会走到这里。
    var confirmed = window.confirm("确定要清空当前存档、重新开始这段山河岁月吗？此操作不可撤销。");
    if (!confirmed) return;
    try {
      window.localStorage.removeItem("shanhe_save_v1");
      window.localStorage.removeItem("shanhe_settings_v1");
    } catch (e) {
      // file:// 协议下 localStorage 可能受限，静默失败
    }
    window.location.reload();
  }

  function renderRestart() {
    return (
      '<section class="ending-sect ending-sect--restart">' +
      '<button type="button" class="ending-restart-btn" id="btn-ending-restart">重走长卷</button>' +
      "</section>"
    );
  }

  function bindRestart(container) {
    var btn = container.querySelector("#btn-ending-restart");
    if (!btn) return;
    btn.addEventListener("click", function () {
      if (window.SHY_APP && typeof window.SHY_APP.restart === "function") {
        window.SHY_APP.restart();
      } else {
        doRestartFallback();
      }
    });
  }

  // ------------------------- 滚动淡入 -------------------------

  function bindFadeIn(container) {
    var sects = container.querySelectorAll(".ending-sect");
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (typeof window.IntersectionObserver !== "function") {
      // 不支持的环境：直接全部可见，不做动效降级处理
      sects.forEach(function (el) {
        el.classList.add("is-visible");
      });
      return;
    }
    observer = new window.IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { root: container, threshold: 0.12 }
    );
    sects.forEach(function (el) {
      observer.observe(el);
    });
  }

  // ------------------------- 主渲染 -------------------------

  function render() {
    var container = document.getElementById("ending-view");
    if (!container) return;
    var state = getState() || {};

    container.innerHTML =
      '<div class="ending-scroll">' +
      renderCover(state) +
      renderChoiceReview(state) +
      renderTribute() +
      renderCredit() +
      renderRestart() +
      "</div>";

    bindRestart(container);
    bindFadeIn(container);
    // 卷首首屏本就在可视区内，IntersectionObserver 的首次 callback 需等待一次布局/滚动事件才
    // 触发；显式补一次同步淡入，避免刚进入终章时卷首静止不动、要等用户滚动一下才"醒来"。
    var first = container.querySelector(".ending-sect");
    if (first) first.classList.add("is-visible");
  }

  window.SHY_ENDING = {
    render: render
  };
})();
