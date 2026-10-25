/* 大乱斗游戏厅 · 公共工具库
 * 数学、随机名字、输入（鼠标/键盘/触屏摇杆）、空间网格、音效合成、粒子、HUD 辅助
 */
(function () {
  const G = (window.G = {});
  const TAU = (G.TAU = Math.PI * 2);

  /* ---------------- 数学 ---------------- */
  G.rand = (a, b) => a + Math.random() * (b - a);
  G.randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  G.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  G.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  G.lerp = (a, b, t) => a + (b - a) * t;
  G.dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
  G.angleDiff = (a, b) => {
    let d = (b - a) % TAU;
    if (d > Math.PI) d -= TAU;
    if (d < -Math.PI) d += TAU;
    return d;
  };
  G.fmt = (n) => (n >= 100000 ? (n / 1000).toFixed(0) + 'k' : n >= 10000 ? (n / 1000).toFixed(1) + 'k' : Math.floor(n).toString());
  G.fmtTime = (s) => {
    s = Math.floor(s);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  };
  G.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------------- 颜色 ---------------- */
  G.hexToRgb = (h) => {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  // amt > 0 提亮，amt < 0 压暗
  G.shade = (hex, amt) => {
    const [r, g, b] = G.hexToRgb(hex);
    const t = amt < 0 ? 0 : 255;
    const p = Math.abs(amt);
    return `rgb(${Math.round(r + (t - r) * p)},${Math.round(g + (t - g) * p)},${Math.round(b + (t - b) * p)})`;
  };
  G.rgba = (hex, a) => {
    const [r, g, b] = G.hexToRgb(hex);
    return `rgba(${r},${g},${b},${a})`;
  };

  /* ---------------- 本地存储 ---------------- */
  G.store = {
    get(k, d) {
      try {
        const v = localStorage.getItem('brawl_' + k);
        return v === null ? d : JSON.parse(v);
      } catch (e) {
        return d;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem('brawl_' + k, JSON.stringify(v));
      } catch (e) {}
    },
  };

  /* ---------------- 名字 ---------------- */
  const NAMES = [
    '小龙虾', '奶茶续命', '摸鱼达人', '干饭王', '咸鱼翻身', '夜猫子', '芒果布丁', '佛系玩家', '暴躁老哥', '可乐加冰',
    '西瓜太郎', '蛋挞', '番茄炒蛋', '麻辣香锅', '熬夜冠军', '不吃香菜', '小笼包', '爱吃鱼的猫', '皮皮虾', '柠檬精',
    '螺蛳粉', '大白兔', '火锅底料', '卷心菜', '奶油泡芙', '烤红薯', '冰糖葫芦', '豆浆油条', '一口一个', '吃饱了撑的',
    '别追我', '我很弱', '路过的', '前方高能', '溜了溜了', '稳住能赢', '嘿嘿嘿', '芝士就是力量', '老六', '大聪明',
    '电竞少女', '躺平青年', '夜宵派', '饺子', '汤圆', 'Shadow', 'Neo', 'Pixel', 'Ghost', 'Viper', 'Nova', 'Blaze',
    'Luna', 'Rex', 'Kiwi', 'Mochi', 'Taco', 'Ninja', 'Comet', 'Bubble', 'Jelly', 'Noodle', 'Tofu', 'Panda',
  ];
  const usedNames = new Set();
  G.botName = () => {
    const free = NAMES.filter((n) => !usedNames.has(n));
    const n = free.length ? G.pick(free) : G.pick(NAMES) + G.randInt(2, 99);
    usedNames.add(n);
    return n;
  };
  G.releaseName = (n) => usedNames.delete(n);

  /* ---------------- 画布 ---------------- */
  G.fitCanvas = (canvas) => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    return { w, h, dpr };
  };

  /* ---------------- 空间哈希网格 ---------------- */
  G.Grid = class {
    constructor(size) {
      this.s = size;
      this.cells = new Map();
      this.used = [];
    }
    clear() {
      for (let i = 0; i < this.used.length; i++) this.used[i].length = 0;
      this.used.length = 0;
    }
    insert(o, x, y) {
      const k = (Math.floor(x / this.s) + 32768) * 65536 + (Math.floor(y / this.s) + 32768);
      let a = this.cells.get(k);
      if (!a) {
        a = [];
        this.cells.set(k, a);
      }
      if (a.length === 0) this.used.push(a);
      a.push(o);
    }
    // fn 返回 false 时提前结束
    query(x, y, r, fn) {
      const s = this.s;
      const x0 = Math.floor((x - r) / s), x1 = Math.floor((x + r) / s);
      const y0 = Math.floor((y - r) / s), y1 = Math.floor((y + r) / s);
      for (let cx = x0; cx <= x1; cx++) {
        for (let cy = y0; cy <= y1; cy++) {
          const a = this.cells.get((cx + 32768) * 65536 + (cy + 32768));
          if (!a) continue;
          for (let i = 0; i < a.length; i++) if (fn(a[i]) === false) return;
        }
      }
    }
  };

  /* ---------------- 输入 ---------------- */
  G.Input = class {
    constructor(canvas) {
      this.mx = window.innerWidth / 2;
      this.my = window.innerHeight / 2;
      this.mouseDown = false;
      this.keys = {};
      this.taps = new Set();
      this.held = {};
      this.wheel = 0;
      this.joy = { active: false, id: null, x: 1, y: 0, mag: 0, bx: 0, by: 0 };
      this.isTouch = window.matchMedia('(pointer: coarse)').matches;
      if (this.isTouch) document.body.classList.add('touch');

      window.addEventListener('mousemove', (e) => {
        this.mx = e.clientX;
        this.my = e.clientY;
      });
      canvas.addEventListener('mousedown', (e) => {
        if (e.button === 0) this.mouseDown = true;
        G.Sound.init();
      });
      window.addEventListener('mouseup', () => (this.mouseDown = false));
      window.addEventListener('blur', () => {
        this.mouseDown = false;
        this.keys = {};
        this.held = {};
      });
      window.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT') return;
        const k = e.key.toLowerCase();
        if (!this.keys[k]) this.taps.add(k);
        this.keys[k] = true;
        if (k === ' ') e.preventDefault();
        G.Sound.init();
      });
      window.addEventListener('keyup', (e) => (this.keys[e.key.toLowerCase()] = false));
      canvas.addEventListener('wheel', (e) => {
        this.wheel += Math.sign(e.deltaY);
        e.preventDefault();
      }, { passive: false });
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());

      // 浮动摇杆
      const joyEl = document.createElement('div');
      joyEl.className = 'joy';
      joyEl.innerHTML = '<div class="joy-knob"></div>';
      document.body.appendChild(joyEl);
      const knob = joyEl.firstChild;
      const JOY_R = 56;
      const updateJoy = (t) => {
        const dx = t.clientX - this.joy.bx, dy = t.clientY - this.joy.by;
        const len = Math.hypot(dx, dy);
        if (len > 4) {
          this.joy.x = dx / len;
          this.joy.y = dy / len;
        }
        this.joy.mag = Math.min(1, len / JOY_R);
        const k = Math.min(len, JOY_R);
        knob.style.transform = `translate(${len ? (dx / len) * k : 0}px, ${len ? (dy / len) * k : 0}px)`;
      };
      canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        G.Sound.init();
        if (!this.isTouch) {
          this.isTouch = true;
          document.body.classList.add('touch');
        }
        for (const t of e.changedTouches) {
          if (this.joy.id === null) {
            this.joy.id = t.identifier;
            this.joy.active = true;
            this.joy.bx = t.clientX;
            this.joy.by = t.clientY;
            this.joy.mag = 0;
            joyEl.style.left = t.clientX + 'px';
            joyEl.style.top = t.clientY + 'px';
            joyEl.classList.add('show');
            knob.style.transform = 'translate(0,0)';
          }
        }
      }, { passive: false });
      canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        for (const t of e.changedTouches) if (t.identifier === this.joy.id) updateJoy(t);
      }, { passive: false });
      const endTouch = (e) => {
        for (const t of e.changedTouches) {
          if (t.identifier === this.joy.id) {
            this.joy.id = null;
            this.joy.active = false;
            this.joy.mag = 0;
            joyEl.classList.remove('show');
          }
        }
      };
      canvas.addEventListener('touchend', endTouch);
      canvas.addEventListener('touchcancel', endTouch);

      // 触屏按钮
      document.querySelectorAll('[data-action]').forEach((btn) => {
        const a = btn.dataset.action;
        const on = (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.held[a] = true;
          this.taps.add(a);
          btn.classList.add('active');
          G.Sound.init();
        };
        const off = (e) => {
          e.preventDefault();
          this.held[a] = false;
          btn.classList.remove('active');
        };
        btn.addEventListener('touchstart', on, { passive: false });
        btn.addEventListener('touchend', off);
        btn.addEventListener('touchcancel', off);
        btn.addEventListener('mousedown', on);
        btn.addEventListener('mouseup', off);
        btn.addEventListener('mouseleave', off);
      });
    }
    tapped(...ks) {
      return ks.some((k) => this.taps.has(k));
    }
    endFrame() {
      this.taps.clear();
      this.wheel = 0;
    }
  };

  /* ---------------- 合成音效 ---------------- */
  G.Sound = {
    ctx: null,
    muted: G.store.get('muted', false),
    last: {},
    init() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.32;
        this.master.connect(this.ctx.destination);
        const len = this.ctx.sampleRate * 0.6;
        this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    },
    tone(f, dur, o = {}) {
      if (!this.ctx || this.muted) return;
      const { type = 'sine', vol = 0.2, to = null, delay = 0, attack = 0.006 } = o;
      const t = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(f, t);
      if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t);
      osc.stop(t + dur + 0.03);
    },
    noise(dur, o = {}) {
      if (!this.ctx || this.muted) return;
      const { vol = 0.2, freq = 1200, delay = 0, q = 0.8, to = null } = o;
      const t = this.ctx.currentTime + delay;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.Q.value = q;
      f.frequency.setValueAtTime(freq, t);
      if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f);
      f.connect(g);
      g.connect(this.master);
      src.start(t);
      src.stop(t + dur + 0.03);
    },
    play(name) {
      if (!this.ctx || this.muted) return;
      const now = performance.now();
      const gap = { eat: 55, big: 90, eject: 60, boost: 260 }[name] || 30;
      if (now - (this.last[name] || 0) < gap) return;
      this.last[name] = now;
      const r = G.rand;
      switch (name) {
        case 'eat':
          this.tone(r(620, 880), 0.07, { vol: 0.07, to: r(1200, 1500) });
          break;
        case 'big':
          this.tone(r(300, 380), 0.14, { vol: 0.14, to: r(800, 900), type: 'triangle' });
          break;
        case 'power':
          [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.18, { vol: 0.12, type: 'triangle', delay: i * 0.06 }));
          break;
        case 'kill':
          [392, 523, 659, 1047].forEach((f, i) => this.tone(f, 0.22, { vol: 0.1, type: 'square', delay: i * 0.05 }));
          this.noise(0.25, { vol: 0.12, freq: 600 });
          break;
        case 'death':
          this.tone(420, 0.9, { type: 'sawtooth', vol: 0.12, to: 50 });
          this.noise(0.6, { vol: 0.2, freq: 400, to: 80 });
          break;
        case 'boost':
          this.noise(0.25, { vol: 0.06, freq: 900, to: 2200, q: 2 });
          break;
        case 'split':
          this.noise(0.18, { vol: 0.14, freq: 1500, to: 3500, q: 1.5 });
          this.tone(260, 0.12, { to: 620, vol: 0.08, type: 'triangle' });
          break;
        case 'eject':
          this.tone(520, 0.07, { to: 240, vol: 0.07, type: 'triangle' });
          break;
        case 'virus':
          this.noise(0.5, { vol: 0.3, freq: 300, to: 60, q: 0.6 });
          this.tone(160, 0.4, { to: 40, vol: 0.18 });
          break;
        case 'start':
          [392, 494, 587, 784].forEach((f, i) => this.tone(f, 0.25, { vol: 0.11, type: 'triangle', delay: i * 0.08 }));
          break;
        case 'event':
          [880, 1175, 1568].forEach((f, i) => this.tone(f, 0.5, { vol: 0.08, delay: i * 0.12 }));
          break;
        case 'eaten':
          this.tone(700, 0.3, { to: 120, vol: 0.12, type: 'square' });
          break;
      }
    },
    toggle() {
      this.muted = !this.muted;
      G.store.set('muted', this.muted);
      return this.muted;
    },
  };

  /* ---------------- 粒子 & 飘字（世界坐标） ---------------- */
  G.Particles = class {
    constructor(max = 900) {
      this.list = [];
      this.texts = [];
      this.max = max;
    }
    burst(x, y, color, n, o = {}) {
      const { speed = 220, size = 4, life = 0.8, spread = TAU, angle = 0, drag = 2.5 } = o;
      for (let i = 0; i < n && this.list.length < this.max; i++) {
        const a = angle + (Math.random() - 0.5) * spread;
        const v = speed * (0.3 + Math.random() * 0.9);
        this.list.push({
          kind: 0, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
          s: size * (0.5 + Math.random() * 0.8), life: life * (0.6 + Math.random() * 0.6), t: 0, color, drag,
        });
      }
    }
    ring(x, y, color, radius, life = 0.6, width = 4) {
      this.list.push({ kind: 1, x, y, r: radius, life, t: 0, color, w: width });
    }
    text(x, y, str, color = '#fff', size = 18) {
      if (this.texts.length > 40) this.texts.shift();
      this.texts.push({ x, y, str, color, size, t: 0, life: 1.1 });
    }
    update(dt) {
      const L = this.list;
      for (let i = L.length - 1; i >= 0; i--) {
        const p = L[i];
        p.t += dt;
        if (p.t >= p.life) {
          L[i] = L[L.length - 1];
          L.pop();
          continue;
        }
        if (p.kind === 0) {
          const k = Math.exp(-p.drag * dt);
          p.vx *= k;
          p.vy *= k;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
        }
      }
      for (let i = this.texts.length - 1; i >= 0; i--) {
        const t = this.texts[i];
        t.t += dt;
        t.y -= 40 * dt;
        if (t.t > t.life) this.texts.splice(i, 1);
      }
    }
    draw(ctx, scale, additive) {
      ctx.save();
      if (additive) ctx.globalCompositeOperation = 'lighter';
      for (const p of this.list) {
        const k = 1 - p.t / p.life;
        ctx.globalAlpha = k;
        if (p.kind === 0) {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.s * (0.4 + k * 0.6), 0, TAU);
          ctx.fill();
        } else {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.w * k;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * (0.3 + (1 - k * k) * 0.9), 0, TAU);
          ctx.stroke();
        }
      }
      ctx.restore();
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const t of this.texts) {
        const k = t.t / t.life;
        const pop = k < 0.15 ? 0.6 + (k / 0.15) * 0.5 : 1.1 - Math.min(0.1, (k - 0.15));
        ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
        ctx.font = `900 ${(t.size * pop) / scale}px "PingFang SC","Microsoft YaHei",sans-serif`;
        ctx.lineWidth = 4 / scale;
        ctx.strokeStyle = 'rgba(0,0,0,.55)';
        ctx.strokeText(t.str, t.x, t.y);
        ctx.fillStyle = t.color;
        ctx.fillText(t.str, t.x, t.y);
      }
      ctx.restore();
    }
  };

  /* ---------------- HUD 辅助 ---------------- */
  G.leaderboard = (el, rows, meId) => {
    // rows: [{id,name,score}] 已排序
    let html = '';
    const top = rows.slice(0, 10);
    top.forEach((r, i) => {
      const medal = i === 0 ? '👑' : i + 1;
      html += `<li class="${r.id === meId ? 'me' : ''}${i < 3 ? ' top' + (i + 1) : ''}"><span class="rk">${medal}</span><span class="n">${G.esc(r.name)}</span><span class="s">${G.fmt(r.score)}</span></li>`;
    });
    const myIdx = rows.findIndex((r) => r.id === meId);
    if (myIdx >= 10) {
      const r = rows[myIdx];
      html += `<li class="sep"></li><li class="me"><span class="rk">${myIdx + 1}</span><span class="n">${G.esc(r.name)}</span><span class="s">${G.fmt(r.score)}</span></li>`;
    }
    el.innerHTML = html;
    return myIdx + 1;
  };

  G.feed = (html) => {
    const box = document.getElementById('feed');
    if (!box) return;
    const d = document.createElement('div');
    d.className = 'feed-item';
    d.innerHTML = html;
    box.prepend(d);
    while (box.children.length > 5) box.lastChild.remove();
    setTimeout(() => d.classList.add('fade'), 4500);
    setTimeout(() => d.remove(), 5200);
  };

  G.announce = (text, sub = '', color = '#ffd166') => {
    const box = document.getElementById('announce');
    if (!box) return;
    box.innerHTML = '';
    const d = document.createElement('div');
    d.className = 'ann';
    d.style.setProperty('--c', color);
    d.innerHTML = `<div class="ann-main">${text}</div>${sub ? `<div class="ann-sub">${sub}</div>` : ''}`;
    box.appendChild(d);
    setTimeout(() => d.remove(), 2200);
  };

  G.banner = (text) => {
    const el = document.getElementById('banner');
    if (!el) return;
    el.textContent = text;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  };

  G.streakName = (n) => ['', '', '双杀！', '三杀！', '四杀！', '五杀！', '超神！'][Math.min(n, 6)];

  // 静音 / 返回按钮
  G.bindTopButtons = () => {
    const m = document.getElementById('btn-mute');
    if (m) {
      const upd = () => (m.textContent = G.Sound.muted ? '🔇' : '🔊');
      upd();
      m.addEventListener('click', () => {
        G.Sound.init();
        G.Sound.toggle();
        upd();
      });
    }
  };
})();
