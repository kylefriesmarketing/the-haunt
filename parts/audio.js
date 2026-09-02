/* THE HAUNT — audio.js — WebAudio synthesis only. Audio is the star: every timing cue works with eyes closed. */
(function (g) {
  'use strict';
  const A = { ctx: null, master: null, muted: false, organ: null, murmur: null };

  function ensure() {
    if (A.ctx) return true;
    try {
      A.ctx = new (window.AudioContext || window.webkitAudioContext)();
      A.master = A.ctx.createGain();
      A.master.gain.value = A.muted ? 0 : 0.6;
      A.master.connect(A.ctx.destination);
      return true;
    } catch (e) { return false; }
  }
  function now() { return A.ctx.currentTime; }
  function env(gain, t0, a, peak, d, sustain, r, end) {
    gain.gain.cancelScheduledValues(t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + a);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, sustain), t0 + a + d);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d + r + (end || 0));
  }
  function tone(type, freq, t0, dur, peak, glideTo) {
    const o = A.ctx.createOscillator(), ga = A.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, glideTo), t0 + dur);
    env(ga, t0, 0.01, peak, dur * 0.4, peak * 0.4, dur * 0.6);
    o.connect(ga); ga.connect(A.master);
    o.start(t0); o.stop(t0 + dur + 0.1);
  }
  function noise(t0, dur, peak, lp) {
    const len = Math.floor(A.ctx.sampleRate * dur);
    const buf = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = A.ctx.createBufferSource(); src.buffer = buf;
    const f = A.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp || 1200;
    const ga = A.ctx.createGain(); ga.gain.value = peak;
    src.connect(f); f.connect(ga); ga.connect(A.master);
    src.start(t0);
  }

  A.init = function (muted) { A.muted = !!muted; };
  A.setMuted = function (m) { A.muted = m; if (A.master) A.master.gain.value = m ? 0 : 0.6; };
  A.unlock = function () { if (ensure() && A.ctx.state === 'suspended') A.ctx.resume(); };

  /* ---- the cues ---- */
  A.cueTick = function (urgency) { // beat-window heartbeat: rises as the group closes on the node
    if (!ensure()) return;
    const t = now();
    tone('sine', 220 + urgency * 260, t, 0.06, 0.05 + urgency * 0.05);
  };
  A.grade = function (id) {
    if (!ensure()) return; const t = now();
    if (id === 'perfect') { tone('square', 660, t, 0.09, 0.12); tone('square', 990, t + 0.09, 0.14, 0.12); }
    else if (id === 'good') { tone('square', 520, t, 0.1, 0.09); }
    else if (id === 'early') { tone('sine', 320, t, 0.2, 0.07, 240); }
    else { tone('sine', 200, t, 0.3, 0.07, 120); } // late / miss: the sad trombone's cousin
  };
  A.scareHit = function (kind) {
    if (!ensure()) return; const t = now();
    noise(t, 0.12, 0.16, 3000); // the mechanism
    // the scream: goofy formant sweep, never realistic. house law.
    const base = kind === 'dropped' || kind === 'melt' ? 720 : kind === 'gotem' ? 640 : kind === 'scream' ? 560 : 420;
    const n = kind === 'dropped' || kind === 'melt' ? 3 : kind === 'gotem' ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const f = base * (1 + i * 0.13) * (0.9 + Math.random() * 0.2);
      tone('sawtooth', f, t + 0.03 + i * 0.05, 0.5, 0.06, f * 0.55);
    }
    if (kind === 'dropped' || kind === 'melt') noise(t + 0.4, 0.25, 0.08, 500); // the floor
  };
  A.walkby = function () { if (!ensure()) return; tone('sine', 180, now(), 0.35, 0.05, 140); };
  A.pop = function () { if (!ensure()) return; const t = now(); noise(t, 0.05, 0.2, 5000); tone('square', 300, t, 0.06, 0.1, 90); };
  A.comedy = function () { if (!ensure()) return; const t = now(); [392, 494, 587].forEach((f, i) => tone('triangle', f, t + i * 0.08, 0.16, 0.1)); };
  A.alarm = function (on) {
    if (!ensure()) return;
    if (A._alarmO) { try { A._alarmO.stop(); } catch (e) { } A._alarmO = null; }
    if (!on) return;
    const o = A.ctx.createOscillator(), ga = A.ctx.createGain();
    o.type = 'square'; o.frequency.value = 880;
    const lfo = A.ctx.createOscillator(); lfo.frequency.value = 3.2;
    const lg = A.ctx.createGain(); lg.gain.value = 300;
    lfo.connect(lg); lg.connect(o.frequency);
    ga.gain.value = 0.05;
    o.connect(ga); ga.connect(A.master); o.start(); lfo.start();
    A._alarmO = o; A._alarmL = lfo;
    setTimeout(() => { try { o.stop(); lfo.stop(); } catch (e) { } }, 20000);
  };
  A.ghost = function () { // one warm chime. that's all she gets. that's all she needs.
    if (!ensure()) return; const t = now();
    [523.25, 659.25, 783.99].forEach((f, i) => tone('sine', f, t + i * 0.22, 1.4, 0.05));
  };
  A.stingChime = function () {   // the ritual end-of-night sting (FNAF's 6AM law, bible §1.7)
    if (!ensure()) return; const t = now();
    [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) { tone('triangle', f, t + i * 0.11, 0.5, 0.055); });
  };
  A.chalkTick = function () { if (!ensure()) return; noise(now(), 0.03, 0.05, 4200); };
  A.cash = function () { if (!ensure()) return; const t = now(); tone('triangle', 880, t, 0.07, 0.08); tone('triangle', 1174, t + 0.07, 0.12, 0.08); };
  A.click = function () { if (!ensure()) return; tone('sine', 500, now(), 0.04, 0.05); };
  A.doorCreak = function () { if (!ensure()) return; tone('sawtooth', 130, now(), 0.7, 0.03, 210); };
  A.flash = function () { if (!ensure()) return; noise(now(), 0.08, 0.14, 6000); };

  /* ---- M5: the hands, the hardware, the tape ---- */
  A.cloth = function () {   // the peek curtain sweeping past your shoulder
    if (!ensure()) return; const t = now();
    noise(t, 0.16, 0.07, 2200); noise(t + 0.05, 0.12, 0.04, 900);
  };
  A.lever = function () {   // a station lever, pulled by a gloved hand
    if (!ensure()) return; const t = now();
    tone('square', 90, t, 0.06, 0.07, 62); noise(t + 0.03, 0.07, 0.05, 1600);
  };
  A.hammer = function () {  // build day: bolting something into a slot
    if (!ensure()) return; const t = now();
    for (let i = 0; i < 3; i++) { noise(t + i * 0.13, 0.05, 0.11, 2600); tone('square', 150 - i * 12, t + i * 0.13, 0.05, 0.05, 80); }
  };
  A.tape = function (on) {  // the replay theater: heads engaging, then hiss
    if (!ensure()) return;
    if (A._tape) { try { A._tape.src.stop(); } catch (e) { } try { A._tape.g.disconnect(); } catch (e) { } A._tape = null; }
    if (!on) return;
    const t = now();
    tone('square', 220, t, 0.12, 0.05, 90);          // the deck swallowing the cassette
    const ga = A.ctx.createGain(); ga.gain.value = 0.022; ga.connect(A.master);
    const len = Math.floor(A.ctx.sampleRate * 2);
    const buf = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1);
    const src = A.ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const f = A.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 4200;
    src.connect(f); f.connect(ga); src.start();
    A._tape = { src, g: ga };
  };

  /* ---- the crowd: a murmur you can hear through plank walls, and the DIP that means they're close ----
     bible §6.1: the setup half of a scare is audible before it is visible. this is that. */
  A.setCrowd = function (level, tension) {
    if (!A.ctx || !A.murmur) return;
    const C = (g.HAUNT.DATA && g.HAUNT.DATA.CHATTER) || { dip: 0.62 };
    const lv = Math.max(0, Math.min(1, level || 0));
    const tn = Math.max(0, Math.min(1, tension || 0));
    const target = 0.012 + lv * 0.055 * (1 - tn * C.dip);   // they go quiet as the room closes in
    A.murmur.mg.gain.setTargetAtTime(A.muted ? 0 : target, A.ctx.currentTime, 0.25);
    A.murmur.f.frequency.setTargetAtTime(300 + lv * 260 - tn * 150, A.ctx.currentTime, 0.3);
  };
  A.chatterBlip = function (kind) {   // a mumble, a laugh, a nervous giggle, a shush
    if (!ensure()) return;
    const t = now();
    if (kind === 'shush') { noise(t, 0.34, 0.045, 5200); return; }
    const n = kind === 'laugh' ? 6 : kind === 'nervous' ? 3 : 2 + Math.floor(Math.random() * 3);
    const base = kind === 'laugh' ? 300 : kind === 'nervous' ? 380 : 170 + Math.random() * 110;
    for (let i = 0; i < n; i++) {
      const o = A.ctx.createOscillator(), ga = A.ctx.createGain(), f = A.ctx.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = 520 + Math.random() * 700; f.Q.value = 3.2;
      o.type = 'sawtooth';
      const step = kind === 'laugh' ? 0.085 : 0.13;
      const t0 = t + i * step;
      const fr = base * (kind === 'laugh' ? Math.pow(0.93, i) : (0.9 + Math.random() * 0.25));
      o.frequency.setValueAtTime(fr, t0);
      o.frequency.exponentialRampToValueAtTime(Math.max(60, fr * 0.86), t0 + step * 0.8);
      const peak = (kind === 'laugh' ? 0.035 : kind === 'nervous' ? 0.028 : 0.022);
      env(ga, t0, 0.012, peak, step * 0.3, peak * 0.3, step * 0.5);
      o.connect(f); f.connect(ga); ga.connect(A.master);
      o.start(t0); o.stop(t0 + step + 0.12);
    }
  };

  /* ---- beds ---- */
  A.startNightBed = function () {
    if (!ensure()) return;
    A.stopBeds();
    // the murmur of a queue through plank walls + a distant carnival organ, slightly wrong
    const mg = A.ctx.createGain(); mg.gain.value = 0.045; mg.connect(A.master);
    const len = A.ctx.sampleRate * 2;
    const buf = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
    const d = buf.getChannelData(0);
    let v = 0;
    for (let i = 0; i < len; i++) { v = v * 0.98 + (Math.random() * 2 - 1) * 0.05; d[i] = v; }
    const src = A.ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const f = A.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 320; f.Q.value = 0.6;
    src.connect(f); f.connect(mg); src.start();
    A.murmur = { src, mg, f };
    // the organ: a slow minor arpeggio that never resolves
    const og = A.ctx.createGain(); og.gain.value = 0.028; og.connect(A.master);
    const notes = [220, 261.63, 311.13, 261.63, 233.08, 261.63];
    let step = 0;
    const play = () => {
      if (!A.organ) return;
      const t = now();
      const f0 = notes[step % notes.length] * (step % 13 === 12 ? 0.94 : 1); // the wrong one, occasionally
      const o = A.ctx.createOscillator(), ga = A.ctx.createGain();
      o.type = 'triangle'; o.frequency.value = f0;
      env(ga, t, 0.05, 0.9, 0.4, 0.3, 1.2);
      o.connect(ga); ga.connect(og); o.start(t); o.stop(t + 2);
      step++;
      A.organ.timer = setTimeout(play, 950);
    };
    A.organ = { og, timer: null };
    play();
  };
  A.stopBeds = function () {
    if (A.murmur) { try { A.murmur.src.stop(); } catch (e) { } A.murmur = null; }
    if (A.organ) { clearTimeout(A.organ.timer); try { A.organ.og.disconnect(); } catch (e) { } A.organ = null; }
    A.alarm(false);
    A.tape(false);
  };

  g.HAUNT = g.HAUNT || {};
  g.HAUNT.Audio = A;
})(typeof globalThis !== 'undefined' ? globalThis : window);
