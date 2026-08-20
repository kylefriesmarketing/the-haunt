/* THE HAUNT — net.js — co-op crew mode. 2–4 monsters in the same barn.
   HOST-AUTHORITATIVE, not lockstep (bible §10): the host runs the one true sim and broadcasts
   what the room looks like; guests are renderers that send thin intents (a trigger, a position).
   That means guests need no determinism at all — there is only ever one sim.
   PvE only. There is no PvP path in here and there never will be (bible §1.13).

   NO DOM at load time: this file is importable in node, and the fake transport below is what
   `test-net.mjs` drives. PeerJS is fetched lazily, only when somebody actually opens the lobby,
   so single-player still boots from file:// with no network at all. */
(function (g) {
  'use strict';
  const H = g.HAUNT;
  const CODE_ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // no I/O/0/1 — people read these aloud
  const PEER_PREFIX = 'haunt-barn-';
  const MAX_SEATS = 4;

  const N = {
    active: false, isHost: false, seat: 0, code: null, name: '',
    roster: [],            // [{seat, name}]
    conns: [],             // host: [{conn, seat, name}] · guest: [{conn}]
    peer: null, onEvent: null, lastErr: null
  };

  function fire(type, payload) { if (N.onEvent) { try { N.onEvent(type, payload); } catch (e) { } } }

  /* ---------- transport ----------
     Anything with .send(obj) / .on(evt, fn) works, so the harness can swap in fake wires. */
  function wireHost(conn) {
    const entry = { conn, seat: null, name: null };
    N.conns.push(entry);
    conn.on('data', msg => {
      if (!msg || typeof msg !== 'object') return;
      if (msg.t === 'hello') {
        const seat = nextSeat();
        if (seat === null) { try { conn.send({ t: 'full' }); } catch (e) { } return; }
        entry.seat = seat; entry.name = String(msg.name || 'a monster').slice(0, 18);
        rebuildRoster();
        try { conn.send({ t: 'welcome', seat, roster: N.roster }); } catch (e) { }
        N.broadcast({ t: 'roster', roster: N.roster });
        fire('join', { seat, name: entry.name });
        return;
      }
      if (entry.seat === null) return;                       // never trust a seatless client
      if (msg.t === 'cmd') fire('cmd', { seat: entry.seat, c: msg.c });
      else if (msg.t === 'pos') fire('pos', { seat: entry.seat, x: msg.x, z: msg.z, yaw: msg.yaw });
    });
    conn.on('close', () => {
      const i = N.conns.indexOf(entry);
      if (i >= 0) N.conns.splice(i, 1);
      rebuildRoster();
      N.broadcast({ t: 'roster', roster: N.roster });
      fire('leave', { seat: entry.seat, name: entry.name });
    });
  }
  function wireGuest(conn) {
    conn.on('data', msg => {
      if (!msg || typeof msg !== 'object') return;
      if (msg.t === 'welcome') { N.seat = msg.seat; N.roster = msg.roster || []; fire('seat', { seat: msg.seat }); }
      else if (msg.t === 'roster') { N.roster = msg.roster || []; fire('roster', N.roster); }
      else if (msg.t === 'full') fire('full', {});
      else fire(msg.t, msg);                                  // start · snap · ev · over · bye
    });
    conn.on('close', () => { N.active = false; fire('hostgone', {}); });
  }
  function nextSeat() {
    for (let s = 1; s < MAX_SEATS; s++) if (!N.conns.some(c => c.seat === s)) return s;
    return null;
  }
  function rebuildRoster() {
    N.roster = [{ seat: 0, name: N.name || 'the boss' }]
      .concat(N.conns.filter(c => c.seat !== null).map(c => ({ seat: c.seat, name: c.name })))
      .sort((a, b) => a.seat - b.seat);
  }

  /* ---------- peerjs, fetched only when somebody wants company ---------- */
  function loadPeer() {
    if (typeof window === 'undefined') return Promise.reject(new Error('no browser'));
    if (window.Peer) return Promise.resolve();
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://unpkg.com/peerjs@1.5.2/dist/peerjs.min.js';
      s.onload = () => res();
      s.onerror = () => rej(new Error('could not reach peerjs'));
      document.head.appendChild(s);
      setTimeout(() => { if (!window.Peer) rej(new Error('peerjs timed out')); }, 12000);
    });
  }
  function makeCode() {
    let c = '';
    for (let i = 0; i < 4; i++) c += CODE_ALPHA[Math.floor(Math.random() * CODE_ALPHA.length)];
    return c;
  }

  N.host = function (name, onEvent) {
    N.onEvent = onEvent;
    return loadPeer().then(() => new Promise((res, rej) => {
      const code = makeCode();
      const peer = new window.Peer(PEER_PREFIX + code, { debug: 0 });
      N.peer = peer;
      let settled = false;
      peer.on('open', () => {
        settled = true;
        N.active = true; N.isHost = true; N.seat = 0; N.code = code;
        N.name = String(name || 'the boss').slice(0, 18);
        N.conns = []; rebuildRoster();
        res({ code });
      });
      peer.on('connection', conn => { conn.on('open', () => wireHost(conn)); });
      peer.on('error', e => { N.lastErr = e; if (!settled) { settled = true; rej(e); } });
    }));
  };

  N.join = function (code, name, onEvent) {
    N.onEvent = onEvent;
    code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    return loadPeer().then(() => new Promise((res, rej) => {
      const peer = new window.Peer({ debug: 0 });
      N.peer = peer;
      let settled = false;
      peer.on('open', () => {
        const conn = peer.connect(PEER_PREFIX + code, { reliable: true });
        conn.on('open', () => {
          N.active = true; N.isHost = false; N.code = code;
          N.name = String(name || 'a monster').slice(0, 18);
          N.conns = [{ conn }];
          wireGuest(conn);
          conn.send({ t: 'hello', name: N.name });
          settled = true; res({ joined: true });
        });
        conn.on('error', e => { if (!settled) { settled = true; rej(e); } });
      });
      peer.on('error', e => { N.lastErr = e; if (!settled) { settled = true; rej(e); } });
      setTimeout(() => { if (!settled) { settled = true; rej(new Error('nobody answered that code')); } }, 15000);
    }));
  };

  /* ---------- talking ---------- */
  N.broadcast = function (msg) {
    if (!N.isHost) return;
    for (const e of N.conns) { if (e.seat === null) continue; try { e.conn.send(msg); } catch (err) { } }
  };
  N.toSeat = function (seat, msg) {
    if (!N.isHost) return;
    const e = N.conns.find(c => c.seat === seat);
    if (e) { try { e.conn.send(msg); } catch (err) { } }
  };
  N.toHost = function (msg) {
    if (N.isHost || !N.conns.length) return;
    try { N.conns[0].conn.send(msg); } catch (e) { }
  };
  N.cmd = function (c) { N.toHost({ t: 'cmd', c }); };
  N.pos = function (x, z, yaw) { N.toHost({ t: 'pos', x: r2(x), z: r2(z), yaw: r2(yaw) }); };
  function r2(v) { return Math.round(v * 100) / 100; }

  N.close = function () {
    try { N.broadcast({ t: 'bye' }); } catch (e) { }
    for (const e of N.conns) { try { e.conn.close(); } catch (err) { } }
    if (N.peer) { try { N.peer.destroy(); } catch (e) { } }
    N.peer = null; N.conns = []; N.active = false; N.isHost = false;
    N.seat = 0; N.code = null; N.roster = [];
  };

  N.nameOf = function (actor) {
    if (!actor) return 'somebody';
    const seat = /^s(\d+)$/.exec(String(actor));
    if (!seat) return actor === 'you' ? 'you' : actor;
    const r = N.roster.find(x => x.seat === +seat[1]);
    if (+seat[1] === N.seat) return 'you';
    return r ? r.name : 'a monster';
  };
  N.actorOf = function (seat) { return 's' + seat; };

  /* ---------- the wire format ----------
     One snapshot is everything a renderer needs and nothing it doesn't. Guests are packed as
     flat number arrays because they're the bulk of the payload at 15 Hz. */
  const FACES = ['calm', 'worry', 'scream', 'joy'];
  function archKeys() { return Object.keys(H.DATA.ARCHETYPES); }

  N.snapshot = function (night, deltas, crew) {
    const AK = archKeys();
    const gs = [];
    for (const gst of night.guests) {
      if (gst.out) continue;
      const p = night.guestPos(gst);
      const po = H.Replay.poseOf(gst);
      gs.push([gst.id, AK.indexOf(gst.arch), r2(p.x), r2(po.ly), r2(p.z),
        r2(Math.atan2(p.dirX, p.dirZ)), r2(po.tilt), FACES.indexOf(po.face),
        r2(gst.nerve / gst.pool), r2(po.yOff), gst.state === 'distress' ? 1 : 0]);
    }
    const st = {};
    for (const id of Object.keys(night.stations)) st[id] = r2(Math.max(0, night.stations[id].readyAt - night.t));
    return {
      t: 'snap', tt: r2(night.t), g: gs, st, nd: deltas || {}, crew: crew || [],
      tal: night.tally, dr: night.drawer, al: night.alarm.active ? 1 : 0, sp: night.spawned,
      bd: night.bodyReadyAt, cd: night.comedyReadyAt
    };
  };

  /* the render list a guest draws — same shape View.renderGuests takes from the live sim */
  N.readGuests = function (snap) {
    const AK = archKeys();
    return (snap.g || []).map(e => ({
      id: e[0], arch: AK[e[1]] || 'chain', x: e[2], y: e[3], z: e[4],
      ry: e[5], tilt: e[6], face: FACES[e[7]] || 'calm', nerve: e[8], bob: e[9], distress: !!e[10],
      state: e[10] ? 'distress' : 'walk'
    }));
  };

  /* ---------- the harness transport: two ends of one wire, in memory ----------
     send() round-trips through JSON exactly like the real thing, so a bug where somebody
     ships a live object reference across the wire fails here too. */
  function mkFake(label) {
    const handlers = {};
    return {
      label, open: true, other: null,
      on(ev, fn) { (handlers[ev] = handlers[ev] || []).push(fn); return this; },
      emit(ev, data) { (handlers[ev] || []).slice().forEach(f => f(data)); },
      send(obj) {
        if (!this.open || !this.other || !this.other.open) return;
        this.other.emit('data', JSON.parse(JSON.stringify(obj)));
      },
      close() {
        if (!this.open) return;
        this.open = false; this.emit('close');
        if (this.other && this.other.open) { this.other.open = false; this.other.emit('close'); }
      }
    };
  }
  N.test = {
    pair(label) { const a = mkFake(label + ':host'), b = mkFake(label + ':guest'); a.other = b; b.other = a; return [a, b]; },
    /* stand up a host with no peerjs at all */
    hostLocal(name, onEvent) {
      N.onEvent = onEvent; N.active = true; N.isHost = true; N.seat = 0;
      N.code = 'TEST'; N.name = name || 'the boss'; N.conns = []; rebuildRoster();
      return N;
    },
    acceptGuest(conn) { wireHost(conn); },
    /* a guest side that speaks the same protocol but keeps its own state (many per process) */
    guestLocal(conn, name, onEvent) {
      const G = { seat: null, roster: [], name: name, snaps: 0, last: null, started: null, over: null, events: [] };
      conn.on('data', msg => {
        if (!msg || typeof msg !== 'object') return;
        if (msg.t === 'welcome') { G.seat = msg.seat; G.roster = msg.roster; }
        else if (msg.t === 'roster') G.roster = msg.roster;
        else if (msg.t === 'snap') { G.snaps++; G.last = msg; }
        else if (msg.t === 'start') G.started = msg;
        else if (msg.t === 'over') G.over = msg;
        else if (msg.t === 'ev') G.events.push.apply(G.events, msg.evs || []);
        if (onEvent) onEvent(msg);
      });
      conn.send({ t: 'hello', name });
      G.cmd = c => conn.send({ t: 'cmd', c });
      G.pos = (x, z, yaw) => conn.send({ t: 'pos', x, z, yaw });
      G.conn = conn;
      return G;
    },
    reset() { N.onEvent = null; N.active = false; N.isHost = false; N.seat = 0; N.code = null; N.roster = []; N.conns = []; N.peer = null; }
  };

  N.MAX_SEATS = MAX_SEATS;
  H.Net = N;
})(typeof globalThis !== 'undefined' ? globalThis : window);
