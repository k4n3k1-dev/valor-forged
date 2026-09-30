/**
 * Valor Forged audio director.
 *
 * SFX and ambience are synthesised with the Web Audio API so the project does
 * not depend on uncredited sound packs. Background music first tries the
 * optional user-supplied file at public/audio/music/dark-aria.mp3; if that file
 * is unavailable it falls back to an original dark cinematic drone.
 */

const PREF_KEY = 'valorForgedAudioPrefs';

class GameAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicBus = null;
    this.sfxBus = null;
    this.ambienceBus = null;
    this.musicEl = null;
    this.musicSource = null;
    this.musicEnabled = true;
    this.sfxEnabled = true;
    this.act = 1;
    this.bossMode = false;
    this.fallbackNodes = [];
    this.ambienceNodes = [];
    this.musicAttempted = false;
    this.musicUsingFile = false;
    this.loadPrefs();
  }

  loadPrefs() {
    try {
      const prefs = JSON.parse(localStorage.getItem(PREF_KEY) || '{}');
      if (typeof prefs.musicEnabled === 'boolean') this.musicEnabled = prefs.musicEnabled;
      if (typeof prefs.sfxEnabled === 'boolean') this.sfxEnabled = prefs.sfxEnabled;
    } catch { /* ignore corrupted preferences */ }
  }

  savePrefs() {
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify({
        musicEnabled: this.musicEnabled,
        sfxEnabled: this.sfxEnabled
      }));
    } catch { /* storage may be unavailable */ }
  }

  async unlock() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return false;
      this.ctx = new AudioCtx();

      this.master = this.ctx.createGain();
      this.musicBus = this.ctx.createGain();
      this.sfxBus = this.ctx.createGain();
      this.ambienceBus = this.ctx.createGain();
      this.musicBus.connect(this.master);
      this.sfxBus.connect(this.master);
      this.ambienceBus.connect(this.master);
      this.master.connect(this.ctx.destination);
      this.master.gain.value = 0.9;
      this.applyVolumes();
    }

    if (this.ctx.state === 'suspended') {
      try { await this.ctx.resume(); } catch { /* browser blocked it */ }
    }

    if (!this.musicAttempted) this.startMusic();
    this.startAmbience(this.act, this.bossMode);
    return true;
  }

  applyVolumes() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.musicBus.gain.setTargetAtTime(this.musicEnabled ? (this.bossMode ? 0.23 : 0.18) : 0, now, 0.08);
    this.ambienceBus.gain.setTargetAtTime(this.musicEnabled ? (this.bossMode ? 0.10 : 0.14) : 0, now, 0.08);
    this.sfxBus.gain.setTargetAtTime(this.sfxEnabled ? 0.65 : 0, now, 0.04);
    if (this.musicEl) this.musicEl.muted = !this.musicEnabled;
  }

  async startMusic() {
    if (!this.ctx || this.musicAttempted) return;
    this.musicAttempted = true;

    const base = (import.meta.env && import.meta.env.BASE_URL) ? import.meta.env.BASE_URL : './';
    const url = `${base}audio/music/dark-aria.mp3`;
    const el = new Audio(url);
    el.loop = true;
    el.preload = 'auto';
    el.crossOrigin = 'anonymous';
    el.volume = 1;
    el.muted = !this.musicEnabled;
    this.musicEl = el;

    let settled = false;
    const fallback = () => {
      if (settled || this.musicUsingFile) return;
      settled = true;
      try { el.pause(); } catch { /* ignore */ }
      this.startFallbackMusic();
    };

    el.addEventListener('canplaythrough', async () => {
      if (settled) return;
      try {
        if (!this.musicSource) {
          this.musicSource = this.ctx.createMediaElementSource(el);
          this.musicSource.connect(this.musicBus);
        }
        await el.play();
        this.musicUsingFile = true;
        settled = true;
        this.stopFallbackMusic();
      } catch {
        fallback();
      }
    }, { once: true });

    el.addEventListener('error', fallback, { once: true });
    try { el.load(); } catch { fallback(); }
    setTimeout(() => fallback(), 1800);
  }

  startFallbackMusic() {
    if (!this.ctx || this.fallbackNodes.length) return;
    const roots = { 1: 55.0, 2: 46.25, 3: 41.20 };
    const root = roots[this.act] || 46.25;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = this.bossMode ? 820 : 560;
    filter.Q.value = 1.2;

    const padGain = this.ctx.createGain();
    padGain.gain.value = 0.11;
    filter.connect(padGain);
    padGain.connect(this.musicBus);

    const ratios = [1, 1.1892, 1.4983]; // dark minor-coloured drone, no copied melody
    const nodes = [filter, padGain];
    ratios.forEach((ratio, i) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = i === 0 ? 'sine' : 'triangle';
      osc.frequency.value = root * ratio;
      g.gain.value = i === 0 ? 0.34 : 0.16;
      osc.connect(g);
      g.connect(filter);
      osc.start();
      nodes.push(osc, g);
    });

    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.value = 0.08;
    lfoGain.gain.value = 0.035;
    lfo.connect(lfoGain);
    lfoGain.connect(padGain.gain);
    lfo.start();
    nodes.push(lfo, lfoGain);
    this.fallbackNodes = nodes;
  }

  stopFallbackMusic() {
    this.fallbackNodes.forEach(node => {
      try { node.stop?.(); } catch { /* gains/filters do not stop */ }
      try { node.disconnect?.(); } catch { /* ignore */ }
    });
    this.fallbackNodes = [];
  }

  stopAmbience() {
    this.ambienceNodes.forEach(node => {
      try { node.stop?.(); } catch { /* ignore */ }
      try { node.disconnect?.(); } catch { /* ignore */ }
    });
    this.ambienceNodes = [];
  }

  createNoiseBuffer(seconds = 2) {
    const length = Math.max(1, Math.floor(this.ctx.sampleRate * seconds));
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      last = last * 0.985 + white * 0.015;
      data[i] = white * 0.45 + last * 0.55;
    }
    return buffer;
  }

  startAmbience(act = 1, boss = false) {
    if (!this.ctx) return;
    this.stopAmbience();
    this.act = act;
    this.bossMode = boss;
    this.applyVolumes();

    const source = this.ctx.createBufferSource();
    source.buffer = this.createNoiseBuffer(3);
    source.loop = true;
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    if (act === 1) {
      filter.type = 'bandpass'; filter.frequency.value = boss ? 360 : 690; filter.Q.value = 0.7;
      gain.gain.value = boss ? 0.12 : 0.08;
    } else if (act === 2) {
      filter.type = 'lowpass'; filter.frequency.value = boss ? 520 : 330; filter.Q.value = 1.1;
      gain.gain.value = boss ? 0.14 : 0.10;
    } else {
      filter.type = 'lowpass'; filter.frequency.value = boss ? 440 : 260; filter.Q.value = 0.9;
      gain.gain.value = boss ? 0.15 : 0.11;
    }

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.ambienceBus);
    source.start();
    this.ambienceNodes.push(source, filter, gain);

    if (act === 3) {
      const rumble = this.ctx.createOscillator();
      const rumbleGain = this.ctx.createGain();
      rumble.type = 'sine';
      rumble.frequency.value = boss ? 41 : 32;
      rumbleGain.gain.value = boss ? 0.11 : 0.06;
      rumble.connect(rumbleGain);
      rumbleGain.connect(this.ambienceBus);
      rumble.start();
      this.ambienceNodes.push(rumble, rumbleGain);
    }

    if (!this.musicUsingFile && this.fallbackNodes.length) {
      this.stopFallbackMusic();
      this.startFallbackMusic();
    }
  }

  setScene(act, boss = false) {
    this.act = act;
    this.bossMode = boss;
    if (this.ctx) this.startAmbience(act, boss);
  }

  toggleMusic() {
    this.musicEnabled = !this.musicEnabled;
    this.savePrefs();
    this.applyVolumes();
    if (this.musicEnabled) {
      this.unlock();
      if (this.musicEl && this.musicUsingFile) this.musicEl.play().catch(() => {});
    }
    return this.musicEnabled;
  }

  toggleSfx() {
    this.sfxEnabled = !this.sfxEnabled;
    this.savePrefs();
    this.applyVolumes();
    if (this.sfxEnabled) this.unlock();
    return this.sfxEnabled;
  }

  tone(freq = 440, duration = 0.12, options = {}) {
    if (!this.ctx || !this.sfxEnabled) return;
    const now = this.ctx.currentTime + (options.delay || 0);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    osc.type = options.type || 'sine';
    osc.frequency.setValueAtTime(Math.max(20, freq), now);
    if (options.endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, options.endFreq), now + duration);
    filter.type = options.filterType || 'lowpass';
    filter.frequency.value = options.filterFreq || 8000;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(options.gain || 0.08, now + Math.min(0.018, duration * 0.15));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxBus);
    osc.start(now);
    osc.stop(now + duration + 0.03);
  }

  noise(duration = 0.12, options = {}) {
    if (!this.ctx || !this.sfxEnabled) return;
    const now = this.ctx.currentTime + (options.delay || 0);
    const src = this.ctx.createBufferSource();
    src.buffer = this.createNoiseBuffer(Math.max(0.1, duration));
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    filter.type = options.filterType || 'bandpass';
    filter.frequency.value = options.freq || 1000;
    filter.Q.value = options.q || 0.8;
    gain.gain.setValueAtTime(options.gain || 0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxBus);
    src.start(now);
    src.stop(now + duration + 0.02);
  }

  play(name) {
    if (!this.ctx || !this.sfxEnabled) return;
    switch (name) {
      case 'ui':
        this.tone(640, 0.055, { type: 'triangle', gain: 0.035, endFreq: 760 });
        break;
      case 'swing':
        this.noise(0.14, { filterType: 'highpass', freq: 1500, gain: 0.09 });
        this.tone(210, 0.13, { type: 'sawtooth', gain: 0.035, endFreq: 95 });
        break;
      case 'hit':
        this.noise(0.09, { freq: 740, gain: 0.12 });
        this.tone(115, 0.12, { type: 'square', gain: 0.055, endFreq: 72 });
        break;
      case 'enemyDeath':
        this.tone(180, 0.35, { type: 'sawtooth', gain: 0.07, endFreq: 48, filterFreq: 900 });
        this.noise(0.24, { freq: 450, gain: 0.055 });
        break;
      case 'hurt':
        this.tone(175, 0.20, { type: 'sawtooth', gain: 0.065, endFreq: 92, filterFreq: 1100 });
        break;
      case 'death':
        this.tone(130, 0.65, { type: 'sawtooth', gain: 0.085, endFreq: 36, filterFreq: 700 });
        this.noise(0.5, { filterType: 'lowpass', freq: 520, gain: 0.065 });
        break;
      case 'projectile':
        this.tone(520, 0.20, { type: 'sine', gain: 0.035, endFreq: 250 });
        break;
      case 'fireball':
        this.tone(310, 0.28, { type: 'sawtooth', gain: 0.045, endFreq: 145, filterFreq: 1400 });
        this.noise(0.18, { freq: 900, gain: 0.035 });
        break;
      case 'blocked':
        this.noise(0.11, { freq: 520, gain: 0.085 });
        this.tone(220, 0.09, { type: 'triangle', gain: 0.035, endFreq: 160 });
        break;
      case 'potion':
        this.tone(440, 0.16, { type: 'sine', gain: 0.045 });
        this.tone(660, 0.20, { type: 'sine', gain: 0.045, delay: 0.09 });
        this.tone(880, 0.18, { type: 'sine', gain: 0.03, delay: 0.18 });
        break;
      case 'coin':
        this.tone(900, 0.08, { type: 'triangle', gain: 0.045 });
        this.tone(1320, 0.11, { type: 'triangle', gain: 0.038, delay: 0.055 });
        break;
      case 'save':
        this.tone(523, 0.12, { type: 'sine', gain: 0.04 });
        this.tone(784, 0.22, { type: 'sine', gain: 0.04, delay: 0.10 });
        break;
      case 'portal':
        this.tone(160, 0.52, { type: 'sine', gain: 0.06, endFreq: 520 });
        this.tone(320, 0.42, { type: 'triangle', gain: 0.035, endFreq: 720, delay: 0.08 });
        break;
      case 'boss':
        this.tone(55, 0.85, { type: 'sine', gain: 0.13, endFreq: 43 });
        this.noise(0.55, { filterType: 'lowpass', freq: 260, gain: 0.08 });
        break;
      case 'charge':
        this.noise(0.36, { filterType: 'highpass', freq: 550, gain: 0.08 });
        this.tone(90, 0.32, { type: 'sawtooth', gain: 0.055, endFreq: 170, filterFreq: 850 });
        break;
      case 'slam':
        this.tone(48, 0.52, { type: 'sine', gain: 0.16, endFreq: 30 });
        this.noise(0.40, { filterType: 'lowpass', freq: 420, gain: 0.12 });
        break;
      case 'levelUp':
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.22, { type: 'triangle', gain: 0.045, delay: i * 0.09 }));
        break;
      case 'victory':
        [392, 523, 659, 784].forEach((f, i) => this.tone(f, 0.55, { type: 'sine', gain: 0.045, delay: i * 0.07 }));
        break;
      case 'footstep':
        this.noise(0.07, { filterType: 'lowpass', freq: this.act === 3 ? 330 : 520, gain: 0.035 });
        this.tone(this.act === 3 ? 72 : 95, 0.06, { type: 'sine', gain: 0.018 });
        break;
      default:
        this.tone(440, 0.06, { gain: 0.025 });
    }
  }
}

export const gameAudio = new GameAudio();
