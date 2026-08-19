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
  A.cash = function () { if (!ensure()) return; const t = now(); tone('triangle', 880, t, 0.07, 0.08); tone('triangle', 1174, t + 0.07, 0.12, 0.08); };
  A.click = function () { if (!ensure()) return; tone('sine', 500, now(), 0.04, 0.05); };
  A.doorCreak = function () { if (!ensure()) return; tone('sawtooth', 130, now(), 0.7, 0.03, 210); };
  A.flash = function () { if (!ensure()) return; noise(now(), 0.08, 0.14, 6000); };

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
    A.murmur = { src, mg };
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
  };

  g.HAUNT = g.HAUNT || {};
  g.HAUNT.Audio = A;
})(typeof globalThis !== 'undefined' ? globalThis : window);
