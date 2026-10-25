/* 球球大乱斗 */
(() => {
  const { rand, randInt, pick, clamp, lerp, TAU } = G;

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const mm = document.getElementById('minimap');
  const mctx = mm.getContext('2d');
  let W = 0, H = 0, DPR = 1;

  function resize() {
    ({ w: W, h: H, dpr: DPR } = G.fitCanvas(canvas));
    const r = mm.getBoundingClientRect();
    mm.width = Math.round(r.width * DPR);
    mm.height = Math.round(r.height * DPR);
  }
  window.addEventListener('resize', resize);
  resize();

  const input = new G.Input(canvas);
  G.bindTopButtons();

  /* ================= 配置 ================= */
  const WORLD = 5200;
  const PELLET_TARGET = 1800;
  const VIRUS_TARGET = 20;
  const BOT_COUNT = 32;
  const POWER_TARGET = 10;
  const MAX_CELLS = 16;
  const MIN_SPLIT = 36;
  const MIN_EJECT = 35;
  const MAX_CELL_MASS = 22000;
  const VIRUS_MASS = 100;

  const radius = (m) => Math.sqrt(m) * 6 + 2;
  const speedOf = (m) => 680 * Math.pow(m, -0.3);
  const mergeDelay = (m) => Math.min(7 + m * 0.008, 24);

  const SKINS = [
    { id: 'jelly', name: '果冻', color: '#4cc9f0', p: 'none', face: true },
    { id: 'berry', name: '草莓', color: '#ff4d6d', p: 'seeds', face: true },
    { id: 'orange', name: '橙子', color: '#ff9f1c', p: 'orange', face: true },
    { id: 'melon', name: '西瓜', color: '#52b788', color2: '#1b4332', p: 'melon' },
    { id: 'earth', name: '地球', color: '#3a86ff', color2: '#57cc99', p: 'planet' },
    { id: 'basket', name: '篮球', color: '#f77f00', p: 'ball' },
    { id: 'galaxy', name: '星空', color: '#3c096c', p: 'stars' },
    { id: 'candy', name: '棒棒糖', color: '#ff70a6', color2: '#ffffff', p: 'swirl' },
    { id: 'grape', name: '葡萄', color: '#9d4edd', p: 'dots', face: true },
    { id: 'lemon', name: '柠檬', color: '#ffd60a', p: 'orange', face: true },
    { id: 'slime', name: '史莱姆', color: '#70e000', p: 'none', face: true },
    { id: 'zebra', name: '斑马', color: '#f8f9fa', color2: '#212529', p: 'stripes' },
  ];
  const PELLET_COLORS = ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93', '#ff70a6', '#ff924c', '#4cc9f0', '#c77dff', '#06d6a0', '#f15bb5', '#00bbf9'];

  const POWERS = {
    magnet: { icon: '🧲', name: '磁铁', color: '#ff4d6d', dur: 12, desc: '附近豆子自动飞来' },
    speed: { icon: '⚡', name: '疾速', color: '#ffb703', dur: 8, desc: '移动速度 +50%' },
    shield: { icon: '🛡️', name: '护盾', color: '#4cc9f0', dur: 8, desc: '无法被吞噬' },
  };
  const POWER_KEYS = Object.keys(POWERS);

  function hslHex(h, s, l) {
    s /= 100; l /= 100;
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))))).toString(16).padStart(2, '0');
    return '#' + f(0) + f(8) + f(4);
  }
  function botSkin() {
    if (Math.random() < 0.55) return pick(SKINS);
    return { id: 'plain', name: '', color: hslHex(randInt(0, 359), randInt(65, 90), randInt(52, 64)), p: 'none', face: Math.random() < 0.5 };
  }

  /* ================= 精灵 ================= */
  const cache = new Map();
  const SK = 256, SK_R = 110; // 皮肤贴图：半径 110 的圆，四周留余量给果冻形变
  function skinSprite(skin) {
    const key = 's' + skin.id + skin.color;
    let s = cache.get(key);
    if (s) return s;
    s = document.createElement('canvas');
    s.width = s.height = SK;
    const g = s.getContext('2d');
    const c = SK / 2, R = SK_R;
    const base = g.createRadialGradient(c - R * 0.35, c - R * 0.4, R * 0.05, c, c, R * 1.1);
    base.addColorStop(0, G.shade(skin.color, 0.38));
    base.addColorStop(0.55, skin.color);
    base.addColorStop(1, G.shade(skin.color, -0.18));
    g.fillStyle = base;
    g.fillRect(0, 0, SK, SK);
    const c2 = skin.color2 || '#ffffff';
    g.save();
    switch (skin.p) {
      case 'seeds':
        for (let i = 0; i < 26; i++) {
          const a = rand(0, TAU), d = Math.sqrt(Math.random()) * R * 0.92;
          g.save();
          g.translate(c + Math.cos(a) * d, c + Math.sin(a) * d);
          g.rotate(rand(0, TAU));
          g.fillStyle = '#ffe066';
          g.beginPath();
          g.ellipse(0, 0, 3, 6, 0, 0, TAU);
          g.fill();
          g.restore();
        }
        g.fillStyle = '#2d6a4f';
        for (let i = 0; i < 5; i++) {
          g.save();
          g.translate(c, c - R * 0.98);
          g.rotate((i / 5) * TAU);
          g.beginPath();
          g.ellipse(0, 12, 8, 18, 0, 0, TAU);
          g.fill();
          g.restore();
        }
        break;
      case 'orange':
        g.strokeStyle = 'rgba(255,255,255,.45)';
        g.lineWidth = 5;
        g.beginPath();
        g.arc(c, c, R * 0.78, 0, TAU);
        g.stroke();
        g.lineWidth = 3;
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * TAU;
          g.beginPath();
          g.moveTo(c + Math.cos(a) * 8, c + Math.sin(a) * 8);
          g.lineTo(c + Math.cos(a) * R * 0.76, c + Math.sin(a) * R * 0.76);
          g.stroke();
        }
        break;
      case 'melon':
        g.strokeStyle = c2;
        g.lineWidth = 12;
        for (let i = -3; i <= 3; i++) {
          g.beginPath();
          const x = c + i * 30;
          g.moveTo(x, c - R * 1.2);
          g.bezierCurveTo(x + 22, c - 40, x - 22, c + 40, x, c + R * 1.2);
          g.stroke();
        }
        break;
      case 'planet':
        g.fillStyle = c2;
        for (let i = 0; i < 5; i++) {
          const cx = c + rand(-R * 0.7, R * 0.7), cy = c + rand(-R * 0.7, R * 0.7);
          for (let k = 0; k < 7; k++) {
            g.beginPath();
            g.arc(cx + rand(-26, 26), cy + rand(-18, 18), rand(10, 26), 0, TAU);
            g.fill();
          }
        }
        g.fillStyle = 'rgba(255,255,255,.55)';
        for (let i = 0; i < 4; i++) {
          g.beginPath();
          g.ellipse(c + rand(-R * 0.6, R * 0.6), c + rand(-R * 0.7, R * 0.7), rand(20, 40), rand(5, 9), rand(-0.3, 0.3), 0, TAU);
          g.fill();
        }
        break;
      case 'ball':
        g.strokeStyle = '#3d1c02';
        g.lineWidth = 5;
        g.beginPath();
        g.moveTo(c, 0); g.lineTo(c, SK);
        g.moveTo(0, c); g.lineTo(SK, c);
        g.stroke();
        g.beginPath();
        g.arc(c - R * 1.15, c, R * 0.95, -0.9, 0.9);
        g.stroke();
        g.beginPath();
        g.arc(c + R * 1.15, c, R * 0.95, Math.PI - 0.9, Math.PI + 0.9);
        g.stroke();
        break;
      case 'stars':
        for (let i = 0; i < 70; i++) {
          g.fillStyle = `rgba(255,255,255,${rand(0.3, 1)})`;
          g.beginPath();
          g.arc(rand(0, SK), rand(0, SK), rand(0.6, 2.4), 0, TAU);
          g.fill();
        }
        const neb = g.createRadialGradient(c + 30, c + 20, 5, c + 30, c + 20, 90);
        neb.addColorStop(0, 'rgba(247,37,133,.45)');
        neb.addColorStop(1, 'rgba(247,37,133,0)');
        g.fillStyle = neb;
        g.fillRect(0, 0, SK, SK);
        break;
      case 'swirl':
        g.strokeStyle = c2;
        g.lineWidth = 14;
        g.lineCap = 'round';
        g.beginPath();
        for (let t = 0; t < 46; t += 0.1) {
          const rr = t * 2.9, a = t * 0.55;
          const x = c + Math.cos(a) * rr, y = c + Math.sin(a) * rr;
          t ? g.lineTo(x, y) : g.moveTo(x, y);
        }
        g.globalAlpha = 0.85;
        g.stroke();
        break;
      case 'dots':
        g.fillStyle = 'rgba(255,255,255,.28)';
        for (let y = -1; y < 9; y++) for (let x = -1; x < 9; x++) {
          g.beginPath();
          g.arc(x * 34 + (y % 2) * 17, y * 30, 9, 0, TAU);
          g.fill();
        }
        break;
      case 'stripes':
        g.fillStyle = c2;
        g.translate(c, c);
        g.rotate(-0.5);
        for (let i = -6; i <= 6; i++) {
          g.beginPath();
          g.moveTo(i * 36 - 8, -SK);
          g.quadraticCurveTo(i * 36 + 14, 0, i * 36 - 8, SK);
          g.lineTo(i * 36 + 8, SK);
          g.quadraticCurveTo(i * 36 + 26, 0, i * 36 + 8, -SK);
          g.fill();
        }
        break;
    }
    g.restore();
    // 高光
    const hl = g.createRadialGradient(c - R * 0.38, c - R * 0.45, 2, c - R * 0.38, c - R * 0.45, R * 0.55);
    hl.addColorStop(0, 'rgba(255,255,255,.55)');
    hl.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = hl;
    g.fillRect(0, 0, SK, SK);
    cache.set(key, s);
    return s;
  }
  function dotSprite(color) {
    const key = 'd' + color;
    let s = cache.get(key);
    if (s) return s;
    const S = 40;
    s = document.createElement('canvas');
    s.width = s.height = S;
    const g = s.getContext('2d');
    g.fillStyle = 'rgba(40,40,90,.12)';
    g.beginPath();
    g.arc(S / 2 + 1.5, S / 2 + 2.5, S / 2 - 4, 0, TAU);
    g.fill();
    const grd = g.createRadialGradient(S * 0.38, S * 0.34, 1, S / 2, S / 2, S / 2 - 3);
    grd.addColorStop(0, G.shade(color, 0.55));
    grd.addColorStop(0.5, color);
    grd.addColorStop(1, G.shade(color, -0.2));
    g.fillStyle = grd;
    g.beginPath();
    g.arc(S / 2, S / 2, S / 2 - 4, 0, TAU);
    g.fill();
    cache.set(key, s);
    return s;
  }
  const virusSprite = (() => {
    const S = 300, c = S / 2, R = 120;
    const s = document.createElement('canvas');
    s.width = s.height = S;
    const g = s.getContext('2d');
    const n = 26;
    g.beginPath();
    for (let i = 0; i <= n * 2; i++) {
      const a = (i / (n * 2)) * TAU;
      const rr = i % 2 ? R * 1.12 : R * 0.98;
      const x = c + Math.cos(a) * rr, y = c + Math.sin(a) * rr;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.closePath();
    const grd = g.createRadialGradient(c - 30, c - 34, 6, c, c, R * 1.1);
    grd.addColorStop(0, '#b8f5a8');
    grd.addColorStop(0.55, '#5fd068');
    grd.addColorStop(1, '#2fa04a');
    g.fillStyle = grd;
    g.fill();
    g.lineJoin = 'round';
    g.lineWidth = 8;
    g.strokeStyle = '#238a3c';
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,.22)';
    for (const [x, y, r] of [[-30, -20, 16], [25, 10, 22], [-10, 40, 12], [40, -40, 10], [-50, 30, 9]]) {
      g.beginPath();
      g.arc(c + x, c + y, r, 0, TAU);
      g.fill();
    }
    return s;
  })();
  function powerSprite(type) {
    const key = 'p' + type;
    let s = cache.get(key);
    if (s) return s;
    const P = POWERS[type];
    const S = 120;
    s = document.createElement('canvas');
    s.width = s.height = S;
    const g = s.getContext('2d');
    const halo = g.createRadialGradient(S / 2, S / 2, 20, S / 2, S / 2, S / 2);
    halo.addColorStop(0, G.rgba(P.color, 0.5));
    halo.addColorStop(1, G.rgba(P.color, 0));
    g.fillStyle = halo;
    g.fillRect(0, 0, S, S);
    const ig = g.createRadialGradient(S * 0.42, S * 0.38, 3, S / 2, S / 2, 32);
    ig.addColorStop(0, '#ffffff');
    ig.addColorStop(1, G.shade(P.color, 0.7));
    g.fillStyle = ig;
    g.beginPath();
    g.arc(S / 2, S / 2, 30, 0, TAU);
    g.fill();
    g.strokeStyle = P.color;
    g.lineWidth = 5;
    g.stroke();
    g.font = '32px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(P.icon, S / 2, S / 2 + 2);
    cache.set(key, s);
    return s;
  }

  /* ================= 世界状态 ================= */
  let time = 0;
  let owners = [];
  let cells = [];
  let pellets = [];
  let ejects = [];
  let viruses = [];
  let powers = [];
  let player = null;
  let playing = false;
  let nextId = 1;
  let respawnQueue = [];
  let shake = 0;
  let spectate = null;
  let event = null;
  let nextEventT = 50;
  let ejectCd = 0;
  const particles = new G.Particles(800);
  const cellGrid = new G.Grid(260);
  const pelletGrid = new G.Grid(140);
  const cam = { x: WORLD / 2, y: WORLD / 2, zoom: 0.8, userZoom: 1 };
  const stats = { peak: 0, bestRank: 99, start: 0, deathT: 0 };
  const dbg = { eats: 0, botSplits: 0, preyT: 0, fleeT: 0 };

  /* ================= 实体 ================= */
  class Cell {
    constructor(owner, x, y, mass) {
      this.owner = owner;
      this.id = nextId++;
      this.x = x;
      this.y = y;
      this.mass = mass;
      this.r = radius(mass);
      this.vx = 0;
      this.vy = 0;
      this.mergeT = 0;
      this.born = time;
      this.dir = rand(0, TAU);
      this.dead = false;
      this.jn = 0;
      this.jd = null;
      this.jv = null;
      this.blink = rand(2, 6);
    }
  }
  class Owner {
    constructor(name, skin, isBot) {
      this.id = nextId++;
      this.name = name;
      this.skin = skin;
      this.isBot = isBot;
      this.cells = [];
      this.alive = true;
      this.kills = 0;
      this.streak = 0;
      this.lastKillT = -99;
      this.power = { magnet: 0, speed: 0, shield: 0 };
      this.tx = 0;
      this.ty = 0;
      if (isBot) this.ai = { t: rand(0, 0.3), react: rand(0.12, 0.32), aggro: rand(0.35, 1), caution: rand(0.55, 1.2), alert: rand(0.5, 0.92), splitCd: 0, wander: null, mood: 0 };
    }
    get mass() {
      let m = 0;
      for (const c of this.cells) m += c.mass;
      return m;
    }
    center() {
      let m = 0, x = 0, y = 0;
      for (const c of this.cells) {
        m += c.mass;
        x += c.x * c.mass;
        y += c.y * c.mass;
      }
      return m ? { x: x / m, y: y / m } : { x: this.tx, y: this.ty };
    }
  }

  function addPellet(x, y, o = {}) {
    const r = Math.random();
    const m = o.m || (r < 0.7 ? 1 : r < 0.96 ? 2 : 5);
    pellets.push({ x, y, m, r: 5 + m * 1.6, color: o.color || pick(PELLET_COLORS), born: time, ph: rand(0, TAU), dead: false, vx: 0, vy: 0 });
  }
  function spawnVirus(x, y) {
    viruses.push({ x: x ?? rand(200, WORLD - 200), y: y ?? rand(200, WORLD - 200), mass: VIRUS_MASS, fed: 0, vx: 0, vy: 0, rot: rand(0, TAU), wob: 0, dead: false });
  }
  function spawnPower() {
    powers.push({ x: rand(200, WORLD - 200), y: rand(200, WORLD - 200), type: pick(POWER_KEYS), ph: rand(0, TAU), dead: false });
  }

  function safeSpot(mass) {
    let best = null, bestS = -Infinity;
    for (let t = 0; t < 30; t++) {
      const x = rand(300, WORLD - 300), y = rand(300, WORLD - 300);
      let sc = Infinity;
      for (const c of cells) {
        if (c.mass < mass * 1.2) continue;
        const d = Math.hypot(c.x - x, c.y - y) - c.r;
        if (d < sc) sc = d;
      }
      if (sc > bestS) {
        bestS = sc;
        best = { x, y };
      }
      if (sc > 900) break;
    }
    return best;
  }

  function spawnOwner(name, skin, isBot, mass) {
    const o = new Owner(name, skin, isBot);
    const p = safeSpot(mass);
    const c = new Cell(o, p.x, p.y, mass);
    o.cells.push(c);
    o.tx = p.x;
    o.ty = p.y;
    o.power.shield = 2.5;
    owners.push(o);
    cells.push(c);
    return o;
  }
  function spawnBot(initial) {
    const r = Math.random();
    let mass;
    if (initial) mass = r < 0.5 ? rand(15, 60) : r < 0.85 ? rand(80, 400) : rand(500, 1800);
    else mass = r < 0.85 ? rand(15, 50) : rand(100, 450);
    const o = spawnOwner(G.botName(), botSkin(), true, mass);
    // 初始较大的机器人随机分成几块，场面更热闹
    if (mass > 300 && Math.random() < 0.4) {
      const c = o.cells[0];
      const n = randInt(2, 4);
      c.mass = mass / n;
      for (let i = 1; i < n; i++) {
        const nc = new Cell(o, c.x + rand(-80, 80), c.y + rand(-80, 80), mass / n);
        nc.mergeT = time + rand(3, 10);
        o.cells.push(nc);
        cells.push(nc);
      }
    }
    return o;
  }

  /* ================= 动作 ================= */
  function split(o) {
    const list = o.cells.slice().sort((a, b) => b.mass - a.mass);
    let did = false;
    for (const c of list) {
      if (o.cells.length >= MAX_CELLS) break;
      if (c.mass < MIN_SPLIT) continue;
      const half = c.mass / 2;
      c.mass = half;
      c.r = radius(half);
      let a = Math.atan2(o.ty - c.y, o.tx - c.x);
      if (!isFinite(a)) a = c.dir;
      const nc = new Cell(o, c.x + Math.cos(a) * c.r * 0.5, c.y + Math.sin(a) * c.r * 0.5, half);
      const v = 5 * (nc.r * 3 + 130);
      nc.vx = Math.cos(a) * v;
      nc.vy = Math.sin(a) * v;
      nc.dir = a;
      const mt = time + mergeDelay(half * 2);
      c.mergeT = Math.max(c.mergeT, mt);
      nc.mergeT = mt;
      o.cells.push(nc);
      cells.push(nc);
      did = true;
      if (o === player) particles.burst(nc.x, nc.y, o.skin.color, 6, { speed: 200, size: 5, life: 0.4, angle: a + Math.PI, spread: 1.4 });
    }
    if (did && o === player) G.Sound.play('split');
    return did;
  }
  function eject(o) {
    let did = false;
    for (const c of o.cells) {
      if (c.mass < MIN_EJECT) continue;
      c.mass -= 14;
      c.r = radius(c.mass);
      let a = Math.atan2(o.ty - c.y, o.tx - c.x);
      if (!isFinite(a)) a = c.dir;
      a += rand(-0.08, 0.08);
      ejects.push({ x: c.x + Math.cos(a) * c.r, y: c.y + Math.sin(a) * c.r, vx: Math.cos(a) * 1050, vy: Math.sin(a) * 1050, mass: 12, color: o.skin.color, src: c, t: 0, dead: false });
      did = true;
    }
    if (did && o === player) G.Sound.play('eject');
  }

  function popOnVirus(c) {
    const o = c.owner;
    c.mass += VIRUS_MASS * 0.6;
    const room = MAX_CELLS - o.cells.length;
    if (room <= 0) return;
    const n = Math.min(room, Math.max(3, Math.floor(c.mass / 40)), 10);
    const pieceMass = (c.mass * 0.55) / n;
    c.mass -= pieceMass * n;
    c.r = radius(c.mass);
    const mt = time + mergeDelay(c.mass + pieceMass * n);
    c.mergeT = mt;
    const a0 = rand(0, TAU);
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * TAU;
      const nc = new Cell(o, c.x + Math.cos(a) * c.r * 0.4, c.y + Math.sin(a) * c.r * 0.4, pieceMass);
      const v = 5 * (nc.r * 2.6 + 90);
      nc.vx = Math.cos(a) * v;
      nc.vy = Math.sin(a) * v;
      nc.mergeT = mt;
      o.cells.push(nc);
      cells.push(nc);
    }
    particles.ring(c.x, c.y, '#5fd068', c.r * 2.2, 0.6, 10);
    particles.burst(c.x, c.y, '#5fd068', 24, { speed: 380, size: 7, life: 0.8 });
    if (o === player) {
      G.Sound.play('virus');
      shake = 14;
      G.announce('💥 爆炸！', '撞上病毒被炸成碎片', '#5fd068');
    }
  }

  function onEatCell(eater, victim) {
    dbg.eats++;
    const eo = eater.owner, vo = victim.owner;
    particles.burst(victim.x, victim.y, vo.skin.color, Math.min(30, 8 + victim.r * 0.2), { speed: 160 + victim.r * 2, size: Math.max(4, victim.r * 0.12), life: 0.7 });
    if (eo === player) {
      particles.text(eater.x, eater.y - eater.r * 0.4, '+' + Math.floor(victim.mass), '#ffd166', 22);
      G.Sound.play('big');
    }
    if (vo === player) G.Sound.play('eaten');
    // 果冻抖动
    if (eater.jv) for (let i = 0; i < eater.jn; i++) eater.jv[i] += rand(-1, 1) * eater.r * 0.9;
    if (vo.cells.every((c) => c.dead)) killOwner(vo, eo, victim.mass);
  }

  function killOwner(o, killer, lastMass = 0) {
    if (!o.alive) return;
    o.alive = false;
    if (killer && killer.alive) {
      killer.kills++;
      killer.streak = time - killer.lastKillT < 10 ? killer.streak + 1 : 1;
      killer.lastKillT = time;
    }
    const rk = ranking();
    const important = o === player || killer === player || lastMass > 300 || (killer && rk.indexOf(killer) < 3);
    if (important && killer) G.feed(`<b>${G.esc(killer.name)}</b> <span class="k">🍴</span> ${G.esc(o.name)}`);
    if (killer === player) {
      G.Sound.play('kill');
      G.announce(G.streakName(player.streak) || '吞噬！', `你吃掉了 ${G.esc(o.name)}`, player.streak >= 3 ? '#ff4d6d' : '#ffb703');
    }
    if (o === player) onPlayerDeath(killer);
    else {
      G.releaseName(o.name);
      respawnQueue.push(rand(1.5, 4.5));
    }
  }

  function ranking() {
    return owners.filter((o) => o.alive).map((o) => ({ o, m: o.mass })).sort((a, b) => b.m - a.m).map((x) => x.o);
  }

  /* ================= AI ================= */
  function botThink(o) {
    const ai = o.ai;
    const cs = o.cells;
    if (!cs.length) return;
    let main = cs[0], small = cs[0];
    for (const c of cs) {
      if (c.mass > main.mass) main = c;
      if (c.mass < small.mass) small = c;
    }
    const ctr = o.center();
    const view = 700 + main.r * 3;
    let fx = 0, fy = 0, threat = 0, prey = null, preyScore = 0;
    // 偶尔走神：这一轮没注意到危险
    const shielded = o.power.shield > 0 || Math.random() > ai.alert;

    cellGrid.query(ctr.x, ctr.y, view, (e) => {
      if (e.owner === o || e.dead) return;
      const dx = e.x - ctr.x, dy = e.y - ctr.y;
      const d = Math.hypot(dx, dy) || 1;
      const gap = d - e.r - main.r;
      if (!shielded && e.mass > small.mass * 1.25) {
        const victim = e.mass > main.mass * 1.25 ? main.mass : small.mass;
        const splitKill = e.mass * 0.5 > victim * 1.25 && e.owner.cells.length < MAX_CELLS;
        const range = splitKill ? e.r * 2.6 + 380 : e.r * 0.5 + 260;
        if (gap < range) {
          const w = (1 - Math.max(0, gap) / range) * (e.mass > main.mass * 1.25 ? 3 : 0.8) * ai.caution;
          fx -= (dx / d) * w;
          fy -= (dy / d) * w;
          threat = Math.max(threat, w);
        }
      } else if (main.mass > e.mass * 1.25 && e.owner.power.shield <= 0 && (e.mass > main.mass * 0.06 || gap < 120)) {
        const sc = (e.mass / (Math.max(10, gap) + 160)) * ai.aggro;
        if (sc > preyScore) {
          preyScore = sc;
          prey = e;
        }
      }
    });
    // 病毒 & 边界
    if (main.mass > VIRUS_MASS * 1.33 && !shielded) {
      for (const v of viruses) {
        const dx = v.x - ctr.x, dy = v.y - ctr.y;
        const d = Math.hypot(dx, dy) || 1;
        const range = main.r + 140;
        if (d < range) {
          const w = (1 - d / range) * 2;
          fx -= (dx / d) * w;
          fy -= (dy / d) * w;
        }
      }
    }
    const edge = 260 + main.r;
    if (ctr.x < edge) fx += (edge - ctr.x) / edge;
    if (ctr.x > WORLD - edge) fx -= (ctr.x - WORLD + edge) / edge;
    if (ctr.y < edge) fy += (edge - ctr.y) / edge;
    if (ctr.y > WORLD - edge) fy -= (ctr.y - WORLD + edge) / edge;

    ai.mood = 0;
    const fl = Math.hypot(fx, fy);
    if (fl > 0.18) {
      o.tx = ctr.x + (fx / fl) * 700;
      o.ty = ctr.y + (fy / fl) * 700;
      ai.mood = threat > 0.4 ? -1 : 0;
      dbg.fleeT++;
    } else if (prey) {
      dbg.preyT++;
      o.tx = prey.x;
      o.ty = prey.y;
      ai.mood = 1;
      const d = Math.hypot(prey.x - main.x, prey.y - main.y);
      if (ai.splitCd <= 0 && cs.length <= 3 && main.mass * 0.5 > prey.mass * 1.3 && d < main.r * 3.2 + 220 && d > main.r * 0.6 && Math.random() < ai.aggro) {
        o.tx = prey.x;
        o.ty = prey.y;
        split(o);
        dbg.botSplits++;
        ai.splitCd = rand(2.5, 5);
      }
    } else {
      // 找豆子 / 事件 / 闲逛
      let best = 0, bx = 0, by = 0;
      for (const p of powers) {
        const d = Math.hypot(p.x - ctr.x, p.y - ctr.y);
        if (d < 600 && 6 / (d + 60) > best) { best = 6 / (d + 60); bx = p.x; by = p.y; }
      }
      pelletGrid.query(main.x, main.y, 380, (p) => {
        if (p.dead) return;
        const d = Math.hypot(p.x - main.x, p.y - main.y);
        const sc = p.m / (d + 50);
        if (sc > best) { best = sc; bx = p.x; by = p.y; }
      });
      if (event && Math.hypot(event.x - ctr.x, event.y - ctr.y) < 2600 && ai.aggro > 0.4 && best < 0.05) {
        bx = event.x; by = event.y; best = 1;
      }
      if (best > 0) {
        o.tx = bx;
        o.ty = by;
      } else {
        if (!ai.wander || Math.hypot(ai.wander.x - ctr.x, ai.wander.y - ctr.y) < 100) ai.wander = { x: rand(400, WORLD - 400), y: rand(400, WORLD - 400) };
        o.tx = ai.wander.x;
        o.ty = ai.wander.y;
      }
    }
    o.tx = clamp(o.tx, 0, WORLD);
    o.ty = clamp(o.ty, 0, WORLD);
  }

  /* ================= 流程 ================= */
  function initWorld() {
    owners = [];
    cells = [];
    pellets = [];
    for (let i = 0; i < PELLET_TARGET; i++) addPellet(rand(20, WORLD - 20), rand(20, WORLD - 20));
    for (let i = 0; i < VIRUS_TARGET; i++) spawnVirus();
    for (let i = 0; i < POWER_TARGET; i++) spawnPower();
    for (let i = 0; i < BOT_COUNT; i++) spawnBot(true);
  }

  let selectedSkin = G.store.get('ball_skin', 'jelly');
  const nameInput = document.getElementById('name');
  nameInput.value = G.store.get('name', '');

  function startGame() {
    const name = (nameInput.value.trim() || '无名小球').slice(0, 10);
    G.store.set('name', name);
    G.store.set('ball_skin', selectedSkin);
    const skin = SKINS.find((s) => s.id === selectedSkin) || SKINS[0];
    player = spawnOwner(name, skin, false, 20);
    player.power.shield = 3;
    playing = true;
    stats.peak = 20;
    stats.bestRank = 99;
    stats.start = time;
    const c = player.cells[0];
    cam.x = c.x;
    cam.y = c.y;
    document.getElementById('start').classList.add('hidden');
    document.getElementById('over').classList.add('hidden');
    document.body.classList.remove('menu');
    G.Sound.init();
    G.Sound.play('start');
    G.announce('开始！', '吃掉比你小的球，躲开比你大的球', '#ff5fa2');
  }

  function onPlayerDeath(killer) {
    playing = false;
    stats.deathT = time;
    G.Sound.play('death');
    shake = 16;
    const best = G.store.get('ball_best', 0);
    const peak = Math.floor(stats.peak);
    const isBest = peak > best;
    if (isBest) G.store.set('ball_best', peak);
    setTimeout(() => {
      document.getElementById('ov-killer').innerHTML = killer ? `你被 <b>${G.esc(killer.name)}</b> 吃掉了` : '你被吃掉了';
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
    const x = rand(900, WORLD - 900), y = rand(900, WORLD - 900);
    event = { x, y, t: 0, left: 180, spawnT: 0 };
    const col = x < WORLD / 3 ? '西' : x > (WORLD * 2) / 3 ? '东' : '';
    const row = y < WORLD / 3 ? '北' : y > (WORLD * 2) / 3 ? '南' : '';
    const where = col || row ? col + row + '部' : '中央';
    G.banner(`🍬 糖果雨降临在地图${where}！小地图上闪烁处有大量糖果`);
    G.Sound.play('event');
  }

  /* ================= 更新 ================= */
  function update(dt) {
    time += dt;

    // 玩家操控
    if (player && player.alive) {
      const ctr = player.center();
      if (input.isTouch) {
        if (input.joy.active) {
          const reach = 260 / cam.zoom;
          player.tx = ctr.x + input.joy.x * input.joy.mag * reach;
          player.ty = ctr.y + input.joy.y * input.joy.mag * reach;
        } else {
          player.tx = ctr.x;
          player.ty = ctr.y;
        }
      } else {
        player.tx = cam.x + (input.mx - W / 2) / cam.zoom;
        player.ty = cam.y + (input.my - H / 2) / cam.zoom;
      }
      if (input.tapped(' ', 'split')) split(player);
      ejectCd -= dt;
      if ((input.keys['w'] || input.held.eject) && ejectCd <= 0) {
        eject(player);
        ejectCd = 0.09;
      }
    }
    if (input.wheel) cam.userZoom = clamp(cam.userZoom * (input.wheel > 0 ? 0.9 : 1.1), 0.5, 2);
    if (input.tapped('enter') && !playing && document.querySelector('.overlay:not(.hidden)')) startGame();

    // AI
    for (const o of owners) {
      if (!o.alive || !o.isBot) continue;
      o.ai.t -= dt;
      o.ai.splitCd -= dt;
      if (o.ai.t <= 0) {
        o.ai.t = o.ai.react;
        botThink(o);
      }
    }

    // 移动
    for (const o of owners) {
      if (!o.alive) continue;
      for (const k in o.power) if (o.power[k] > 0) o.power[k] = Math.max(0, o.power[k] - dt);
      const boost = o.power.speed > 0 ? 1.5 : 1;
      for (const c of o.cells) {
        const dx = o.tx - c.x, dy = o.ty - c.y;
        const d = Math.hypot(dx, dy);
        const sp = speedOf(c.mass) * boost;
        if (d > 1) {
          const f = Math.min(1, d / (c.r * 0.6 + 40));
          c.x += (dx / d) * sp * f * dt;
          c.y += (dy / d) * sp * f * dt;
          if (f > 0.15) c.dir = Math.atan2(dy, dx);
        }
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        const k = Math.exp(-5 * dt);
        c.vx *= k;
        c.vy *= k;
        if (c.mass > 120) c.mass -= c.mass * 0.0022 * dt;
        c.r = radius(c.mass);
        const lim = Math.min(c.r * 0.7, WORLD / 2);
        c.x = clamp(c.x, lim, WORLD - lim);
        c.y = clamp(c.y, lim, WORLD - lim);
      }
      // 自身细胞：推开 / 合并
      const cs = o.cells;
      if (cs.length > 1) {
        for (let i = 0; i < cs.length; i++) {
          const a = cs[i];
          if (a.dead) continue;
          for (let j = i + 1; j < cs.length; j++) {
            const b = cs[j];
            if (b.dead) continue;
            const dx = b.x - a.x, dy = b.y - a.y;
            const d = Math.hypot(dx, dy) || 0.01;
            const rs = a.r + b.r;
            if (d >= rs) continue;
            const canMerge = time > a.mergeT && time > b.mergeT;
            if (canMerge) {
              if (d < Math.max(a.r, b.r) * 0.9) {
                const [big, sm] = a.mass >= b.mass ? [a, b] : [b, a];
                big.mass = Math.min(MAX_CELL_MASS, big.mass + sm.mass);
                big.r = radius(big.mass);
                sm.dead = true;
                if (big.jv) for (let q = 0; q < big.jn; q++) big.jv[q] += rand(-1, 1) * big.r * 0.5;
              } else {
                // 互相吸引
                const pull = Math.min(d, 120 * dt);
                a.x += (dx / d) * pull * 0.5;
                a.y += (dy / d) * pull * 0.5;
                b.x -= (dx / d) * pull * 0.5;
                b.y -= (dy / d) * pull * 0.5;
              }
            } else if (time - Math.max(a.born, b.born) > 0.25) {
              const ov = (rs - d) * Math.min(1, dt * 10);
              const tm = a.mass + b.mass;
              a.x -= (dx / d) * ov * (b.mass / tm);
              a.y -= (dy / d) * ov * (b.mass / tm);
              b.x += (dx / d) * ov * (a.mass / tm);
              b.y += (dy / d) * ov * (a.mass / tm);
            }
          }
        }
        o.cells = cs.filter((c) => !c.dead);
      }
    }

    // 网格
    cells = cells.filter((c) => !c.dead);
    cellGrid.clear();
    for (const c of cells) cellGrid.insert(c, c.x, c.y);
    pelletGrid.clear();
    for (const p of pellets) if (!p.dead) pelletGrid.insert(p, p.x, p.y);

    // 吃
    const sorted = cells.slice().sort((a, b) => b.mass - a.mass);
    for (const A of sorted) {
      if (A.dead) continue;
      const ao = A.owner;
      // 吃球
      cellGrid.query(A.x, A.y, A.r, (B) => {
        if (B.dead || B === A || B.owner === ao) return;
        if (A.mass < B.mass * 1.25 || B.owner.power.shield > 0) return;
        const d = Math.hypot(B.x - A.x, B.y - A.y);
        if (d < A.r - B.r * 0.4) {
          B.dead = true;
          A.mass = Math.min(MAX_CELL_MASS, A.mass + B.mass);
          A.r = radius(A.mass);
          onEatCell(A, B);
        }
      });
      // 吃豆
      const mag = ao.power.magnet > 0;
      const reach = A.r + (mag ? 280 : 0);
      let ate = 0;
      pelletGrid.query(A.x, A.y, reach, (p) => {
        if (p.dead) return;
        const dx = A.x - p.x, dy = A.y - p.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < A.r) {
          p.dead = true;
          A.mass += p.m;
          ate++;
          if (A.jd && A.r < 300) {
            const idx = Math.round((((Math.atan2(-dy, -dx) + TAU) % TAU) / TAU) * A.jn) % A.jn;
            A.jv[idx] -= A.r * 0.25;
          }
        } else if (mag && d < reach) {
          const m = Math.min(d, (500 + 600 * (1 - d / reach)) * dt);
          p.x += (dx / d) * m;
          p.y += (dy / d) * m;
        }
      });
      if (ate && ao === player) G.Sound.play('eat');
      // 吃吐出的球
      for (const e of ejects) {
        if (e.dead || A.mass < 20 || (e.src === A && e.t < 0.3)) continue;
        if ((e.x - A.x) ** 2 + (e.y - A.y) ** 2 < (A.r - 4) ** 2) {
          e.dead = true;
          A.mass += e.mass;
        }
      }
      // 病毒
      if (A.mass > VIRUS_MASS * 1.33 && ao.power.shield <= 0) {
        for (const v of viruses) {
          if (v.dead) continue;
          const vr = radius(v.mass);
          if (Math.hypot(v.x - A.x, v.y - A.y) < A.r - vr * 0.3) {
            v.dead = true;
            popOnVirus(A);
            break;
          }
        }
      }
      // 道具
      for (const p of powers) {
        if (p.dead) continue;
        if (Math.hypot(p.x - A.x, p.y - A.y) < A.r + 22) {
          p.dead = true;
          const P = POWERS[p.type];
          ao.power[p.type] = P.dur;
          particles.ring(p.x, p.y, P.color, 80, 0.6, 6);
          particles.burst(p.x, p.y, P.color, 16, { speed: 240, size: 5, life: 0.7 });
          if (ao === player) {
            G.Sound.play('power');
            G.announce(P.icon + ' ' + P.name, P.desc, P.color);
          }
        }
      }
    }
    for (const o of owners) if (o.alive) o.cells = o.cells.filter((c) => !c.dead);
    cells = cells.filter((c) => !c.dead);

    // 吐出的球
    for (const e of ejects) {
      if (e.dead) continue;
      e.t += dt;
      const k = Math.exp(-3.2 * dt);
      e.vx *= k;
      e.vy *= k;
      e.x = clamp(e.x + e.vx * dt, 10, WORLD - 10);
      e.y = clamp(e.y + e.vy * dt, 10, WORLD - 10);
      for (const v of viruses) {
        if (v.dead) continue;
        if (Math.hypot(v.x - e.x, v.y - e.y) < radius(v.mass)) {
          e.dead = true;
          v.fed++;
          v.mass += 10;
          v.wob = 1;
          if (v.fed >= 7) {
            const sp = Math.hypot(e.vx, e.vy) || 1;
            const nv = { x: v.x, y: v.y, mass: VIRUS_MASS, fed: 0, vx: (e.vx / sp) * 1300, vy: (e.vy / sp) * 1300, rot: 0, wob: 1, dead: false };
            viruses.push(nv);
            v.fed = 0;
            v.mass = VIRUS_MASS;
          }
          break;
        }
      }
      if (e.t > 40) e.dead = true;
    }
    ejects = ejects.filter((e) => !e.dead);

    // 病毒
    for (const v of viruses) {
      if (v.vx || v.vy) {
        const k = Math.exp(-3 * dt);
        v.vx *= k;
        v.vy *= k;
        v.x = clamp(v.x + v.vx * dt, 80, WORLD - 80);
        v.y = clamp(v.y + v.vy * dt, 80, WORLD - 80);
        if (Math.abs(v.vx) + Math.abs(v.vy) < 2) v.vx = v.vy = 0;
      }
      v.rot += dt * 0.15;
      v.wob *= Math.exp(-4 * dt);
    }
    viruses = viruses.filter((v) => !v.dead);
    if (viruses.length < VIRUS_TARGET && Math.random() < dt * 0.3) spawnVirus();
    if (viruses.length > VIRUS_TARGET + 10) viruses.shift();

    // 豆子
    pellets = pellets.filter((p) => !p.dead);
    for (let i = 0; i < 30 && pellets.length < PELLET_TARGET; i++) addPellet(rand(20, WORLD - 20), rand(20, WORLD - 20));
    powers = powers.filter((p) => !p.dead);
    if (powers.length < POWER_TARGET && Math.random() < dt * 0.4) spawnPower();

    // 糖果雨
    nextEventT -= dt;
    if (nextEventT <= 0 && !event) {
      startEvent();
      nextEventT = rand(75, 105);
    }
    if (event) {
      event.t += dt;
      event.spawnT -= dt;
      while (event.left > 0 && event.spawnT <= 0) {
        event.spawnT += 0.025;
        event.left--;
        const a = rand(0, TAU), d = Math.sqrt(Math.random()) * 420;
        addPellet(event.x + Math.cos(a) * d, event.y + Math.sin(a) * d, { m: 4, color: pick(['#ff70a6', '#ffd60a', '#4cc9f0', '#c77dff', '#ff9f1c']) });
      }
      if (event.t > 28) event = null;
    }

    particles.update(dt);

    // 死亡清理 & 补充
    owners = owners.filter((o) => o.alive || o === player);
    for (let i = respawnQueue.length - 1; i >= 0; i--) {
      respawnQueue[i] -= dt;
      if (respawnQueue[i] <= 0) {
        respawnQueue.splice(i, 1);
        spawnBot(false);
      }
    }
    if (player && player.alive) stats.peak = Math.max(stats.peak, player.mass);

    // 相机
    let tx, ty, tz;
    const screenK = clamp(Math.sqrt(W * H) / 1050, 0.6, 1.3);
    const fitZoom = (o) => {
      const ctr = o.center();
      let spread = 0, m = 0;
      for (const c of o.cells) {
        spread = Math.max(spread, Math.hypot(c.x - ctr.x, c.y - ctr.y) + c.r);
        m += c.mass;
      }
      const eqR = radius(m);
      let z = Math.pow(32 / eqR, 0.42) * 1.05;
      z = Math.min(z, (Math.min(W, H) * 0.42) / (spread + 60) / screenK);
      return { ctr, z: clamp(z, 0.08, 1.2) };
    };
    if (player && player.alive) {
      const f = fitZoom(player);
      tx = f.ctr.x;
      ty = f.ctr.y;
      tz = f.z;
    } else if (player && time - stats.deathT < 6) {
      tx = cam.x;
      ty = cam.y;
      tz = cam.zoom / screenK / cam.userZoom;
    } else {
      if (!spectate || !spectate.alive) spectate = ranking()[randInt(0, 3)] || owners[0];
      const f = spectate ? fitZoom(spectate) : { ctr: { x: WORLD / 2, y: WORLD / 2 }, z: 0.5 };
      tx = f.ctr.x;
      ty = f.ctr.y;
      tz = f.z * 0.8;
    }
    cam.zoom = lerp(cam.zoom, tz * screenK * cam.userZoom, 1 - Math.exp(-2.5 * dt));
    const ck = 1 - Math.exp(-8 * dt);
    cam.x = lerp(cam.x, tx, ck);
    cam.y = lerp(cam.y, ty, ck);
    shake *= Math.exp(-6 * dt);
  }

  /* ================= 果冻形变 ================= */
  function jelly(c, dt) {
    const n = c.r < 45 ? 22 : c.r < 110 ? 32 : c.r < 260 ? 44 : 60;
    if (c.jn !== n) {
      c.jn = n;
      c.jd = new Float32Array(n);
      c.jv = new Float32Array(n);
    }
    const d = c.jd, v = c.jv;
    const lim = c.r * 0.14;
    for (let i = 0; i < n; i++) {
      const nb = (d[(i + n - 1) % n] + d[(i + 1) % n]) * 0.5;
      v[i] += (-d[i] * 70 + (nb - d[i]) * 45 - v[i] * 7) * dt;
    }
    for (let i = 0; i < n; i++) {
      d[i] = clamp(d[i] + v[i] * dt, -lim, lim);
    }
    if (Math.random() < 0.15) v[randInt(0, n - 1)] += rand(-1, 1) * c.r * 0.35;
  }

  function cellPath(c) {
    const n = c.jn, d = c.jd;
    const o = c.owner;
    const xs = new Array(n), ys = new Array(n);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const ca = Math.cos(a), sa = Math.sin(a);
      let rr = c.r + d[i];
      // 墙壁挤压
      if (ca < -0.01) rr = Math.min(rr, c.x / -ca);
      else if (ca > 0.01) rr = Math.min(rr, (WORLD - c.x) / ca);
      if (sa < -0.01) rr = Math.min(rr, c.y / -sa);
      else if (sa > 0.01) rr = Math.min(rr, (WORLD - c.y) / sa);
      // 与自己其他细胞贴合
      if (o.cells.length > 1) {
        for (const b of o.cells) {
          if (b === c) continue;
          const dx = b.x - c.x, dy = b.y - c.y;
          const dd = Math.hypot(dx, dy);
          if (dd >= c.r + b.r || dd < 1) continue;
          const cosT = (ca * dx + sa * dy) / dd;
          if (cosT <= 0.05) continue;
          const t = (dd * dd + c.r * c.r - b.r * b.r) / (2 * dd);
          if (t > 0) rr = Math.min(rr, t / cosT);
        }
      }
      rr = Math.max(rr, c.r * 0.25);
      xs[i] = c.x + ca * rr;
      ys[i] = c.y + sa * rr;
    }
    ctx.beginPath();
    ctx.moveTo((xs[n - 1] + xs[0]) / 2, (ys[n - 1] + ys[0]) / 2);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      ctx.quadraticCurveTo(xs[i], ys[i], (xs[i] + xs[j]) / 2, (ys[i] + ys[j]) / 2);
    }
    ctx.closePath();
  }

  /* ================= 渲染 ================= */
  function render(dt) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = '#dfe3ee';
    ctx.fillRect(0, 0, W, H);
    const z = cam.zoom;
    const sx = shake > 0.3 ? rand(-shake, shake) : 0, sy = shake > 0.3 ? rand(-shake, shake) : 0;
    ctx.setTransform(DPR * z, 0, 0, DPR * z, DPR * (W / 2 - cam.x * z + sx), DPR * (H / 2 - cam.y * z + sy));
    const vw = W / z, vh = H / z;
    const x0 = cam.x - vw / 2, y0 = cam.y - vh / 2, x1 = x0 + vw, y1 = y0 + vh;

    // 场地
    const gx0 = Math.max(0, x0), gy0 = Math.max(0, y0), gx1 = Math.min(WORLD, x1), gy1 = Math.min(WORLD, y1);
    ctx.fillStyle = '#f7f8fd';
    ctx.fillRect(gx0, gy0, gx1 - gx0, gy1 - gy0);
    let step = 50;
    while (step * z < 16) step *= 2;
    ctx.strokeStyle = 'rgba(60,70,130,.09)';
    ctx.lineWidth = 1.2 / z;
    ctx.beginPath();
    for (let x = Math.ceil(gx0 / step) * step; x <= gx1; x += step) {
      ctx.moveTo(x, gy0);
      ctx.lineTo(x, gy1);
    }
    for (let y = Math.ceil(gy0 / step) * step; y <= gy1; y += step) {
      ctx.moveTo(gx0, y);
      ctx.lineTo(gx1, y);
    }
    ctx.stroke();
    ctx.strokeStyle = '#b9c0d8';
    ctx.lineWidth = 8;
    ctx.strokeRect(-4, -4, WORLD + 8, WORLD + 8);

    if (event) {
      ctx.save();
      const k = Math.min(1, event.t / 1.5) * (event.t > 24 ? (28 - event.t) / 4 : 1);
      ctx.strokeStyle = `rgba(255,112,166,${0.5 * k})`;
      ctx.lineWidth = 6;
      ctx.setLineDash([30, 20]);
      ctx.lineDashOffset = -time * 60;
      ctx.beginPath();
      ctx.arc(event.x, event.y, 470, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }

    // 豆子
    const m = 30;
    for (const p of pellets) {
      if (p.x < x0 - m || p.x > x1 + m || p.y < y0 - m || p.y > y1 + m) continue;
      const pop = Math.min(1, (time - p.born) * 4);
      const s = p.r * (1 + 0.12 * Math.sin(time * 3 + p.ph)) * pop * 1.25;
      if (s * z < 0.6) continue;
      ctx.drawImage(dotSprite(p.color), p.x - s, p.y - s, s * 2, s * 2);
    }
    // 吐出的球
    for (const e of ejects) {
      if (e.x < x0 - m || e.x > x1 + m || e.y < y0 - m || e.y > y1 + m) continue;
      const s = 17 * 1.25;
      ctx.drawImage(dotSprite(e.color), e.x - s, e.y - s, s * 2, s * 2);
    }
    // 道具
    for (const p of powers) {
      if (p.x < x0 - 80 || p.x > x1 + 80 || p.y < y0 - 80 || p.y > y1 + 80) continue;
      const bob = Math.sin(time * 2.5 + p.ph) * 6;
      const s = 38 + Math.sin(time * 4 + p.ph) * 2;
      ctx.drawImage(powerSprite(p.type), p.x - s, p.y - s + bob, s * 2, s * 2);
    }

    // 球 & 病毒（按大小排序）
    const items = [];
    for (const c of cells) {
      const mr = c.r * 1.2;
      if (c.x + mr < x0 || c.x - mr > x1 || c.y + mr < y0 || c.y - mr > y1) continue;
      items.push(c);
    }
    for (const v of viruses) {
      const r = radius(v.mass) * 1.2;
      if (v.x + r < x0 || v.x - r > x1 || v.y + r < y0 || v.y - r > y1) continue;
      v.r = radius(v.mass);
      items.push(v);
    }
    items.sort((a, b) => a.r - b.r);
    for (const it of items) {
      if (it instanceof Cell) drawCell(it, z, dt);
      else drawVirus(it);
    }
    particles.draw(ctx, z, false);
    // 名字放最上层
    for (const it of items) if (it instanceof Cell) drawLabel(it, z);
  }

  function drawVirus(v) {
    const r = v.r * (1 + v.wob * 0.08 * Math.sin(time * 30));
    const s = r * (150 / 120);
    ctx.save();
    ctx.translate(v.x, v.y);
    ctx.rotate(v.rot);
    ctx.drawImage(virusSprite, -s, -s, s * 2, s * 2);
    ctx.restore();
    if (v.fed) {
      ctx.strokeStyle = 'rgba(255,255,255,.75)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(v.x, v.y, r * 0.4, -Math.PI / 2, -Math.PI / 2 + (v.fed / 7) * TAU);
      ctx.stroke();
    }
  }

  function drawCell(c, z, dt) {
    jelly(c, dt);
    const o = c.owner;
    const skin = o.skin;
    // 阴影
    ctx.fillStyle = 'rgba(40,40,90,.10)';
    ctx.beginPath();
    ctx.arc(c.x + c.r * 0.05, c.y + c.r * 0.08, c.r, 0, TAU);
    ctx.fill();
    cellPath(c);
    ctx.save();
    ctx.clip();
    const s = c.r * (SK / 2 / SK_R);
    ctx.drawImage(skinSprite(skin), c.x - s, c.y - s, s * 2, s * 2);
    ctx.restore();
    ctx.lineWidth = Math.max(2.5 / z, c.r * 0.055);
    ctx.strokeStyle = G.shade(skin.color, -0.28);
    ctx.stroke();

    const px = c.r * z;
    if (skin.face && px > 12) drawFace(c, px);
    // 护盾
    if (o.power.shield > 0) {
      const k = o.power.shield < 1.5 ? 0.5 + 0.5 * Math.sin(time * 20) : 1;
      ctx.save();
      ctx.strokeStyle = `rgba(76,201,240,${0.85 * k})`;
      ctx.lineWidth = Math.max(3 / z, c.r * 0.06);
      ctx.setLineDash([c.r * 0.25, c.r * 0.15]);
      ctx.lineDashOffset = -time * c.r * 0.6;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r * 1.12 + 4, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
    if (o.power.speed > 0 && Math.random() < 0.4) {
      particles.burst(c.x - Math.cos(c.dir) * c.r, c.y - Math.sin(c.dir) * c.r, '#ffb703', 1, { speed: 80, size: Math.max(3, c.r * 0.08), life: 0.4, angle: c.dir + Math.PI, spread: 1 });
    }
  }

  function drawFace(c, px) {
    const r = c.r;
    const o = c.owner;
    c.blink -= 1 / 60;
    if (c.blink < -0.12) c.blink = rand(2.5, 6);
    const closed = c.blink < 0;
    // 情绪：机器人逃跑时害怕，追击时坏笑
    const mood = o.isBot ? o.ai.mood : 0;
    const lx = Math.cos(c.dir) * r * 0.1, ly = Math.sin(c.dir) * r * 0.1;
    const ey = c.y - r * 0.12 + ly * 0.5;
    for (const side of [-1, 1]) {
      const ex = c.x + side * r * 0.3 + lx * 0.5;
      if (closed) {
        ctx.strokeStyle = '#2b2d42';
        ctx.lineWidth = r * 0.05;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(ex, ey, r * 0.11, 0.2, Math.PI - 0.2);
        ctx.stroke();
        continue;
      }
      const er = r * (mood === -1 ? 0.19 : 0.16);
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.ellipse(ex, ey, er, er * 1.15, 0, 0, TAU);
      ctx.fill();
      const pr = mood === -1 ? er * 0.38 : er * 0.58;
      ctx.fillStyle = '#1d1e2c';
      ctx.beginPath();
      ctx.arc(ex + lx * 0.6, ey + ly * 0.6, pr, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(ex + lx * 0.6 - pr * 0.35, ey + ly * 0.6 - pr * 0.4, pr * 0.35, 0, TAU);
      ctx.fill();
      if (mood === 1) {
        // 坏笑的眉毛
        ctx.strokeStyle = '#1d1e2c';
        ctx.lineWidth = r * 0.045;
        ctx.beginPath();
        ctx.moveTo(ex - side * er * 1.1, ey - er * 1.5);
        ctx.lineTo(ex + side * er * 0.9, ey - er * 1.0);
        ctx.stroke();
      }
    }
    // 腮红
    if (px > 22) {
      ctx.fillStyle = 'rgba(255,100,140,.28)';
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(c.x + side * r * 0.5 + lx * 0.4, c.y + r * 0.12 + ly * 0.4, r * 0.12, r * 0.07, 0, 0, TAU);
        ctx.fill();
      }
    }
    // 嘴
    ctx.strokeStyle = '#2b2d42';
    ctx.fillStyle = '#7a1f3d';
    ctx.lineWidth = r * 0.045;
    ctx.lineCap = 'round';
    const mx = c.x + lx * 0.4, my = c.y + r * 0.18 + ly * 0.4;
    ctx.beginPath();
    if (mood === -1) {
      ctx.ellipse(mx, my + r * 0.04, r * 0.07, r * 0.09, 0, 0, TAU);
      ctx.fill();
    } else if (mood === 1) {
      ctx.arc(mx, my - r * 0.02, r * 0.16, 0.1, Math.PI - 0.1);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.arc(mx, my - r * 0.04, r * 0.11, 0.35, Math.PI - 0.35);
      ctx.stroke();
    }
  }

  function drawLabel(c, z) {
    const px = c.r * z;
    if (px < 14) return;
    const o = c.owner;
    const fs = Math.max(c.r * 0.28, 11 / z);
    const face = o.skin.face;
    const ny = face ? c.y - c.r * 0.55 : c.y;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `800 ${fs}px "PingFang SC","Microsoft YaHei",sans-serif`;
    ctx.lineWidth = fs * 0.18;
    ctx.strokeStyle = 'rgba(20,20,40,.7)';
    ctx.lineJoin = 'round';
    ctx.strokeText(o.name, c.x, ny);
    ctx.fillStyle = '#fff';
    ctx.fillText(o.name, c.x, ny);
    if (o === player || c.mass > 300) {
      const ms = fs * 0.6;
      ctx.font = `700 ${ms}px "PingFang SC","Microsoft YaHei",sans-serif`;
      ctx.lineWidth = ms * 0.2;
      const my = face ? c.y + c.r * 0.55 : c.y + fs * 0.85;
      ctx.strokeText(Math.floor(c.mass), c.x, my);
      ctx.fillText(Math.floor(c.mass), c.x, my);
    }
  }

  function drawMinimap() {
    const S = mm.width;
    if (!S) return;
    const k = (S - 8 * DPR) / WORLD, o0 = 4 * DPR;
    mctx.clearRect(0, 0, S, mm.height);
    mctx.fillStyle = 'rgba(30,34,60,.6)';
    mctx.beginPath();
    mctx.roundRect ? mctx.roundRect(0, 0, S, S, 12 * DPR) : mctx.rect(0, 0, S, S);
    mctx.fill();
    mctx.strokeStyle = 'rgba(255,255,255,.08)';
    mctx.lineWidth = 1;
    mctx.beginPath();
    for (let i = 1; i < 4; i++) {
      mctx.moveTo(o0 + (i * WORLD * k) / 4, o0);
      mctx.lineTo(o0 + (i * WORLD * k) / 4, o0 + WORLD * k);
      mctx.moveTo(o0, o0 + (i * WORLD * k) / 4);
      mctx.lineTo(o0 + WORLD * k, o0 + (i * WORLD * k) / 4);
    }
    mctx.stroke();
    if (event) {
      const p = 0.5 + 0.5 * Math.sin(time * 6);
      mctx.fillStyle = `rgba(255,112,166,${0.3 + 0.4 * p})`;
      mctx.beginPath();
      mctx.arc(o0 + event.x * k, o0 + event.y * k, 440 * k + 3 * DPR * p, 0, TAU);
      mctx.fill();
    }
    for (const c of cells) {
      if (c.owner === player) continue;
      mctx.fillStyle = G.rgba(c.owner.skin.color, 0.85);
      mctx.beginPath();
      mctx.arc(o0 + c.x * k, o0 + c.y * k, Math.max(1.5 * DPR, c.r * k), 0, TAU);
      mctx.fill();
    }
    if (player && player.alive) {
      for (const c of player.cells) {
        mctx.fillStyle = '#fff';
        mctx.strokeStyle = '#ffd166';
        mctx.lineWidth = 1.5 * DPR;
        mctx.beginPath();
        mctx.arc(o0 + c.x * k, o0 + c.y * k, Math.max(3 * DPR, c.r * k), 0, TAU);
        mctx.fill();
        mctx.stroke();
      }
      // 视野框
      const vw = W / cam.zoom, vh = H / cam.zoom;
      mctx.strokeStyle = 'rgba(255,255,255,.35)';
      mctx.lineWidth = 1;
      mctx.strokeRect(o0 + (cam.x - vw / 2) * k, o0 + (cam.y - vh / 2) * k, vw * k, vh * k);
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
    const rank = G.leaderboard(lbEl, rows.map((o) => ({ id: o.id, name: o.name, score: o.mass })), player && player.alive ? player.id : -1);
    if (player && player.alive) {
      stats.bestRank = Math.min(stats.bestRank, rank);
      document.getElementById('st-score').textContent = G.fmt(player.mass);
      document.getElementById('st-rank').textContent = `${rank}/${rows.length}`;
      document.getElementById('st-kills').textContent = player.kills;
      document.getElementById('st-time').textContent = G.fmtTime(time - stats.start);
      let html = '';
      for (const k of POWER_KEYS) {
        const t = player.power[k];
        if (t > 0 && !(k === 'shield' && time - stats.start < 3.2)) html += `<div class="pw" style="--c:${POWERS[k].color}">${POWERS[k].icon}<div class="bar" style="width:${(t / POWERS[k].dur) * 100}%"></div></div>`;
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
    const w = cv.width, h = cv.height, r = 34;
    g.clearRect(0, 0, w, h);
    g.save();
    g.beginPath();
    g.arc(w / 2, h / 2, r, 0, TAU);
    g.clip();
    const s = r * (SK / 2 / SK_R);
    g.drawImage(skinSprite(skin), w / 2 - s, h / 2 - s, s * 2, s * 2);
    g.restore();
    g.lineWidth = 3;
    g.strokeStyle = G.shade(skin.color, -0.28);
    g.beginPath();
    g.arc(w / 2, h / 2, r, 0, TAU);
    g.stroke();
    if (skin.face) {
      for (const sd of [-1, 1]) {
        g.fillStyle = '#fff';
        g.beginPath();
        g.ellipse(w / 2 + sd * 10, h / 2 - 4, 5.5, 6.5, 0, 0, TAU);
        g.fill();
        g.fillStyle = '#1d1e2c';
        g.beginPath();
        g.arc(w / 2 + sd * 10 + 1, h / 2 - 3, 3.2, 0, TAU);
        g.fill();
      }
      g.strokeStyle = '#2b2d42';
      g.lineWidth = 2;
      g.lineCap = 'round';
      g.beginPath();
      g.arc(w / 2, h / 2 + 4, 6, 0.4, Math.PI - 0.4);
      g.stroke();
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
  const best = G.store.get('ball_best', 0);
  if (best) document.getElementById('best').textContent = `🏆 历史最佳质量：${G.fmt(best)}`;

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
    render(dt);
    updateHud(dt);
    input.endFrame();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.__ball = {
    get player() { return player; },
    get owners() { return owners; },
    dbg,
    startGame,
    step(n = 60) {
      for (let i = 0; i < n; i++) { update(1 / 60); updateHud(1 / 60); input.endFrame(); }
      render(1 / 60);
    },
  };
})();
