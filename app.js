(() => {
  const $ = (id) => document.getElementById(id);

  // UI Elements Map
  const els = {
    sidebar: $("sidebar"),
    toggleSidebarBtn: $("toggleSidebarBtn"),
    stageList: $("stageList"),
    addStageBtn: $("addStageBtn"),
    resetPresetBtn: $("resetPresetBtn"),
    importBtn: $("importBtn"),
    exportBtn: $("exportBtn"),
    settingsBtn: $("settingsBtn"),
    
    mainContainer: $("mainContainer"),
    statusBg: $("statusBg"),
    currentStageName: $("currentStageName"),
    progressBar: $("progressBar"),
    timeDisplay: $("timeDisplay"),
    overtimeHint: $("overtimeHint"),
    prewarnInfo: $("prewarnInfo"),
    
    prevBtn: $("prevBtn"),
    toggleBtn: $("toggleBtn"),
    playIcon: $("playIcon"),
    pauseIcon: $("pauseIcon"),
    nextBtn: $("nextBtn"),
    minusBtn: $("minusBtn"),
    resetBtn: $("resetBtn"),
    plusBtn: $("plusBtn"),
    muteBtn: $("muteBtn"),
    muteIcon: $("muteIcon"),
    fsBtn: $("fsBtn"),
    
    editDialog: $("editDialog"),
    editName: $("editName"),
    editSeconds: $("editSeconds"),
    editSaveBtn: $("editSaveBtn"),
    
    settingsDialog: $("settingsDialog"),
    warnSecondsInput: $("warnSecondsInput"),
    autoAdvanceInput: $("autoAdvanceInput"),
    settingsSaveBtn: $("settingsSaveBtn"),
    
    importFile: $("importFile")
  };

  const SKEY = "debateTimer.v1";
  const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

  // Default Data
  const defaults = () => [
    { id: uid(), name: "正方立论", seconds: 180 },
    { id: uid(), name: "反方立论", seconds: 180 },
    { id: uid(), name: "正方质询", seconds: 120 },
    { id: uid(), name: "反方质询", seconds: 120 },
    { id: uid(), name: "自由辩论", seconds: 480 },
    { id: uid(), name: "正方总结", seconds: 180 },
    { id: uid(), name: "反方总结", seconds: 180 }
  ];

  // State
  const st = {
    stages: [],
    idx: 0,
    running: false,
    remain: 0,
    total: 0,
    warnSecs: [60, 30],
    warnedSet: new Set(),
    beeped: false,
    beep: true,
    raf: 0,
    last: 0,
    editing: null,
    autoNext: false,
    autoDone: false
  };

  // --- Persistence ---
  function load() {
    try {
      const raw = localStorage.getItem(SKEY);
      if (raw) {
        const d = JSON.parse(raw);
        st.stages = Array.isArray(d.stages) && d.stages.length ? d.stages : defaults();
        st.idx = Number.isInteger(d.currentIndex) ? Math.min(Math.max(0, d.currentIndex), st.stages.length - 1) : 0;
        st.beep = typeof d.beepEnabled === "boolean" ? d.beepEnabled : true;
        
        if (Array.isArray(d.warnSeconds) && d.warnSeconds.length) {
          st.warnSecs = d.warnSeconds.filter(n => Number.isInteger(n) && n > 0).slice(0, 8);
        } else {
          const p = Number.isInteger(d.preWarnSec) ? d.preWarnSec : 60;
          st.warnSecs = p > 0 ? [p] : [];
        }
        
        st.autoNext = !!d.autoAdvance;
      } else {
        st.stages = defaults();
        st.idx = 0;
      }
    } catch (e) {
      st.stages = defaults();
      st.idx = 0;
    }
    apply();
  }

  function save() {
    try {
      localStorage.setItem(SKEY, JSON.stringify({
        stages: st.stages,
        currentIndex: st.idx,
        beepEnabled: st.beep,
        warnSeconds: st.warnSecs,
        autoAdvance: st.autoNext
      }));
    } catch (e) {}
  }

  function apply() {
    const s = st.stages[st.idx];
    st.total = s ? s.seconds * 1000 : 0;
    st.remain = st.total;
    st.warnedSet = new Set();
    st.beeped = false;
    st.autoDone = false;
    renderAll();
  }

  // --- Rendering ---
  const fmt = (t) => {
    const n = t < 0;
    const x = Math.abs(t);
    const sec = Math.ceil(x / 1000); // Use ceil for countdown feel (0.1s -> 1s displayed)
    // Actually standard timer logic usually floors, but let's stick to standard
    // floor(2999) -> 2, floor(0.1) -> 0. Usually prefer ceil for "time remaining"
    // Let's stick to existing logic: floor.
    // Wait, existing logic was: floor.
    const secVal = Math.ceil(x / 1000); 
    // If we use ceil: 0.1s -> 1s. 0s -> 0s.
    // If we use floor: 0.9s -> 0s.
    // Let's use ceil for display so you don't see "00:00" when there is still 900ms left.
    
    const m = Math.floor(secVal / 60);
    const s = secVal % 60;
    return (n ? "-" : "") + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  };

  function iconBtn(text, className = "") {
    const b = document.createElement('button');
    b.className = `px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs transition-colors ${className}`;
    b.textContent = text;
    return b;
  }

  function renderStages() {
    els.stageList.innerHTML = '';
    st.stages.forEach((it, i) => {
      const li = document.createElement('li');
      const active = i === st.idx;
      li.className = `group flex items-center gap-3 py-3 px-3 rounded-lg transition-all cursor-pointer border border-transparent ${
        active 
        ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 shadow-sm' 
        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
      }`;

      // Number/Index
      const num = document.createElement('div');
      num.className = `w-6 shrink-0 font-mono text-sm ${active ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-400'}`;
      num.textContent = String(i + 1);

      // Content
      const body = document.createElement('div');
      body.className = 'flex-1 min-w-0';
      
      const name = document.createElement('div');
      name.className = `font-medium truncate ${active ? 'text-emerald-900 dark:text-emerald-100' : 'text-slate-700 dark:text-slate-300'}`;
      name.textContent = it.name;
      
      const sub = document.createElement('div');
      sub.className = 'text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5';
      sub.textContent = `时长 ${Math.floor(it.seconds / 60)}:${String(it.seconds % 60).padStart(2, '0')}`;
      
      body.appendChild(name);
      body.appendChild(sub);
      
      // Click to switch
      li.addEventListener('click', () => {
        if (st.running) toggle(false);
        st.idx = i;
        apply();
        save();
        // On mobile, close sidebar after selection
        if (window.innerWidth < 1024) {
             els.sidebar.classList.add('-translate-x-full');
        }
      });

      // Controls (visible on hover or active)
      const ctr = document.createElement('div');
      ctr.className = `flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${active ? 'opacity-100' : ''}`;
      if (window.matchMedia('(hover: none)').matches) ctr.className = 'flex items-center gap-1'; // Always show on touch

      const btnClass = "p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200";

      // Up
      const up = document.createElement('button');
      up.className = btnClass;
      up.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"></polyline></svg>';
      up.onclick = (e) => {
        e.stopPropagation();
        if (i > 0) {
          const t = st.stages[i];
          st.stages.splice(i, 1);
          st.stages.splice(i - 1, 0, t);
          if (st.idx === i) st.idx = i - 1;
          else if (st.idx === i - 1) st.idx = i;
          renderStages();
          save();
        }
      };

      // Down
      const down = document.createElement('button');
      down.className = btnClass;
      down.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>';
      down.onclick = (e) => {
        e.stopPropagation();
        if (i < st.stages.length - 1) {
          const t = st.stages[i];
          st.stages.splice(i, 1);
          st.stages.splice(i + 1, 0, t);
          if (st.idx === i) st.idx = i + 1;
          else if (st.idx === i + 1) st.idx = i;
          renderStages();
          save();
        }
      };

      // Edit
      const edit = document.createElement('button');
      edit.className = btnClass;
      edit.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>';
      edit.onclick = (e) => {
        e.stopPropagation();
        openEdit(it.id);
      };

      // Delete
      const del = document.createElement('button');
      del.className = btnClass + " hover:text-rose-500";
      del.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
      del.onclick = (e) => {
        e.stopPropagation();
        if (!confirm('确认删除该阶段？')) return;
        const was = st.idx === i;
        st.stages.splice(i, 1);
        if (!st.stages.length) {
          st.stages = defaults();
          st.idx = 0;
        } else if (was) {
          st.idx = Math.max(0, i - 1);
        } else if (i < st.idx) {
          st.idx -= 1;
        }
        apply();
        save();
      };

      ctr.append(up, down, edit, del);
      li.append(num, body, ctr);
      els.stageList.appendChild(li);
    });
  }

  function renderTimer() {
    const s = st.stages[st.idx];
    els.currentStageName.textContent = s ? s.name : '未定义阶段';
    
    // Use ceil for display to avoid 00:00 when not actually done
    // But strictly logic uses internal `st.remain`
    // Let's adhere to standard ceil-like display for countdowns
    let displayTime = st.remain;
    if (st.remain > 0) {
        // round up to nearest second for clean display
        displayTime = Math.ceil(st.remain / 1000) * 1000; 
    }
    els.timeDisplay.textContent = fmt(displayTime);

    const overtime = st.remain < 0;
    els.overtimeHint.style.opacity = overtime ? '1' : '0';
    
    // Progress Logic
    const total = Math.max(1, st.total);
    const r = Math.max(0, Math.min(total, st.remain));
    const ratio = 1 - r / total;
    els.progressBar.style.width = `${(ratio * 100).toFixed(2)}%`;

    // States: Normal (Emerald), Warning (Amber), Overtime (Rose)
    const maxWarn = st.warnSecs.length ? Math.max(...st.warnSecs) : null;
    const warnMs = maxWarn != null ? maxWarn * 1000 : -1;
    
    // Colors
    els.progressBar.classList.remove('bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'shadow-emerald-500/50', 'shadow-amber-500/50', 'shadow-rose-500/50');
    els.statusBg.className = "absolute inset-0 pointer-events-none transition-colors duration-500 opacity-10";
    els.mainContainer.classList.remove('animate-bg-pulse');
    els.timeDisplay.classList.remove('text-rose-500', 'text-amber-500');

    if (overtime) {
      els.progressBar.classList.add('bg-rose-500', 'shadow-[0_0_10px_rgba(244,63,94,0.5)]');
      els.statusBg.classList.add('bg-rose-500');
      els.mainContainer.classList.add('animate-bg-pulse');
      els.timeDisplay.classList.add('text-rose-500');
    } else if (warnMs >= 0 && st.remain <= warnMs) {
      els.progressBar.classList.add('bg-amber-500', 'shadow-[0_0_10px_rgba(245,158,11,0.5)]');
      els.statusBg.classList.add('bg-amber-500');
      els.timeDisplay.classList.add('text-amber-500');
    } else {
      els.progressBar.classList.add('bg-emerald-500', 'shadow-[0_0_10px_rgba(16,185,129,0.5)]');
      // Default bg is clean
    }

    // Buttons State
    if (st.running) {
      els.playIcon.classList.add('hidden');
      els.pauseIcon.classList.remove('hidden');
    } else {
      els.playIcon.classList.remove('hidden');
      els.pauseIcon.classList.add('hidden');
    }

    els.muteIcon.textContent = st.beep ? '🔔' : '🔕';
    els.muteBtn.title = st.beep ? '提示音: 开 (M)' : '提示音: 关 (M)';

    if (els.prewarnInfo) {
      els.prewarnInfo.textContent = st.warnSecs.length ? `预警: ${st.warnSecs.join(',')}s` : '预警: 无';
    }
  }

  function renderAll() {
    renderStages();
    renderTimer();
  }

  // --- Audio ---
  let actx = null;

  function ensureAudio() {
    if (!actx) {
      try {
        actx = new(window.AudioContext || window.webkitAudioContext)()
      } catch (e) {}
    }
    if (actx && actx.state === 'suspended') {
        actx.resume();
    }
  }

  function tone(freq = 880, dur = 0.15, type = 'sine', vol = 0.1) {
    if (!st.beep) return;
    ensureAudio();
    if (!actx) return;
    const t0 = actx.currentTime;
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = vol;
    o.connect(g).connect(actx.destination);
    o.start(t0);
    o.stop(t0 + dur);
  }

  function beepWarn() {
    tone(880, 0.12);
    setTimeout(() => tone(660, 0.12), 180);
  }

  function beepEnd() {
    tone(520, 0.4, 'square', 0.15);
    setTimeout(() => tone(520, 0.4, 'square', 0.15), 600);
  }

  // --- Loop ---
  function loop(ts) {
    if (!st.running) return;
    if (!st.last) st.last = ts;
    const d = ts - st.last;
    const prev = st.remain;
    st.last = ts;
    st.remain -= d;

    // Warning Checks
    if (st.warnSecs && st.warnSecs.length) {
      for (const ws of st.warnSecs) {
        const wm = ws * 1000;
        // Check if we crossed the threshold downwards
        if (!st.warnedSet.has(ws) && prev > wm && st.remain <= wm && st.remain > 0) {
          st.warnedSet.add(ws);
          beepWarn();
          break;
        }
      }
    }

    // Time Up Check
    if (!st.beeped && st.remain <= 0) {
      st.beeped = true;
      beepEnd();
      if (st.autoNext && !st.autoDone) {
        st.autoDone = true;
        if (st.idx < st.stages.length - 1) {
            setTimeout(() => {
                toggle(false);
                st.idx++;
                apply();
                save();
            }, 1000); // Small delay before auto switch so they hear the beep
        }
      }
    }

    renderTimer();
    st.raf = requestAnimationFrame(loop);
  }

  function toggle(on) {
    if (on === undefined) on = !st.running;
    if (on) {
      st.running = true;
      st.last = 0;
      st.raf = requestAnimationFrame(loop);
    } else {
      st.running = false;
      st.last = 0;
      cancelAnimationFrame(st.raf);
    }
    renderTimer();
  }

  // --- Edit Dialog ---
  function openEdit(id) {
    const it = st.stages.find(x => x.id === id);
    if (!it) return;
    st.editing = id;
    els.editName.value = it.name;
    els.editSeconds.value = it.seconds;
    try {
      els.editDialog.showModal();
    } catch (e) {
      els.editDialog.setAttribute('open', '');
    }
  }

  function closeEdit() {
    st.editing = null;
    try {
      els.editDialog.close();
    } catch (e) {
      els.editDialog.removeAttribute('open');
    }
  }

  els.editSaveBtn.addEventListener('click', e => {
    e.preventDefault();
    if (!st.editing) return;
    const idx = st.stages.findIndex(x => x.id === st.editing);
    if (idx < 0) return;
    const it = st.stages[idx];
    const name = els.editName.value.trim() || '未命名';
    let sec = parseInt(els.editSeconds.value, 10);
    if (!(sec > 0)) sec = 60;
    
    const editingCurrent = idx === st.idx;
    // const oldSec = it.seconds; // Unused
    
    it.name = name;
    it.seconds = sec;
    
    if (editingCurrent) {
      const oldTotal = st.total;
      const newTotal = sec * 1000;
      if (oldTotal > 0) {
        const ratio = st.remain / oldTotal;
        st.total = newTotal;
        // Preserve progress ratio or just reset? 
        // Usually users edit duration to fix a mistake. 
        // Let's try to preserve "time elapsed"? No, usually "time remaining" is what matters.
        // If I change 3min to 4min, and I had 1min left. Do I now have 2min left?
        // Simple approach: Reset total, keep elapsed time? 
        // Let's stick to: Rescale remain based on ratio.
        st.remain = Math.round(ratio * newTotal);
      } else {
        st.total = newTotal;
        st.remain = newTotal;
      }
      renderTimer();
    }
    renderStages();
    save();
    closeEdit();
  });

  // --- Event Listeners ---
  
  // Sidebar Toggle
  els.toggleSidebarBtn?.addEventListener('click', () => {
     els.sidebar.classList.toggle('-translate-x-full');
  });

  els.addStageBtn.addEventListener('click', () => {
    const n = { id: uid(), name: '新阶段', seconds: 60 };
    st.stages.push(n);
    st.idx = st.stages.length - 1;
    apply();
    save();
    // Auto scroll to bottom
    setTimeout(() => els.stageList.lastElementChild?.scrollIntoView({ behavior: "smooth" }), 100);
  });

  els.resetPresetBtn.addEventListener('click', () => {
    if (!confirm('重置为预设议程？')) return;
    st.stages = defaults();
    st.idx = 0;
    apply();
    save();
  });

  els.prevBtn.addEventListener('click', () => {
    if (st.idx > 0) {
      if (st.running) toggle(false);
      st.idx--;
      apply();
      save();
    }
  });

  els.nextBtn.addEventListener('click', () => {
    if (st.idx < st.stages.length - 1) {
      if (st.running) toggle(false);
      st.idx++;
      apply();
      save();
    }
  });

  els.toggleBtn.addEventListener('click', () => toggle());

  els.resetBtn.addEventListener('click', () => {
    toggle(false);
    st.remain = st.total;
    st.warnedSet = new Set();
    st.beeped = false;
    st.autoDone = false;
    renderTimer();
  });

  els.plusBtn.addEventListener('click', () => {
    st.remain += 10000;
    renderTimer();
  });

  els.minusBtn.addEventListener('click', () => {
    st.remain -= 10000;
    renderTimer();
  });

  els.muteBtn.addEventListener('click', () => {
    st.beep = !st.beep;
    save();
    renderTimer();
  });

  els.fsBtn.addEventListener('click', () => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      document.documentElement.requestFullscreen?.();
    }
  });

  // Settings
  function openSettings() {
    els.warnSecondsInput.value = st.warnSecs.join(',');
    els.autoAdvanceInput.checked = !!st.autoNext;
    try {
      els.settingsDialog.showModal();
    } catch (e) {
      els.settingsDialog.setAttribute('open', '');
    }
  }

  function closeSettings() {
    try {
      els.settingsDialog.close();
    } catch (e) {
      els.settingsDialog.removeAttribute('open');
    }
  }

  function parseWarnSeconds(str) {
    return (str || '').split(',').map(s => parseInt(s.trim(), 10)).filter(n => Number.isInteger(n) && n > 0 && n < 36000).slice(0, 8);
  }

  els.settingsBtn?.addEventListener('click', () => openSettings());

  els.settingsSaveBtn?.addEventListener('click', e => {
    e.preventDefault();
    st.warnSecs = parseWarnSeconds(els.warnSecondsInput.value);
    st.autoNext = !!els.autoAdvanceInput.checked;
    save();
    renderTimer();
    closeSettings();
  });

  // Import / Export
  els.exportBtn?.addEventListener('click', () => {
    const payload = {
      schema: 'debate-timer/v1',
      stages: st.stages.map(x => ({ id: x.id, name: x.name, seconds: x.seconds })),
      settings: { beepEnabled: st.beep, warnSeconds: st.warnSecs, autoAdvance: st.autoNext }
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    const t = new Date();
    const pad = n => String(n).padStart(2, '0');
    a.download = `debate-timer-${t.getFullYear()}${pad(t.getMonth() + 1)}${pad(t.getDate())}-${pad(t.getHours())}${pad(t.getMinutes())}${pad(t.getSeconds())}.json`;
    a.href = URL.createObjectURL(blob);
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 0);
  });

  els.importBtn?.addEventListener('click', () => {
    if (els.importFile) {
      els.importFile.value = '';
      els.importFile.click();
    }
  });

  els.importFile?.addEventListener('change', async e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!confirm('导入将覆盖当前议程与设置，是否继续？')) {
      e.target.value = '';
      return;
    }
    let text = '';
    try {
      text = await file.text();
    } catch {
      alert('读取文件失败');
      return;
    }
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      alert('JSON 解析失败');
      return;
    }
    if (!data || !Array.isArray(data.stages)) {
      alert('无效的文件：缺少 stages');
      return;
    }
    const stages = data.stages.map(s => ({
      id: s.id || uid(),
      name: String(s.name || '阶段'),
      seconds: Math.max(5, parseInt(s.seconds, 10) || 60)
    }));
    st.stages = stages;
    st.idx = 0;
    if (data.settings) {
      if (typeof data.settings.beepEnabled === 'boolean') st.beep = data.settings.beepEnabled;
      if (Array.isArray(data.settings.warnSeconds)) st.warnSecs = data.settings.warnSeconds.filter(n => Number.isInteger(n) && n > 0);
      if (typeof data.settings.autoAdvance === 'boolean') st.autoNext = data.settings.autoAdvance;
    }
    apply();
    save();
  });

  // Keyboard Shortcuts
  window.addEventListener('keydown', e => {
    const tag = (e.target && e.target.tagName) || '';
    if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;

    if (e.key === ' ') {
      e.preventDefault();
      toggle();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      els.prevBtn.click();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      els.nextBtn.click();
    } else if (e.key === '+' || e.key === '=') { // Handle = for keyboards where + is shift+=
      e.preventDefault();
      els.plusBtn.click();
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      els.minusBtn.click();
    } else if (e.key.toLowerCase() === 'r') {
      e.preventDefault();
      els.resetBtn.click();
    } else if (e.key.toLowerCase() === 'f') {
      e.preventDefault();
      els.fsBtn.click();
    } else if (e.key.toLowerCase() === 'm') {
      e.preventDefault();
      els.muteBtn.click();
    }
  });

  window.addEventListener('pointerdown', () => {
    ensureAudio();
  }, { once: true });

  // Init
  load();
})();
