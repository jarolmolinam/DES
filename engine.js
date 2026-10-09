'use strict';
/* =====================================================================
   Motor de simulación de eventos discretos (DES)
   Sin dependencias y sin interfaz: se puede probar con Node.
   Unidad de tiempo: milisegundos.
   ===================================================================== */

/* ---------- Generador pseudoaleatorio con semilla (mulberry32) ---------- */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/* Una subsemilla por fuente de azar: cambiar un bloque no altera los demás. */
function subSeed(seed, k) {
  let h = (seed ^ 0x9E3779B9) >>> 0;
  h = Math.imul(h ^ (k + 0x7F4A7C15), 0x85EBCA6B) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xC2B2AE35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

function fmtNum(x) {
  if (x == null || Number.isNaN(x)) return '—';
  if (!Number.isFinite(x)) return '∞';
  const ax = Math.abs(x);
  let s = ax >= 100 ? x.toFixed(0) : ax >= 10 ? x.toFixed(1) : x.toFixed(2);
  if (s.includes('.')) s = s.replace(/\.?0+$/, '');
  return s;
}

function lnFact(n) { let s = 0; for (let i = 2; i <= n; i++) s += Math.log(i); return s; }

/* ---------- Distribuciones ---------- */
const DIST = {
  exp: {
    label: 'Exponencial',
    params: [{ key: 'mean', label: 'Media (ms)', step: 1 }],
    fromMean: m => ({ mean: m }),
    validate: p => (p.mean > 0 ? null : 'La media debe ser mayor que 0.'),
    sample: (p, u) => -p.mean * Math.log(1 - u()),
    mean: p => p.mean,
    variance: p => p.mean * p.mean,
    pdf: (p, x) => (x < 0 ? 0 : Math.exp(-x / p.mean) / p.mean),
    short: p => `Exp · ${fmtNum(p.mean)} ms`,
    letter: () => 'M',
  },
  erlang: {
    label: 'Erlang-k',
    params: [{ key: 'k', label: 'Fases k', step: 1, int: true }, { key: 'mean', label: 'Media (ms)', step: 1 }],
    fromMean: m => ({ k: 3, mean: m }),
    validate: p => (!(Number.isInteger(p.k) && p.k >= 1 && p.k <= 50) ? 'k debe ser un entero entre 1 y 50.'
      : p.mean > 0 ? null : 'La media debe ser mayor que 0.'),
    sample: (p, u) => { let s = 0; for (let i = 0; i < p.k; i++) s -= Math.log(1 - u()); return s * p.mean / p.k; },
    mean: p => p.mean,
    variance: p => p.mean * p.mean / p.k,
    pdf: (p, x) => {
      if (x < 0) return 0;
      const r = p.k / p.mean;
      if (x === 0) return p.k === 1 ? r : 0;
      return Math.exp(p.k * Math.log(r) + (p.k - 1) * Math.log(x) - r * x - lnFact(p.k - 1));
    },
    short: p => `Erlang-${p.k} · ${fmtNum(p.mean)} ms`,
    letter: p => (p.k === 1 ? 'M' : 'E' + p.k),
  },
  unif: {
    label: 'Uniforme',
    params: [{ key: 'a', label: 'Mínimo (ms)', step: 1 }, { key: 'b', label: 'Máximo (ms)', step: 1 }],
    fromMean: m => ({ a: +(m * 0.5).toFixed(3), b: +(m * 1.5).toFixed(3) }),
    validate: p => (!(p.a >= 0) ? 'El mínimo no puede ser negativo.' : p.b > p.a ? null : 'El máximo debe ser mayor que el mínimo.'),
    sample: (p, u) => p.a + (p.b - p.a) * u(),
    mean: p => (p.a + p.b) / 2,
    variance: p => (p.b - p.a) ** 2 / 12,
    pdf: (p, x) => (x >= p.a && x <= p.b ? 1 / (p.b - p.a) : 0),
    short: p => `U[${fmtNum(p.a)}, ${fmtNum(p.b)}] ms`,
    letter: () => 'G',
  },
  lognormal: {
    label: 'Lognormal',
    params: [{ key: 'mean', label: 'Media (ms)', step: 1 }, { key: 'cv', label: 'Coef. de variación', step: 0.1 }],
    fromMean: m => ({ mean: m, cv: 1 }),
    validate: p => (!(p.mean > 0) ? 'La media debe ser mayor que 0.' : p.cv > 0 && p.cv <= 5 ? null : 'El coeficiente de variación debe estar entre 0 y 5.'),
    sample: (p, u) => {
      const s2 = Math.log(1 + p.cv * p.cv), mu = Math.log(p.mean) - s2 / 2;
      const z = Math.sqrt(-2 * Math.log(1 - u())) * Math.cos(2 * Math.PI * u());
      return Math.exp(mu + Math.sqrt(s2) * z);
    },
    mean: p => p.mean,
    variance: p => (p.cv * p.mean) ** 2,
    pdf: (p, x) => {
      if (x <= 0) return 0;
      const s2 = Math.log(1 + p.cv * p.cv), mu = Math.log(p.mean) - s2 / 2;
      return Math.exp(-((Math.log(x) - mu) ** 2) / (2 * s2)) / (x * Math.sqrt(2 * Math.PI * s2));
    },
    short: p => `LogN · ${fmtNum(p.mean)} ms · CV ${fmtNum(p.cv)}`,
    letter: () => 'G',
  },
  det: {
    label: 'Determinística',
    params: [{ key: 'value', label: 'Valor fijo (ms)', step: 1 }],
    fromMean: m => ({ value: m }),
    validate: p => (p.value > 0 ? null : 'El valor debe ser mayor que 0.'),
    sample: p => p.value,
    mean: p => p.value,
    variance: () => 0,
    pdf: () => 0, // masa puntual: la gráfica la dibuja como una barra
    short: p => `Det · ${fmtNum(p.value)} ms`,
    letter: () => 'D',
  },
};

/* ---------- Lista de eventos futuros: montículo binario por (t, seq) ---------- */
function heapPush(h, e) {
  h.push(e);
  let i = h.length - 1;
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (h[p].t < e.t || (h[p].t === e.t && h[p].seq < e.seq)) break;
    h[i] = h[p]; i = p;
  }
  h[i] = e;
}
function heapPop(h) {
  const top = h[0], last = h.pop();
  const n = h.length;
  if (n > 0) {
    let i = 0;
    for (;;) {
      let c = 2 * i + 1;
      if (c >= n) break;
      if (c + 1 < n && (h[c + 1].t < h[c].t || (h[c + 1].t === h[c].t && h[c + 1].seq < h[c].seq))) c++;
      if (last.t < h[c].t || (last.t === h[c].t && last.seq < h[c].seq)) break;
      h[i] = h[c]; i = c;
    }
    h[i] = last;
  }
  return top;
}

/* ---------- Simulador ----------
   model = { arrivals: {type, p},
             stations: [{name, type, p, servers, cap}] }   cap = Infinity → cola sin límite
   Eventos: 'A' llegada al sistema · 'F' fin de servicio en una estación            */
class Sim {
  constructor(model, seed) {
    this.model = model;
    this.seed = seed >>> 0;
    this.clock = 0;
    this.seq = 0;
    this.nextId = 1;
    this.heap = [];
    this.events = 0;
    this.arrivals = 0; this.completed = 0; this.rejected = 0; this.inSystem = 0;
    this.sumW = 0;
    this.rngA = mulberry32(subSeed(this.seed, 0));
    this.st = model.stations.map((cfg, i) => ({
      cfg, rng: mulberry32(subSeed(this.seed, i + 1)),
      queue: [], servers: new Array(cfg.servers).fill(null), busy: 0,
      arrivals: 0, started: 0, served: 0, rejected: 0,
      areaQ: 0, areaB: 0, sumWq: 0, sumS: 0, maxQ: 0,
    }));
    this._scheduleArrival();
  }

  _push(t, type, st, srv, ent) { heapPush(this.heap, { t, seq: this.seq++, type, st, srv, ent }); }

  _scheduleArrival() {
    const a = this.model.arrivals;
    const t = this.clock + DIST[a.type].sample(a.p, this.rngA);
    this._push(t, 'A', 0, -1, { id: this.nextId++, tIn: 0, tQ: 0 });
  }

  peekTime() { return this.heap.length ? this.heap[0].t : Infinity; }

  /* Copia ordenada de la lista de eventos futuros (para mostrarla). */
  fel() { return this.heap.slice().sort((x, y) => x.t - y.t || x.seq - y.seq); }

  _start(i, srv, ent) {
    const s = this.st[i];
    const d = DIST[s.cfg.type].sample(s.cfg.p, s.rng);
    s.servers[srv] = { ent, t0: this.clock, t1: this.clock + d };
    s.busy++; s.started++;
    s.sumWq += this.clock - ent.tQ;
    s.sumS += d;
    this._push(this.clock + d, 'F', i, srv, ent);
  }

  _enter(i, ent, from, log) {
    const s = this.st[i];
    s.arrivals++;
    ent.tQ = this.clock;
    const free = s.servers.indexOf(null);
    let outcome;
    if (free >= 0) { this._start(i, free, ent); outcome = 'servicio'; }
    else if (s.queue.length < s.cfg.cap) {
      s.queue.push(ent);
      if (s.queue.length > s.maxQ) s.maxQ = s.queue.length;
      outcome = 'cola';
    } else { s.rejected++; this.rejected++; this.inSystem--; outcome = 'rechazo'; }
    log.moves.push({ from, to: i, id: ent.id, outcome });
    log.to = i; log.outcome = outcome; log.qlen = s.queue.length;
  }

  /* Procesa exactamente un evento y devuelve su registro. */
  step() {
    if (!this.heap.length) return null;
    const ev = heapPop(this.heap);
    if (ev.t < this.clock) throw new Error('Invariante roto: el reloj retrocede');
    const dt = ev.t - this.clock;
    for (const s of this.st) { s.areaQ += s.queue.length * dt; s.areaB += s.busy * dt; }
    this.clock = ev.t;
    this.events++;
    const log = { n: this.events, t: ev.t, type: ev.type, id: ev.ent.id, st: ev.st, moves: [] };
    if (ev.type === 'A') {
      this.arrivals++; this.inSystem++;
      ev.ent.tIn = ev.t;
      this._scheduleArrival();
      this._enter(0, ev.ent, -1, log);
    } else {
      const s = this.st[ev.st];
      s.servers[ev.srv] = null; s.busy--; s.served++;
      if (s.queue.length) { const nx = s.queue.shift(); log.pulled = nx.id; this._start(ev.st, ev.srv, nx); }
      if (ev.st + 1 < this.st.length) this._enter(ev.st + 1, ev.ent, ev.st, log);
      else {
        this.completed++; this.inSystem--;
        log.w = ev.t - ev.ent.tIn;
        this.sumW += log.w;
        log.moves.push({ from: ev.st, to: this.st.length, id: ev.ent.id, outcome: 'salida' });
      }
    }
    return log;
  }

  /* Estadísticas con promedios ponderados en el tiempo, evaluadas en T >= reloj. */
  stats(T) {
    T = T == null ? this.clock : Math.max(T, this.clock);
    const rem = T - this.clock;
    return {
      T,
      arrivals: this.arrivals, completed: this.completed, rejected: this.rejected, inSystem: this.inSystem,
      W: this.completed ? this.sumW / this.completed : NaN,
      throughput: T > 0 ? this.completed / T * 1000 : 0,
      stations: this.st.map(s => ({
        util: T > 0 ? (s.areaB + s.busy * rem) / (s.cfg.servers * T) : 0,
        Lq: T > 0 ? (s.areaQ + s.queue.length * rem) / T : 0,
        Wq: s.started ? s.sumWq / s.started : NaN,
        S: s.started ? s.sumS / s.started : NaN,
        q: s.queue.length, busy: s.busy, maxQ: s.maxQ,
        arrivals: s.arrivals, served: s.served, rejected: s.rejected,
      })),
    };
  }

  /* Conservación: lo que entra sale, se rechaza o sigue dentro. */
  conserved() {
    let inside = 0;
    for (const s of this.st) inside += s.queue.length + s.busy;
    return this.arrivals === this.completed + this.rejected + this.inSystem && inside === this.inSystem;
  }
}

/* ---------- Resultados teóricos ---------- */
function erlangC(lam, ES, c) {
  const a = lam * ES, rho = a / c;
  let sum = 0, term = 1;
  for (let n = 0; n < c; n++) { sum += term; term *= a / (n + 1); }
  const P0 = 1 / (sum + term / (1 - rho));
  const Lq = P0 * term * rho / ((1 - rho) ** 2);
  return { rho, Lq, Wq: Lq / lam };
}

/* Para cada estación: carga ofrecida, notación de Kendall y, si existe, la teoría.
   Hay teoría cuando la entrada es Poisson y la cola no tiene límite:
   M/M/c (Erlang C) o M/G/1 (Pollaczek-Khinchine). Por el teorema de Burke, la
   salida de una M/M/c estable también es Poisson, así que la cadena continúa. */
function theory(model) {
  const A = model.arrivals, dA = DIST[A.type];
  const lam = 1 / dA.mean(A.p);
  let poisson = dA.letter(A.p) === 'M';
  let inLetter = dA.letter(A.p);
  let allKnown = true, W = 0;
  const stations = model.stations.map(s => {
    const d = DIST[s.type], ES = d.mean(s.p), varS = d.variance(s.p);
    const c = s.servers, inf = s.cap === Infinity;
    const sLetter = d.letter(s.p);
    const offered = lam * ES / c;
    const kendall = `${inLetter}/${sLetter}/${c}` + (inf ? '' : `/${c + s.cap}`);
    const r = { offered, kendall, known: false, unstable: false };
    if (poisson && inf) {
      if (offered >= 1) r.unstable = true;
      else if (sLetter === 'M') Object.assign(r, erlangC(lam, ES, c), { known: true });
      else if (c === 1) {
        const Wq = lam * (varS + ES * ES) / (2 * (1 - offered));
        Object.assign(r, { rho: offered, Wq, Lq: lam * Wq, known: true });
      }
    }
    if (r.known) W += r.Wq + ES; else allKnown = false;
    poisson = poisson && inf && sLetter === 'M' && offered < 1;
    inLetter = poisson ? 'M' : 'G';
    return r;
  });
  return { lam, stations, W: allKnown ? W : null };
}

if (typeof module !== 'undefined') module.exports = { mulberry32, subSeed, fmtNum, DIST, Sim, theory, erlangC };
