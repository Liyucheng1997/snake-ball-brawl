/* 贪吃蛇大乱斗 */
(() => {
  const { rand, randInt, pick, clamp, lerp, TAU, angleDiff } = G;

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const mm = document.getElementById('minimap');
  const mctx = mm.getContext('2d');
  let W = 0, H = 0, DPR = 1, vignette = null;

  function resize() {
    ({ w: W, h: H, dpr: DPR } = G.fitCanvas(canvas));
    const r = mm.getBoundingClientRect();
    mm.width = Math.round(r.width * DPR);
    mm.height = Math.round(r.height * DPR);
    vignette = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,10,0.55)');
  }
  window.addEventListener('resize', resize);
  resize();

  const input = new G.Input(canvas);
  G.bindTopButtons();

  /* ================= 配置 ================= */
  const WORLD_R = 3800;
  const FOOD_TARGET = 1700;
  const MAX_FOOD = 5200;
  const BOT_COUNT = 28;
  const POWER_TARGET = 16;

  const SKINS = [
    { id: 'neon', name: '霓虹', colors: ['#00f5d4', '#00f5d4', '#00bbf9', '#00bbf9'] },
    { id: 'rainbow', name: '彩虹', colors: ['#ff595e', '#ff924c', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93'] },
    { id: 'fire', name: '烈焰', colors: ['#ff4800', '#ff6d00', '#ff9e00', '#ffb700', '#ff9e00', '#ff6d00'] },
    { id: 'ocean', name: '深海', colors: ['#0077b6', '#0096c7', '#00b4d8', '#48cae4', '#00b4d8', '#0096c7'] },
    { id: 'candy', name: '糖果', colors: ['#ff70a6', '#ff70a6', '#fff0f6', '#fff0f6'] },
    { id: 'bee', name: '蜜蜂', colors: ['#ffd60a', '#ffd60a', '#2b2d42', '#2b2d42'] },
    { id: 'cyber', name: '赛博', colors: ['#f72585', '#b5179e', '#7209b7', '#560bad', '#3a0ca3', '#4361ee', '#4cc9f0'] },
    { id: 'toxic', name: '剧毒', colors: ['#9ef01a', '#70e000', '#38b000', '#70e000'] },
    { id: 'galaxy', name: '星河', colors: ['#7b2cbf', '#9d4edd', '#c77dff', '#e0aaff', '#c77dff', '#9d4edd'] },
    { id: 'sakura', name: '樱花', colors: ['#ffafcc', '#ffc8dd', '#cdb4db', '#ffc8dd'] },
    { id: 'gold', name: '黄金', colors: ['#ffd60a', '#ffc300', '#ffaa00', '#ffc300'] },
    { id: 'panda', name: '熊猫', colors: ['#f8f9fa', '#f8f9fa', '#343a40', '#343a40'] },
    { id: 'ice', name: '冰霜', colors: ['#caf0f8', '#ade8f4', '#90e0ef', '#48cae4', '#90e0ef', '#ade8f4'] },
    { id: 'lava', name: '熔岩', colors: ['#370617', '#6a040f', '#9d0208', '#d00000', '#dc2f02', '#e85d04'] },
  ];
  const FOOD_COLORS = ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93', '#00f5d4', '#f15bb5', '#fee440', '#00bbf9', '#ff924c', '#c77dff', '#72efdd'];

  const POWERS = {
    magnet: { icon: '🧲', name: '磁铁', color: '#ff4d6d', dur: 12, desc: '超远距离吸食' },
    speed: { icon: '⚡', name: '疾风', color: '#ffd60a', dur: 8, desc: '免费无限加速' },
    shield: { icon: '🛡️', name: '护盾', color: '#4cc9f0', dur: 8, desc: '穿越身体不死' },
    double: { icon: '✨', name: '双倍', color: '#c77dff', dur: 15, desc: '成长速度翻倍' },
  };
  const POWER_KEYS = Object.keys(POWERS);

  /* ================= 精灵缓存 ================= */
  const cache = new Map();
  function segSprite(color) {
    let s = cache.get(color);
    if (s) return s;
    const S = 64;
    s = document.createElement('canvas');
    s.width = s.height = S;
    const g = s.getContext('2d');
    const grd = g.createRadialGradient(S * 0.38, S * 0.32, S * 0.03, S * 0.5, S * 0.5, S * 0.5);
    grd.addColorStop(0, G.shade(color, 0.6));
    grd.addColorStop(0.42, color);
    grd.addColorStop(1, G.shade(color, -0.5));
    g.fillStyle = grd;
    g.beginPath();
    g.arc(S / 2, S / 2, S / 2 - 1.5, 0, TAU);
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,.28)';
    g.lineWidth = 2.5;
    g.stroke();
    cache.set(color, s);
    return s;
  }
  function glowSprite(color) {
    const key = 'g' + color;
    let s = cache.get(key);
    if (s) return s;
    const S = 64;
    s = document.createElement('canvas');
    s.width = s.height = S;
    const g = s.getContext('2d');
    const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    grd.addColorStop(0, 'rgba(255,255,255,0.95)');
    grd.addColorStop(0.16, G.rgba(color, 0.95));
    grd.addColorStop(0.42, G.rgba(color, 0.32));
    grd.addColorStop(1, G.rgba(color, 0));
    g.fillStyle = grd;
    g.fillRect(0, 0, S, S);
    cache.set(key, s);
    return s;
  }
  function powerSprite(type) {
    const key = 'p' + type;
    let s = cache.get(key);
    if (s) return s;
    const P = POWERS[type];
    const S = 128;
    s = document.createElement('canvas');
    s.width = s.height = S;
    const g = s.getContext('2d');
    const grd = g.createRadialGradient(S / 2, S / 2, 10, S / 2, S / 2, S / 2);
    grd.addColorStop(0, G.rgba(P.color, 0.7));
    grd.addColorStop(1, G.rgba(P.color, 0));
    g.fillStyle = grd;
    g.fillRect(0, 0, S, S);
    const ig = g.createRadialGradient(S * 0.42, S * 0.4, 2, S / 2, S / 2, 30);
    ig.addColorStop(0, 'rgba(60,70,110,.95)');
    ig.addColorStop(1, 'rgba(10,14,32,.95)');
    g.fillStyle = ig;
    g.beginPath();
    g.arc(S / 2, S / 2, 30, 0, TAU);
    g.fill();
    g.strokeStyle = P.color;
    g.lineWidth = 4;
    g.stroke();
    g.font = '32px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(P.icon, S / 2, S / 2 + 2);
    cache.set(key, s);
    return s;
  }
  // 六边形地板图案
  const hexPattern = (() => {
    const s = 38;
    const tw = Math.round(3 * s), th = Math.round(Math.sqrt(3) * s);
    const c = document.createElement('canvas');
    c.width = tw;
    c.height = th;
    const g = c.getContext('2d');
    g.fillStyle = '#0a1024';
    g.fillRect(0, 0, tw, th);
    const ky = th / (Math.sqrt(3) * s);
    const hex = (cx, cy, fill) => {
      g.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (k * Math.PI) / 3;
        const x = cx + Math.cos(a) * (s - 2), y = cy + Math.sin(a) * (s - 2) * ky;
        k ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.closePath();
      g.fillStyle = fill;
      g.fill();
      g.strokeStyle = 'rgba(90,120,220,.13)';
      g.lineWidth = 2;
      g.stroke();
    };
    const A = '#0d1430', B = '#0c122b';
    hex(0, 0, A); hex(tw, 0, A); hex(0, th, A); hex(tw, th, A);
    hex(tw / 2, th / 2, B); hex(tw / 2, -th / 2, B); hex(tw / 2, th * 1.5, B);
    return ctx.createPattern(c, 'repeat');
  })();

  /* ================= 世界状态 ================= */
  let time = 0;
  let snakes = [];
  let foods = [];
  let powers = [];
  let meteors = [];
  let naturalCount = 0;
  let player = null;
  let playing = false;
  let nextId = 1;
  let respawnQueue = [];
  let shake = 0;
  let spectate = null;
  let event = null;
  let nextEventT = 45;
  const particles = new G.Particles(1000);
  const segGrid = new G.Grid(90);
  const foodGrid = new G.Grid(120);
  const cam = { x: 0, y: 0, zoom: 1, userZoom: 1 };
  const stats = { peak: 0, bestRank: 99, start: 0, deathT: 0, killerName: '' };

  /* ================= 食物 ================= */
  function addFood(x, y, v, o = {}) {
    if (foods.length >= MAX_FOOD && !o.natural) return null;
    const f = {
      x, y, v,
      r: o.r || 3.2 + v * 1.25,
      color: o.color || pick(FOOD_COLORS),
      ph: rand(0, TAU),
      natural: !!o.natural,
      vx: o.vx || 0, vy: o.vy || 0,
      life: o.life || 0, age: 0, dead: false,
    };
    foods.push(f);
    if (f.natural) naturalCount++;
    return f;
  }
  function spawnNatural() {
    const a = rand(0, TAU), d = Math.sqrt(Math.random()) * (WORLD_R - 60);
    const gold = Math.random() < 0.015;
    addFood(Math.cos(a) * d, Math.sin(a) * d, gold ? 10 : randInt(1, 3), { natural: true, color: gold ? '#ffd60a' : undefined, r: gold ? 10 : undefined });
  }
  function spawnPower() {
    const a = rand(0, TAU), d = Math.sqrt(Math.random()) * (WORLD_R - 200);
    powers.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, type: pick(POWER_KEYS), ph: rand(0, TAU), dead: false });
  }

  /* ================= 蛇 ================= */
  class Snake {
    constructor(name, skin, isBot, x, y, score) {
      this.id = nextId++;
      this.name = name;
      this.skin = skin;
      this.isBot = isBot;
      this.score = score;
      this.angle = rand(0, TAU);
      this.targetAngle = this.angle;
      this.alive = true;
      this.kills = 0;
      this.streak = 0;
      this.lastKillT = -99;
      this.boost = false;
      this.wantBoost = false;
      this.power = { magnet: 0, speed: 0, shield: 0, double: 0 };
      this.guard = 2.5;
      this.dropAcc = 0;
      this.r = this.calcR();
      this.segs = [];
      const sp = this.r * 0.42;
      const n = this.targetLen();
      for (let i = 0; i < n; i++) this.segs.push({ x: x - Math.cos(this.angle) * i * sp, y: y - Math.sin(this.angle) * i * sp, o: this, i });
      if (isBot) this.ai = { t: rand(0, 0.2), react: rand(0.09, 0.3), skill: rand(0.55, 1.1), aggro: Math.random(), wander: this.angle, wT: 0, goal: null, boostT: 0 };
    }
    calcR() {
      return Math.min(9 + Math.sqrt(Math.max(0, this.score)) * 0.3, 36);
    }
    targetLen() {
      return Math.min(Math.floor(12 + Math.pow(Math.max(0, this.score), 0.75) * 0.9), 620);
    }
    get head() {
      return this.segs[0];
    }
    update(dt) {
      const r = (this.r = this.calcR());
      for (const k in this.power) if (this.power[k] > 0) this.power[k] = Math.max(0, this.power[k] - dt);
      if (this.guard > 0) this.guard -= dt;

      const turn = lerp(5.6, 2.4, clamp((r - 9) / 27, 0, 1)) * (this.boost ? 0.85 : 1);
      const d = angleDiff(this.angle, this.targetAngle);
      this.angle += clamp(d, -turn * dt, turn * dt);

      const free = this.power.speed > 0;
      const wasBoost = this.boost;
      this.boost = this.wantBoost && (free || this.score > 15);
      if (this === player && this.boost && !wasBoost) G.Sound.play('boost');
      let speed = this.boost ? 450 : 225;
      if (free) speed *= 1.2;

      const h = this.segs[0];
      h.x += Math.cos(this.angle) * speed * dt;
      h.y += Math.sin(this.angle) * speed * dt;

      const sp = r * 0.42;
      const segs = this.segs;
      for (let i = 1; i < segs.length; i++) {
        const a = segs[i - 1], b = segs[i];
        const dx = b.x - a.x, dy = b.y - a.y;
        const dd = Math.sqrt(dx * dx + dy * dy);
        if (dd > sp) {
          const k = sp / dd;
          b.x = a.x + dx * k;
          b.y = a.y + dy * k;
        }
      }
      const tl = this.targetLen();
      if (segs.length < tl) {
        const t = segs[segs.length - 1];
        segs.push({ x: t.x, y: t.y, o: this, i: segs.length });
      } else if (segs.length > tl + 1) segs.pop();

      // 体型越大代谢越快，防止无限膨胀
      if (this.score > 300) this.score -= (this.score - 300) * 0.006 * dt;

      if (this.boost && !free) {
        const cost = (3 + this.score * 0.012) * dt;
        this.score -= cost;
        this.dropAcc += cost;
        if (this.dropAcc > 2.5) {
          const t = segs[segs.length - 1];
          addFood(t.x + rand(-5, 5), t.y + rand(-5, 5), this.dropAcc * 0.75, { color: this.skin.colors[0], life: 25 });
          this.dropAcc = 0;
        }
      }
      if (this.boost && Math.random() < 0.5) {
        const t = segs[segs.length - 1];
        particles.burst(t.x, t.y, pick(this.skin.colors), 1, { speed: 60, size: r * 0.25, life: 0.5 });
      }

      const R = WORLD_R - r * 0.5;
      if (h.x * h.x + h.y * h.y > R * R) {
        if (this.power.shield > 0 || this.guard > 0) {
          const a = Math.atan2(h.y, h.x);
          h.x = Math.cos(a) * (R - 2);
          h.y = Math.sin(a) * (R - 2);
          this.angle = a + Math.PI + rand(-0.5, 0.5);
          this.targetAngle = this.angle;
        } else killSnake(this, null);
      }
    }
  }

  function segColor(s, i) {
    const c = s.skin.colors;
    return c[Math.floor(i / 3) % c.length];
  }

  function randomSkin() {
    return pick(SKINS);
  }

  function safeSpot(minD = 700) {
    let best = null, bestD = -1;
    for (let tries = 0; tries < 30; tries++) {
      const a = rand(0, TAU), d = Math.sqrt(Math.random()) * WORLD_R * 0.82;
      const x = Math.cos(a) * d, y = Math.sin(a) * d;
      let md = Infinity;
      for (const s of snakes) {
        if (!s.alive) continue;
        for (let i = 0; i < s.segs.length; i += 6) {
          const g = s.segs[i];
          const dd = (g.x - x) ** 2 + (g.y - y) ** 2;
          if (dd < md) md = dd;
        }
      }
      md = Math.sqrt(md);
      if (md > bestD) {
        bestD = md;
        best = { x, y };
      }
      if (md > minD) break;
    }
    return best;
  }

  function spawnBot(initial) {
    const p = safeSpot(player && player.alive ? 900 : 500);
    let score;
    const r = Math.random();
    if (initial) score = r < 0.55 ? rand(10, 80) : r < 0.88 ? rand(100, 600) : rand(800, 2400);
    else score = r < 0.85 ? rand(10, 140) : rand(200, 800);
    const s = new Snake(G.botName(), randomSkin(), true, p.x, p.y, score);
    s.angle = s.targetAngle = Math.atan2(-p.y, -p.x) + rand(-1, 1);
    snakes.push(s);
    return s;
  }

  /* ================= 死亡 & 击杀 ================= */
  function killSnake(s, killer) {
    if (!s.alive) return;
    s.alive = false;
    const segs = s.segs;
    const total = s.score * 0.78 + 6;
    const step = Math.max(1, Math.ceil(segs.length / 160));
    const count = Math.ceil(segs.length / step);
    const v = total / count;
    for (let i = 0; i < segs.length; i += step) {
      const g = segs[i];
      addFood(g.x + rand(-s.r, s.r) * 0.6, g.y + rand(-s.r, s.r) * 0.6, v, {
        color: segColor(s, i), r: clamp(4 + Math.sqrt(v) * 2.2, 5, 15), life: rand(40, 55), vx: rand(-50, 50), vy: rand(-50, 50),
      });
    }
    const h = segs[0];
    particles.burst(h.x, h.y, s.skin.colors[0], 30, { speed: 360, size: s.r * 0.35, life: 1 });
    particles.ring(h.x, h.y, s.skin.colors[0], s.r * 5, 0.7, 6);

    if (killer && killer.alive) {
      killer.kills++;
      killer.streak = time - killer.lastKillT < 9 ? killer.streak + 1 : 1;
      killer.lastKillT = time;
    }
    const rows = ranking();
    const important = s === player || killer === player || s.score > 400 || (killer && rows.indexOf(killer) < 3);
    if (important) {
      if (killer) G.feed(`<b>${G.esc(killer.name)}</b> <span class="k">⚔</span> ${G.esc(s.name)} <span style="opacity:.6">(${G.fmt(s.score)})</span>`);
      else G.feed(`${G.esc(s.name)} <span class="k">撞上了边界</span>`);
    }
    if (killer === player) {
      G.Sound.play('kill');
      const big = G.streakName(player.streak);
      G.announce(big || '击杀！', `你击败了 ${G.esc(s.name)}`, player.streak >= 3 ? '#ff4d6d' : '#ffd166');
      shake = Math.max(shake, 8);
    }
    if (s === player) onPlayerDeath(killer);
    else {
      G.releaseName(s.name);
      respawnQueue.push(rand(1.5, 4));
    }
  }

  function ranking() {
    return snakes.filter((s) => s.alive).sort((a, b) => b.score - a.score);
  }

  /* ================= AI ================= */
  const OFFS = [0, -0.35, 0.35, -0.7, 0.7, -1.1, 1.1, -1.6, 1.6, -2.2, 2.2, Math.PI];
  function danger(s, a, look) {
    const h = s.segs[0];
    const ca = Math.cos(a), sa = Math.sin(a);
    const steps = 4;
    const lim = (WORLD_R - s.r * 2) ** 2;
    for (let k = 1; k <= steps; k++) {
      const t = k / steps;
      const px = h.x + ca * look * t, py = h.y + sa * look * t;
      if (px * px + py * py > lim) return (steps - k + 1) / steps;
      let hit = false;
      segGrid.query(px, py, s.r + 42, (g) => {
        const o = g.o;
        if (o === s || !o.alive || o.guard > 0) return;
        const rr = s.r + o.r + 6;
        const dx = g.x - px, dy = g.y - py;
        if (dx * dx + dy * dy < rr * rr) {
          hit = true;
          return false;
        }
      });
      if (hit) return (steps - k + 1) / steps;
    }
    return 0;
  }

  function botThink(s) {
    const ai = s.ai;
    const h = s.segs[0];
    const r = s.r;
    let desired = s.targetAngle;
    let boost = false;
    const dc = Math.hypot(h.x, h.y);

    if (dc > WORLD_R - 320) {
      desired = Math.atan2(-h.y, -h.x) + rand(-0.4, 0.4);
    } else {
      let bx = 0, by = 0, best = 0;
      // 道具
      for (const p of powers) {
        if (p.dead) continue;
        const d = Math.hypot(p.x - h.x, p.y - h.y);
        if (d < 550) {
          const sc = 9 / (d + 60);
          if (sc > best) { best = sc; bx = p.x; by = p.y; }
        }
      }
      // 食物（偏好前方 & 大颗）
      foodGrid.query(h.x, h.y, 430, (f) => {
        if (f.dead) return;
        const dx = f.x - h.x, dy = f.y - h.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > 430) return;
        const front = 1 + 0.6 * Math.cos(angleDiff(s.angle, Math.atan2(dy, dx)));
        const sc = (f.v / (d + 60)) * front;
        if (sc > best) { best = sc; bx = f.x; by = f.y; }
      });
      // 围剿：去对手头部前方拦截
      if (ai.aggro > 0.4) {
        for (const o of snakes) {
          if (o === s || !o.alive || o.guard > 0) continue;
          const oh = o.segs[0];
          const d = Math.hypot(oh.x - h.x, oh.y - h.y);
          if (d < 420 && d > 30 && o.r <= r * 1.2) {
            const lead = 70 + o.r * 3 + d * 0.45;
            const sc = (ai.aggro * 1.6) / (d + 80);
            if (sc > best) {
              best = sc;
              bx = oh.x + Math.cos(o.angle) * lead;
              by = oh.y + Math.sin(o.angle) * lead;
              boost = d < 280 && s.score > 40 && Math.random() < ai.aggro;
            }
          }
        }
      }
      // 事件（流星雨）
      if (ai.goal) {
        const d = Math.hypot(ai.goal.x - h.x, ai.goal.y - h.y);
        if (d < 200 || !event) ai.goal = null;
        else if (best < 0.03) { bx = ai.goal.x; by = ai.goal.y; best = 1; boost = d > 900 && s.score > 60 && Math.random() < 0.3; }
      }
      if (best > 0) desired = Math.atan2(by - h.y, bx - h.x);
      else {
        ai.wT -= ai.react;
        if (ai.wT <= 0) { ai.wander = s.angle + rand(-1.3, 1.3); ai.wT = rand(1, 3); }
        desired = ai.wander;
      }
    }

    // 避障
    if (s.power.shield <= 0) {
      const look = (70 + r * 4.6 + (s.boost ? 150 : 0)) * ai.skill;
      if (danger(s, desired, look) > 0) {
        let bestA = desired, bestD = 9;
        for (const off of OFFS) {
          const a = s.angle + off;
          const dd = danger(s, a, look) + Math.abs(off) * 0.03;
          if (dd < bestD) { bestD = dd; bestA = a; }
        }
        desired = bestA;
        if (bestD > 0.5) boost = false;
      }
    }
    s.targetAngle = desired;
    if (Math.random() < 0.004 && s.score > 80) ai.boostT = rand(0.4, 1.2);
    s.wantBoost = boost || ai.boostT > 0;
  }

  /* ================= 游戏流程 ================= */
  function initWorld() {
    snakes = [];
    foods = [];
    naturalCount = 0;
    powers = [];
    for (let i = 0; i < FOOD_TARGET; i++) spawnNatural();
    for (let i = 0; i < POWER_TARGET; i++) spawnPower();
    for (let i = 0; i < BOT_COUNT; i++) spawnBot(true);
    spectate = snakes[0];
  }

  let selectedSkin = G.store.get('snake_skin', 'neon');
  const nameInput = document.getElementById('name');
  nameInput.value = G.store.get('name', '');

  function startGame() {
    const name = (nameInput.value.trim() || '无名小蛇').slice(0, 10);
    G.store.set('name', name);
    G.store.set('snake_skin', selectedSkin);
    const skin = SKINS.find((s) => s.id === selectedSkin) || SKINS[0];
    const p = safeSpot(900);
    player = new Snake(name, skin, false, p.x, p.y, 10);
    player.guard = 3;
    snakes.push(player);
    playing = true;
    stats.peak = 10;
    stats.bestRank = 99;
    stats.start = time;
    cam.x = p.x;
    cam.y = p.y;
    document.getElementById('start').classList.add('hidden');
    document.getElementById('over').classList.add('hidden');
    document.body.classList.remove('menu');
    G.Sound.init();
    G.Sound.play('start');
    G.announce('开始！', '吃掉光点变长，让对手撞上你的身体', '#00f5d4');
  }

  function onPlayerDeath(killer) {
    playing = false;
    stats.deathT = time;
    stats.killerName = killer ? killer.name : '';
    G.Sound.play('death');
    shake = 18;
    const best = G.store.get('snake_best', 0);
    const peak = Math.floor(stats.peak);
    const isBest = peak > best;
    if (isBest) G.store.set('snake_best', peak);
    setTimeout(() => {
      document.getElementById('ov-killer').innerHTML = killer ? `你被 <b>${G.esc(killer.name)}</b> 拦截了` : '你撞上了竞技场边界';
      document.getElementById('ov-peak').textContent = G.fmt(peak);
      document.getElementById('ov-rank').textContent = stats.bestRank < 99 ? '#' + stats.bestRank : '-';
      document.getElementById('ov-kills').textContent = player.kills;
      document.getElementById('ov-time').textContent = G.fmtTime(stats.deathT - stats.start);
      document.getElementById('ov-best').textContent = isBest ? '🏆 新纪录！' : `历史最佳 ${G.fmt(best)}`;
      document.getElementById('over').classList.remove('hidden');
      document.body.classList.add('menu');
    }, 1300);
  }

  function startEvent() {
    const a = rand(0, TAU), d = rand(0.15, 0.7) * WORLD_R;
    event = { x: Math.cos(a) * d, y: Math.sin(a) * d, t: 0, left: 46, spawnT: 0 };
    const dir = ['东', '东南', '南', '西南', '西', '西北', '北', '东北'][Math.round(((a + TAU) % TAU) / (Math.PI / 4)) % 8];
    G.banner(`🌠 流星雨降临在地图${d < WORLD_R * 0.3 ? '中央' : dir + '方'}！小地图上闪烁处有大量能量`);
    G.Sound.play('event');
    for (const s of snakes) if (s.isBot && s.alive && Math.random() < 0.55) s.ai.goal = { x: event.x, y: event.y };
  }

  /* ================= 更新 ================= */
  function update(dt) {
    time += dt;

    // 玩家操控
    if (player && player.alive) {
      const h = player.segs[0];
      if (input.isTouch && input.joy.active) {
        player.targetAngle = Math.atan2(input.joy.y, input.joy.x);
      } else if (!input.isTouch) {
        const sx = (h.x - cam.x) * cam.zoom + W / 2, sy = (h.y - cam.y) * cam.zoom + H / 2;
        if (Math.hypot(input.mx - sx, input.my - sy) > 4) player.targetAngle = Math.atan2(input.my - sy, input.mx - sx);
      }
      player.wantBoost = input.mouseDown || input.keys[' '] || input.keys['shift'] || !!input.held.boost;
    }
    if (input.wheel) cam.userZoom = clamp(cam.userZoom * (input.wheel > 0 ? 0.9 : 1.1), 0.6, 1.6);
    if (input.tapped('enter') && !playing && document.querySelector('.overlay:not(.hidden)')) startGame();

    // AI 决策
    for (const s of snakes) {
      if (!s.alive || !s.isBot) continue;
      s.ai.boostT -= dt;
      s.ai.t -= dt;
      if (s.ai.t <= 0) {
        s.ai.t = s.ai.react;
        botThink(s);
      }
    }
    for (const s of snakes) if (s.alive) s.update(dt);

    // 网格
    segGrid.clear();
    for (const s of snakes) {
      if (!s.alive) continue;
      const segs = s.segs;
      for (let i = 0; i < segs.length; i++) {
        segs[i].i = i;
        segGrid.insert(segs[i], segs[i].x, segs[i].y);
      }
    }
    foodGrid.clear();
    for (const f of foods) if (!f.dead) foodGrid.insert(f, f.x, f.y);

    // 碰撞
    for (const s of snakes) {
      if (!s.alive || s.guard > 0 || s.power.shield > 0) continue;
      const h = s.segs[0], hr = s.r;
      let hit = null;
      segGrid.query(h.x, h.y, hr + 40, (g) => {
        const o = g.o;
        if (o === s || !o.alive || o.guard > 0) return;
        const rr = hr * 0.72 + o.r * 0.86;
        const dx = g.x - h.x, dy = g.y - h.y;
        if (dx * dx + dy * dy < rr * rr) {
          if (g.i < 2 && o.r < hr) return; // 头碰头：体型小的一方出局
          hit = o;
          return false;
        }
      });
      if (hit) killSnake(s, hit);
    }

    // 吃食物
    for (const s of snakes) {
      if (!s.alive) continue;
      const h = s.segs[0];
      const mag = s.power.magnet > 0;
      const suck = s.r * 2.3 + 28 + (mag ? 260 : 0);
      const mult = s.power.double > 0 ? 2 : 1;
      let ate = 0, big = false;
      foodGrid.query(h.x, h.y, suck + 16, (f) => {
        if (f.dead) return;
        const dx = h.x - f.x, dy = h.y - f.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > suck * suck) return;
        const d = Math.sqrt(d2) || 1;
        if (d < s.r + f.r * 0.5 + 4) {
          f.dead = true;
          s.score += f.v * mult;
          ate++;
          if (f.v >= 5) big = true;
          if (s === player) particles.burst(f.x, f.y, f.color, 2, { speed: 90, size: 3, life: 0.4 });
        } else {
          const v = (mag ? 520 : 320) + 700 * (1 - d / suck);
          const m = Math.min(d, v * dt);
          f.x += (dx / d) * m;
          f.y += (dy / d) * m;
        }
      });
      if (ate && s === player) G.Sound.play(big ? 'big' : 'eat');
      // 道具
      for (const p of powers) {
        if (p.dead) continue;
        const rr = s.r + 22 + (mag ? 40 : 0);
        if ((p.x - h.x) ** 2 + (p.y - h.y) ** 2 < rr * rr) {
          p.dead = true;
          const P = POWERS[p.type];
          s.power[p.type] = P.dur;
          particles.ring(p.x, p.y, P.color, 70, 0.6, 5);
          particles.burst(p.x, p.y, P.color, 16, { speed: 240, size: 4, life: 0.7 });
          if (s === player) {
            G.Sound.play('power');
            G.announce(P.icon + ' ' + P.name, P.desc, P.color);
          }
        }
      }
      if (s === player) {
        stats.peak = Math.max(stats.peak, s.score);
      }
    }

    // 食物维护
    let w = 0;
    for (let i = 0; i < foods.length; i++) {
      const f = foods[i];
      if (!f.dead) {
        if (f.vx || f.vy) {
          const k = Math.exp(-2.5 * dt);
          f.vx *= k;
          f.vy *= k;
          f.x += f.vx * dt;
          f.y += f.vy * dt;
          if (Math.abs(f.vx) + Math.abs(f.vy) < 1) f.vx = f.vy = 0;
        }
        if (f.life) {
          f.age += dt;
          if (f.age > f.life) f.dead = true;
        }
      }
      if (f.dead) {
        if (f.natural) naturalCount--;
        continue;
      }
      foods[w++] = f;
    }
    foods.length = w;
    for (let i = 0; i < 25 && naturalCount < FOOD_TARGET; i++) spawnNatural();
    powers = powers.filter((p) => !p.dead);
    if (powers.length < POWER_TARGET && Math.random() < dt * 0.5) spawnPower();

    // 流星雨事件
    nextEventT -= dt;
    if (nextEventT <= 0 && !event) {
      startEvent();
      nextEventT = rand(70, 100);
    }
    if (event) {
      event.t += dt;
      event.spawnT -= dt;
      if (event.left > 0 && event.spawnT <= 0) {
        event.spawnT = 0.11;
        event.left--;
        const a = rand(0, TAU), d = Math.sqrt(Math.random()) * 420;
        meteors.push({ x: event.x + Math.cos(a) * d, y: event.y + Math.sin(a) * d, t: 0, dur: rand(0.7, 1.1), color: pick(FOOD_COLORS) });
      }
      if (event.t > 30) event = null;
    }
    for (let i = meteors.length - 1; i >= 0; i--) {
      const m = meteors[i];
      m.t += dt;
      if (m.t >= m.dur) {
        meteors.splice(i, 1);
        for (let k = 0; k < 6; k++) {
          const a = rand(0, TAU), v = rand(60, 200);
          addFood(m.x, m.y, rand(2.5, 6), { color: m.color, life: 60, vx: Math.cos(a) * v, vy: Math.sin(a) * v });
        }
        particles.ring(m.x, m.y, m.color, 60, 0.5, 4);
        particles.burst(m.x, m.y, m.color, 10, { speed: 260, size: 4, life: 0.6 });
      }
    }

    particles.update(dt);

    // 移除死蛇 & 补充
    snakes = snakes.filter((s) => s.alive || s === player);
    for (let i = respawnQueue.length - 1; i >= 0; i--) {
      respawnQueue[i] -= dt;
      if (respawnQueue[i] <= 0) {
        respawnQueue.splice(i, 1);
        spawnBot(false);
      }
    }

    // 相机
    let tx, ty, tz;
    if (player && (player.alive || playing)) {
      tx = player.segs[0].x;
      ty = player.segs[0].y;
      tz = clamp(1.05 - (player.r - 9) * 0.017, 0.5, 1.05);
    } else if (player && !player.alive && time - stats.deathT < 6) {
      tx = cam.x;
      ty = cam.y;
      tz = 0.7;
    } else {
      if (!spectate || !spectate.alive) spectate = ranking()[randInt(0, 4)] || snakes[0];
      tx = spectate ? spectate.segs[0].x : 0;
      ty = spectate ? spectate.segs[0].y : 0;
      tz = 0.75;
    }
    const screenK = clamp(Math.sqrt(W * H) / 1050, 0.6, 1.3);
    cam.zoom = lerp(cam.zoom, tz * screenK * cam.userZoom, 1 - Math.exp(-2.5 * dt));
    const ck = 1 - Math.exp(-14 * dt);
    cam.x = lerp(cam.x, tx, ck);
    cam.y = lerp(cam.y, ty, ck);
    shake *= Math.exp(-6 * dt);
  }

  /* ================= 渲染 ================= */
  function render() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = '#05081a';
    ctx.fillRect(0, 0, W, H);

    const z = cam.zoom;
    const sx = shake > 0.3 ? rand(-shake, shake) : 0, sy = shake > 0.3 ? rand(-shake, shake) : 0;
    ctx.setTransform(DPR * z, 0, 0, DPR * z, DPR * (W / 2 - cam.x * z + sx), DPR * (H / 2 - cam.y * z + sy));
    const vw = W / z, vh = H / z;
    const x0 = cam.x - vw / 2, y0 = cam.y - vh / 2, x1 = x0 + vw, y1 = y0 + vh;

    // 地板（限制在竞技场内）
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, WORLD_R, 0, TAU);
    ctx.clip();
    ctx.fillStyle = hexPattern;
    ctx.fillRect(x0, y0, vw, vh);
    ctx.restore();

    // 边界
    const camD = Math.hypot(cam.x, cam.y);
    if (camD + Math.hypot(vw, vh) / 2 > WORLD_R - 50) {
      ctx.save();
      const pulse = 0.6 + 0.4 * Math.sin(time * 3);
      ctx.strokeStyle = `rgba(255,40,90,${0.15 * pulse})`;
      ctx.lineWidth = 60;
      ctx.beginPath();
      ctx.arc(0, 0, WORLD_R + 30, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,60,110,${0.35 + 0.3 * pulse})`;
      ctx.lineWidth = 14;
      ctx.stroke();
      ctx.strokeStyle = '#ff5c8a';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, WORLD_R, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }

    // 事件光圈
    if (event) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const k = Math.min(1, event.t / 1.5) * (event.t > 26 ? (30 - event.t) / 4 : 1);
      ctx.strokeStyle = `rgba(199,125,255,${0.35 * k})`;
      ctx.lineWidth = 6;
      ctx.setLineDash([30, 20]);
      ctx.lineDashOffset = -time * 60;
      ctx.beginPath();
      ctx.arc(event.x, event.y, 470, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }

    // 食物
    ctx.globalCompositeOperation = 'lighter';
    const m = 40;
    for (let i = 0; i < foods.length; i++) {
      const f = foods[i];
      if (f.x < x0 - m || f.x > x1 + m || f.y < y0 - m || f.y > y1 + m) continue;
      const pulse = 1 + 0.2 * Math.sin(time * 3.2 + f.ph);
      let a = 1;
      if (f.life && f.life - f.age < 4) a = Math.max(0, (f.life - f.age) / 4) * (0.6 + 0.4 * Math.sin(time * 18));
      ctx.globalAlpha = a;
      const s = f.r * 3.1 * pulse;
      ctx.drawImage(glowSprite(f.color), f.x - s, f.y - s, s * 2, s * 2);
    }
    ctx.globalAlpha = 1;

    // 流星
    for (const mt of meteors) {
      const k = mt.t / mt.dur;
      const ox = 520 * (1 - k), oy = -860 * (1 - k);
      const px = mt.x + ox, py = mt.y + oy;
      const grd = ctx.createLinearGradient(px, py, px + 120, py - 200);
      grd.addColorStop(0, G.rgba(mt.color, 0.9));
      grd.addColorStop(1, G.rgba(mt.color, 0));
      ctx.strokeStyle = grd;
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + 120, py - 200);
      ctx.stroke();
      const s = 34;
      ctx.drawImage(glowSprite(mt.color), px - s, py - s, s * 2, s * 2);
      // 落点提示
      ctx.globalAlpha = 0.3 * k;
      ctx.strokeStyle = mt.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(mt.x, mt.y, 30 * (1.5 - k), 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.globalCompositeOperation = 'source-over';

    // 道具
    for (const p of powers) {
      if (p.x < x0 - 80 || p.x > x1 + 80 || p.y < y0 - 80 || p.y > y1 + 80) continue;
      const bob = Math.sin(time * 2.5 + p.ph) * 5;
      const s = 34 + Math.sin(time * 4 + p.ph) * 2;
      ctx.drawImage(powerSprite(p.type), p.x - s, p.y - s + bob, s * 2, s * 2);
      ctx.save();
      ctx.strokeStyle = G.rgba(POWERS[p.type].color, 0.7);
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 8]);
      ctx.lineDashOffset = time * 20;
      ctx.beginPath();
      ctx.arc(p.x, p.y + bob, 24, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }

    // 蛇
    const order = snakes.filter((s) => s.alive).sort((a, b) => (a === player ? 1 : b === player ? -1 : a.score - b.score));
    for (const s of order) drawSnake(s, x0, y0, x1, y1);

    // 粒子
    particles.draw(ctx, z, true);

    // 名字
    const top = ranking()[0];
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    for (const s of order) {
      const h = s.segs[0];
      if (h.x < x0 - 100 || h.x > x1 + 100 || h.y < y0 - 100 || h.y > y1 + 100) continue;
      const fs = 13 / z;
      ctx.font = `700 ${fs}px "PingFang SC","Microsoft YaHei",sans-serif`;
      const ny = h.y - s.r - 10 / z;
      ctx.lineWidth = 3 / z;
      ctx.strokeStyle = 'rgba(0,0,0,.6)';
      ctx.strokeText(s.name, h.x, ny);
      ctx.fillStyle = s === player ? '#ffd166' : 'rgba(255,255,255,.88)';
      ctx.fillText(s.name, h.x, ny);
      if (s === top) {
        ctx.font = `${18 / z}px "Segoe UI Emoji",sans-serif`;
        ctx.fillText('👑', h.x, ny - fs - 2 / z);
      }
    }

    // 暗角
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);
  }

  function drawSnake(s, x0, y0, x1, y1) {
    const segs = s.segs, n = segs.length, r = s.r;
    const cols = s.skin.colors;
    const m = r * 2.5;
    // 加速辉光
    if (s.boost) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.45 + 0.2 * Math.sin(time * 22);
      const gr = r * 2.3;
      for (let i = n - 1; i >= 0; i -= 2) {
        const g = segs[i];
        if (g.x < x0 - m || g.x > x1 + m || g.y < y0 - m || g.y > y1 + m) continue;
        ctx.drawImage(glowSprite(segColor(s, i)), g.x - gr, g.y - gr, gr * 2, gr * 2);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    if (s.guard > 0) ctx.globalAlpha = 0.45 + 0.25 * Math.sin(time * 14);
    for (let i = n - 1; i >= 0; i--) {
      const g = segs[i];
      if (g.x < x0 - m || g.x > x1 + m || g.y < y0 - m || g.y > y1 + m) continue;
      const ft = n - 1 - i;
      const rr = ft < 10 ? r * (0.5 + 0.05 * ft) : r;
      ctx.drawImage(segSprite(segColor(s, i)), g.x - rr, g.y - rr, rr * 2, rr * 2);
    }
    const h = segs[0];
    if (h.x < x0 - m || h.x > x1 + m || h.y < y0 - m || h.y > y1 + m) {
      ctx.globalAlpha = 1;
      return;
    }
    const a = s.angle;
    const hr = r * 1.12;
    ctx.drawImage(segSprite(cols[0]), h.x - hr, h.y - hr, hr * 2, hr * 2);
    // 眼睛
    const look = s.targetAngle;
    const ca = Math.cos(a), sa = Math.sin(a);
    for (const side of [-1, 1]) {
      const ex = h.x + ca * r * 0.35 - sa * side * r * 0.52;
      const ey = h.y + sa * r * 0.35 + ca * side * r * 0.52;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(ex, ey, r * 0.4, 0, TAU);
      ctx.fill();
      const px = ex + Math.cos(look) * r * 0.15, py = ey + Math.sin(look) * r * 0.15;
      ctx.fillStyle = '#10121c';
      ctx.beginPath();
      ctx.arc(px, py, r * 0.22, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(px - r * 0.07, py - r * 0.08, r * 0.075, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // 护盾
    if (s.power.shield > 0) {
      const k = s.power.shield < 2 ? 0.5 + 0.5 * Math.sin(time * 20) : 1;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const R = r * 2 + Math.sin(time * 6) * 2;
      const grd = ctx.createRadialGradient(h.x, h.y, R * 0.5, h.x, h.y, R);
      grd.addColorStop(0, 'rgba(76,201,240,0)');
      grd.addColorStop(1, `rgba(76,201,240,${0.45 * k})`);
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(h.x, h.y, R, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = `rgba(160,235,255,${0.8 * k})`;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();
    }
    // 磁铁光环
    if (s.power.magnet > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,77,109,.35)';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 14]);
      ctx.lineDashOffset = -time * 40;
      ctx.beginPath();
      ctx.arc(h.x, h.y, r * 2.3 + 28 + 260, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
    if (s.power.speed > 0 && s.boost) {
      particles.burst(h.x - ca * r, h.y - sa * r, '#ffd60a', 1, { speed: 120, size: 3, life: 0.35, angle: a + Math.PI, spread: 0.8 });
    }
  }

  function drawMinimap() {
    const S = mm.width;
    if (!S) return;
    mctx.clearRect(0, 0, S, mm.height);
    const c = S / 2, R = S / 2 - 3 * DPR, k = R / WORLD_R;
    mctx.fillStyle = 'rgba(10,14,34,.62)';
    mctx.beginPath();
    mctx.arc(c, c, R, 0, TAU);
    mctx.fill();
    mctx.strokeStyle = 'rgba(255,92,138,.6)';
    mctx.lineWidth = 2 * DPR;
    mctx.stroke();
    mctx.strokeStyle = 'rgba(255,255,255,.06)';
    mctx.lineWidth = 1;
    mctx.beginPath();
    mctx.moveTo(c - R, c); mctx.lineTo(c + R, c); mctx.moveTo(c, c - R); mctx.lineTo(c, c + R);
    mctx.stroke();
    if (event) {
      const p = 0.5 + 0.5 * Math.sin(time * 6);
      mctx.fillStyle = `rgba(199,125,255,${0.25 + 0.35 * p})`;
      mctx.beginPath();
      mctx.arc(c + event.x * k, c + event.y * k, (420 * k) + 3 * DPR * p, 0, TAU);
      mctx.fill();
    }
    mctx.lineCap = 'round';
    for (const s of snakes) {
      if (!s.alive) continue;
      const me = s === player;
      mctx.strokeStyle = me ? '#ffffff' : G.rgba(s.skin.colors[0], 0.85);
      mctx.lineWidth = Math.max(me ? 3 : 2, s.r * k * 2.2) * DPR * 0.8;
      mctx.beginPath();
      const step = Math.max(4, Math.floor(s.segs.length / 12));
      for (let i = 0; i < s.segs.length; i += step) {
        const g = s.segs[i];
        i ? mctx.lineTo(c + g.x * k, c + g.y * k) : mctx.moveTo(c + g.x * k, c + g.y * k);
      }
      if (s.segs.length <= step) mctx.lineTo(c + s.segs[0].x * k + 0.5, c + s.segs[0].y * k);
      mctx.stroke();
    }
    if (player && player.alive) {
      const h = player.segs[0];
      mctx.fillStyle = '#ffd166';
      mctx.beginPath();
      mctx.arc(c + h.x * k, c + h.y * k, 3.5 * DPR, 0, TAU);
      mctx.fill();
    }
  }

  /* ================= HUD ================= */
  const lbEl = document.getElementById('lb');
  const pwEl = document.getElementById('powers');
  let hudT = 0, mmT = 0;
  function updateHud(dt) {
    hudT -= dt;
    mmT -= dt;
    if (mmT <= 0) {
      mmT = 0.1;
      drawMinimap();
    }
    if (hudT > 0) return;
    hudT = 0.25;
    const rows = ranking();
    const rank = G.leaderboard(lbEl, rows.map((s) => ({ id: s.id, name: s.name, score: s.score })), player && player.alive ? player.id : -1);
    if (player && player.alive) {
      stats.bestRank = Math.min(stats.bestRank, rank);
      document.getElementById('st-score').textContent = G.fmt(player.score);
      document.getElementById('st-rank').textContent = `${rank}/${rows.length}`;
      document.getElementById('st-kills').textContent = player.kills;
      document.getElementById('st-time').textContent = G.fmtTime(time - stats.start);
      let html = '';
      for (const k of POWER_KEYS) {
        const t = player.power[k];
        if (t > 0) html += `<div class="pw" style="--c:${POWERS[k].color}">${POWERS[k].icon}<div class="bar" style="width:${(t / POWERS[k].dur) * 100}%"></div></div>`;
      }
      if (pwEl.dataset.k !== html) {
        pwEl.innerHTML = html;
        pwEl.dataset.k = html;
      }
    } else if (pwEl.innerHTML) {
      pwEl.innerHTML = '';
      pwEl.dataset.k = '';
    }
  }

  /* ================= 皮肤选择 ================= */
  function drawSkinPreview(cv, skin) {
    const g = cv.getContext('2d');
    const w = cv.width, h = cv.height;
    g.clearRect(0, 0, w, h);
    const n = 16, r = 9;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      pts.push({ x: w - 18 - t * (w - 36), y: h / 2 + Math.sin(t * Math.PI * 2.1) * 14 });
    }
    for (let i = n - 1; i >= 0; i--) {
      const p = pts[i];
      const rr = i > n - 5 ? r * (0.55 + (n - 1 - i) * 0.12) : r;
      g.drawImage(segSprite(skin.colors[Math.floor(i / 2) % skin.colors.length]), p.x - rr, p.y - rr, rr * 2, rr * 2);
    }
    const p = pts[0];
    g.drawImage(segSprite(skin.colors[0]), p.x - r * 1.15, p.y - r * 1.15, r * 2.3, r * 2.3);
    for (const sd of [-1, 1]) {
      g.fillStyle = '#fff';
      g.beginPath();
      g.arc(p.x + 3, p.y + sd * 4.5, 3.6, 0, TAU);
      g.fill();
      g.fillStyle = '#111';
      g.beginPath();
      g.arc(p.x + 4.2, p.y + sd * 4.5, 2, 0, TAU);
      g.fill();
    }
  }
  const skinsEl = document.getElementById('skins');
  SKINS.forEach((sk) => {
    const d = document.createElement('div');
    d.className = 'skin' + (sk.id === selectedSkin ? ' sel' : '');
    const cv = document.createElement('canvas');
    cv.width = 120;
    cv.height = 84;
    d.appendChild(cv);
    const lbl = document.createElement('div');
    lbl.textContent = sk.name;
    d.appendChild(lbl);
    d.addEventListener('click', () => {
      selectedSkin = sk.id;
      skinsEl.querySelectorAll('.skin').forEach((e) => e.classList.remove('sel'));
      d.classList.add('sel');
      G.Sound.init();
      G.Sound.play('eat');
    });
    skinsEl.appendChild(d);
    drawSkinPreview(cv, sk);
  });
  const best = G.store.get('snake_best', 0);
  if (best) document.getElementById('best').textContent = `🏆 历史最佳长度：${G.fmt(best)}`;

  document.getElementById('btn-start').addEventListener('click', startGame);
  document.getElementById('btn-again').addEventListener('click', startGame);
  document.getElementById('btn-skin').addEventListener('click', () => {
    document.getElementById('over').classList.add('hidden');
    document.getElementById('start').classList.remove('hidden');
  });
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') startGame();
  });

  /* ================= 主循环 ================= */
  initWorld();
  let last = performance.now();
  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05;
    update(dt);
    render();
    updateHud(dt);
    input.endFrame();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // 调试用
  window.__snake = {
    get player() { return player; },
    get snakes() { return snakes; },
    startGame,
    step(n = 60) {
      for (let i = 0; i < n; i++) { update(1 / 60); updateHud(1 / 60); input.endFrame(); }
      render();
    },
  };
})();
