"use strict";

const $ = (id) => document.getElementById(id);
const canvas = $("game");
const ctx = canvas.getContext("2d");
const chapters = [
  "노을 정거장", "솔방울 고갯길", "별빛 오솔길", "단풍 우체국", "달안개 골짜기", "보름달 종착역",
];
const chapterTypes = [
  ["blob", "blob", "dash"], ["dash", "blob", "dash"], ["shell", "blob", "shell"],
  ["shell", "dash", "blob"], ["dash", "shell", "dash"], ["shell", "dash", "shell"],
];
const upgradeNames = { power: "불꽃 도토리", speed: "바람 깃털", spark: "번개 수정" };
const upgradeEffects = { power: "공격력 +28% · 범위 증가", speed: "연사 · 이동 속도 증가", spark: "여러 슬라임에게 튀는 연쇄 번개" };
const enemyTypes = {
  blob: { hp: 33, r: 26, speed: 49, damage: 9, radius: 60, warn: .78 },
  dash: { hp: 47, r: 25, speed: 88, damage: 13, radius: 78, warn: .63 },
  shell: { hp: 82, r: 34, speed: 43, damage: 17, radius: 79, warn: .86 },
  boss: { hp: 430, r: 63, speed: 45, damage: 22, radius: 150, warn: 1.18 },
};
const keySets = [
  { left: "KeyA", right: "KeyD", up: "KeyW", down: "KeyS", attack: "KeyF", dodge: "KeyG" },
  { left: "ArrowLeft", right: "ArrowRight", up: "ArrowUp", down: "ArrowDown", attack: "KeyK", dodge: "KeyL" },
];
const keyboardCodes = new Set(keySets.flatMap(Object.values));
const keys = new Set();
const bounds = { left: 197, right: 1243, top: 240, bottom: 692 };
const wavesPerChapter = 4;
const totalWaves = chapters.length * wavesPerChapter;
const saveKey = "moonlit-delivery-save-v1";
const padSides = [null, null];
const padPrevious = new Map();

let screen = "menu";
let choices = [0, 1];
let selectedSlot = 0;
let time = 0;
let lastFrame = 0;
let nextAction = null;
let pausedFrom = "playing";
let players = [];
let enemies = [];
let items = [];
let effects = [];
let projectiles = [];
let upgrades = { power: 0, speed: 0, spark: 0 };
let roundStartUpgrades = { ...upgrades };
let round = 0;
let spawn = [];
let spawnWait = 0;
let activeTime = 0;
let clearedTime = 0;
let noticeTime = 0;
let shake = 0;
let freeze = 0;
let hudTime = 0;
let dashTrail = 0;
let supplyAt = 0;
let padCount = -1;
let soundOn = true;
let audioContext;

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const random = (min, max) => min + Math.random() * (max - min);
const distance = (a, b) => Math.hypot(a.x - b.x, (a.y - b.y) * 1.48);
const chapterIndex = () => Math.floor(round / wavesPerChapter);
const waveIndex = () => round % wavesPerChapter;
const upgradeKeys = Object.keys(upgradeNames);

function readSave() {
  try {
    const data = JSON.parse(localStorage.getItem(saveKey));
    if (!data || !Number.isInteger(data.round) || data.round < 0 || data.round >= totalWaves ||
        !Array.isArray(data.choices) || data.choices.length !== 2 || data.choices[0] === data.choices[1] ||
        data.choices.some((pick) => !Number.isInteger(pick) || !CAST[pick])) return null;
    if (!data.upgrades || upgradeKeys.some((key) => !Number.isInteger(data.upgrades[key]) || data.upgrades[key] < 0 || data.upgrades[key] > totalWaves * 4)) return null;
    return data;
  } catch {
    return null;
  }
}

function saveProgress(at) {
  try {
    if (at < totalWaves) localStorage.setItem(saveKey, JSON.stringify({ round: at, upgrades, choices }));
    else localStorage.removeItem(saveKey);
  } catch {
    // The game still works when browser storage is unavailable.
  }
}

function unlockAudio() {
  if (!soundOn) return;
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) return;
  audioContext ??= new Audio();
  if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
}

function tone(notes, type, volume, duration) {
  if (!soundOn || audioContext?.state !== "running") return;
  notes.forEach((frequency, i) => {
    const start = audioContext.currentTime + i * .057;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, start);
    if (type === "triangle") osc.frequency.exponentialRampToValueAtTime(frequency * .62, start + duration);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(.001, start + duration);
    osc.connect(gain).connect(audioContext.destination);
    osc.start(start);
    osc.stop(start + duration);
  });
}

function show(view) {
  screen = view;
  const overlays = { menu: "menu", select: "select", pause: "interlude", rest: "interlude", retry: "interlude", win: "interlude" };
  for (const id of ["menu", "select", "interlude"]) $(id).hidden = overlays[view] !== id;
  $("hud").hidden = !["playing", "pause", "rest", "retry", "win"].includes(view);
  $("notice").hidden = view !== "playing" || noticeTime <= 0;
}

function menu() {
  show("menu");
  $("openSelect").focus({ preventScroll: true });
}

function refreshSelection() {
  for (const i of [0, 1]) {
    const slot = $("slot" + (i + 1));
    slot.textContent = (i + 1) + "P · " + CAST[choices[i]].name;
    slot.setAttribute("aria-pressed", i === selectedSlot);
  }
  for (const [i, card] of Array.from($("roster").children).entries()) {
    card.setAttribute("aria-pressed", i === choices[selectedSlot]);
    card.querySelector(".owner").textContent = choices.includes(i) ? " · " + (choices.indexOf(i) + 1) + "P" : "";
  }
  const save = readSave();
  $("continueGame").hidden = !save;
  if (save) $("continueGame").textContent = "이어하기 · " + (Math.floor(save.round / wavesPerChapter) + 1) + "장";
}

function openSelection() {
  refreshSelection();
  show("select");
  $("slot1").focus({ preventScroll: true });
}

CAST.forEach((character, i) => {
  const card = document.createElement("button");
  card.className = "character";
  card.style.setProperty("--accent", character.color);
  const preview = document.createElement("canvas");
  preview.width = 136;
  preview.height = 103;
  preview.setAttribute("aria-hidden", "true");
  Art.hero(preview.getContext("2d"), { cast: character, x: 67, y: 94, face: 1 }, i, .84);
  const title = document.createElement("strong");
  title.textContent = character.name;
  const owner = document.createElement("span");
  owner.className = "owner";
  title.append(owner);
  const label = document.createElement("small");
  label.textContent = character.role;
  card.append(preview, title, label);
  card.onclick = () => {
    const previousOwner = choices.indexOf(i);
    if (previousOwner >= 0 && previousOwner !== selectedSlot) choices[previousOwner] = choices[selectedSlot];
    choices[selectedSlot] = i;
    refreshSelection();
    tone([420, 630], "sine", .043, .12);
  };
  $("roster").append(card);
});

for (const i of [0, 1]) {
  $("slot" + (i + 1)).onclick = () => { selectedSlot = i; refreshSelection(); };
}

function freshPlayer(i, kind) {
  const cast = CAST[kind];
  return {
    cast, x: 618 + i * 204, y: 524, vx: 0, vy: 0, directionX: i ? -1 : 1,
    directionY: 0, face: i ? -1 : 1, phase: i * 1.71, label: (i + 1) + "P",
    hp: cast.hp, cd: .12, invulnerable: .85, dash: 0, dodgeDelay: 0, dodgeHeld: false,
    down: false, revive: 0, anim: 0, moving: false,
  };
}

function start(save) {
  unlockAudio();
  if (save) {
    round = save.round;
    choices = [...save.choices];
    upgrades = { ...save.upgrades };
  } else {
    round = 0;
    upgrades = { power: 0, speed: 0, spark: 0 };
  }
  saveProgress(round);
  startRound();
}

function showNotice(message, seconds = 2.6) {
  $("notice").textContent = message;
  $("notice").hidden = false;
  noticeTime = seconds;
}

function describeRound() {
  if (round === 0) return "공격을 누르고 있으면 가까운 슬라임을 자동으로 공격해요";
  if (round === 1) return "쓰러진 동료 곁에 서면 일으켜 줄 수 있어요";
  if (round === 2) return "두 사람이 같은 슬라임을 연달아 맞히면 협동 폭발!";
  return waveIndex() === 3 ? "왕관 슬라임 등장!" : chapters[chapterIndex()];
}

function startRound() {
  roundStartUpgrades = { ...upgrades };
  players = choices.map((kind, i) => freshPlayer(i, kind));
  enemies = [];
  projectiles = [];
  items = [];
  effects = [];
  clearedTime = 0;
  activeTime = 0;
  freeze = 0;
  shake = 0;
  hudTime = 0;
  const wave = waveIndex();
  const chapter = chapterIndex();
  const count = 9 + wave * 3 + chapter;
  spawn = Array.from({ length: count }, (_, i) => chapterTypes[chapter][(i + wave) % 3]);
  if (round === 0) spawn = ["blob", "blob", "blob", "blob", "dash", "blob", "blob", "dash", "blob"];
  if (wave === 3) spawn.splice(4, 0, "boss");
  spawnWait = 1.05;
  supplyAt = 9.2;
  show("playing");
  showNotice(describeRound(), round <= 2 ? 5 : 2.5);
  updateHud();
}

function showBreak(view, label, title, detail, nextLabel, handler) {
  nextAction = handler;
  $("breakLabel").textContent = label;
  $("breakTitle").textContent = title;
  $("breakText").textContent = detail;
  $("next").textContent = nextLabel + " →";
  show(view);
  $("next").focus({ preventScroll: true });
}

function togglePause() {
  if (screen === "playing") {
    pausedFrom = screen;
    keys.clear();
    showBreak("pause", "달빛 특송", "잠시 쉽니다", "공격을 누르면 자동 조준해요. 동료가 쓰러지면 옆에 서서 일으켜 주세요.", "계속하기", () => show(pausedFrom));
  } else if (screen === "pause") {
    keys.clear();
    show(pausedFrom);
  }
}

function updateHud() {
  if (!players.length) return;
  $("chapter").textContent = (chapterIndex() + 1) + "장 · " + chapters[chapterIndex()];
  $("wave").textContent = "라운드 " + (waveIndex() + 1) + " / " + wavesPerChapter;
  $("remaining").textContent = "남은 슬라임 " + (spawn.length + enemies.length);
  players.forEach((p, i) => {
    const box = $("life" + (i + 1));
    box.style.setProperty("--accent", p.cast.color);
    const health = Math.max(0, Math.ceil(p.hp));
    box.innerHTML = "<strong>" + p.label + " · " + p.cast.name + "</strong><div class='health'><i style='width:" +
      (100 * health / p.cast.hp) + "%'></i></div><small>" +
      (p.down ? "구조 필요" : health + " / " + p.cast.hp) + " · 화력 " + upgrades.power + " · 속도 " + upgrades.speed + " · 번개 " + upgrades.spark + "</small>";
  });
}

function readGamepads() {
  try {
    return Array.from(navigator.getGamepads?.() || []).filter((pad) => pad?.connected && pad.mapping === "standard").slice(0, 2);
  } catch {
    return [];
  }
}

function menuNav(delta) {
  const panel = document.querySelector(".overlay:not([hidden])");
  if (!panel) return;
  const options = [...panel.querySelectorAll("button, input")].filter((control) => !control.hidden && !control.disabled);
  if (!options.length) return;
  const index = options.indexOf(document.activeElement);
  options[index < 0 ? 0 : (index + delta + options.length) % options.length].focus({ preventScroll: true });
}

function pollPads() {
  const pads = readGamepads();
  if (padCount !== pads.length) {
    padCount = pads.length;
    $("padStatus").textContent = "패드 · " + padCount + "대";
  }
  padSides.fill(null);
  if (pads.length === 1) padSides[$("padForOne").checked ? 0 : 1] = pads[0];
  if (pads.length === 2) [padSides[0], padSides[1]] = pads;
  const connected = new Set(pads.map((pad) => pad.index));
  for (const index of padPrevious.keys()) if (!connected.has(index)) padPrevious.delete(index);
  for (const pad of pads) {
    const held = (button) => !!pad.buttons[button]?.pressed;
    const current = { a: held(0), b: held(1), pause: held(9),
      forward: held(13) || held(15) || pad.axes[0] > .66 || pad.axes[1] > .66,
      back: held(12) || held(14) || pad.axes[0] < -.66 || pad.axes[1] < -.66 };
    const previous = padPrevious.get(pad.index) || {};
    padPrevious.set(pad.index, current);
    if (current.pause && !previous.pause && ["playing", "pause"].includes(screen)) {
      togglePause();
      continue;
    }
    if (screen === "playing") continue;
    if (current.a && !previous.a) unlockAudio();
    if (current.forward && !previous.forward) menuNav(1);
    else if (current.back && !previous.back) menuNav(-1);
    if (current.a && !previous.a) {
      if (screen === "menu") openSelection();
      else if (document.activeElement?.closest(".overlay:not([hidden])")) document.activeElement.click();
    }
    if (current.b && !previous.b) {
      if (screen === "select") menu();
      else if (screen === "pause") togglePause();
    }
  }
}

function inputs(i) {
  const mapping = keySets[i];
  const pad = padSides[i];
  const held = (button) => !!pad?.buttons[button]?.pressed;
  const axis = (v) => Math.abs(v || 0) < .18 ? 0 : v;
  let x = +keys.has(mapping.right) - +keys.has(mapping.left);
  let y = +keys.has(mapping.down) - +keys.has(mapping.up);
  x += axis(pad?.axes[0]) + +held(15) - +held(14);
  y += axis(pad?.axes[1]) + +held(13) - +held(12);
  const length = Math.max(1, Math.hypot(x,y));
  return {
    x: x / length, y: y / length,
    attack: keys.has(mapping.attack) || held(2) || held(5),
    dodge: keys.has(mapping.dodge) || held(0),
  };
}

document.addEventListener("keydown", (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.code === "Escape" && !event.repeat) {
    if (screen === "select") menu();
    else togglePause();
  }
  if (!keyboardCodes.has(event.code) || screen !== "playing") return;
  event.preventDefault();
  keys.add(event.code);
  unlockAudio();
});
document.addEventListener("keyup", (event) => keys.delete(event.code));
window.addEventListener("blur", () => {
  keys.clear();
  if (screen === "playing") togglePause();
});
$("openSelect").onclick = () => { unlockAudio(); openSelection(); };
$("selectBack").onclick = menu;
$("startGame").onclick = () => start(null);
$("continueGame").onclick = () => { const save = readSave(); if (save) start(save); };
$("backToMenu").onclick = menu;
$("next").onclick = () => nextAction?.();
$("sound").onclick = () => {
  soundOn = !soundOn;
  $("sound").setAttribute("aria-pressed", soundOn);
  $("sound").textContent = soundOn ? "소리 켜짐" : "소리 꺼짐";
  if (soundOn) unlockAudio();
};
$("fullscreen").onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await $("stage").requestFullscreen();
  } catch {
    $("fullscreen").textContent = "전체 화면 사용 불가";
  }
};
document.addEventListener("fullscreenchange", () => {
  $("fullscreen").textContent = document.fullscreenElement ? "전체 화면 종료" : "전체 화면";
});

function particle(x, y, color, speed = 140) {
  const life = random(.22, .54);
  const angle = random(0, Math.PI * 2);
  effects.push({ x, y, color, size: random(3, 10), life, max: life, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed * .64 - 27 });
}

function burst(x, y, color, amount = 12, speed = 140) {
  for (let i = 0; i < amount; i++) particle(x, y, color, speed * random(.35, 1.22));
}

function ring(x, y, r, color, angle = 0, width = Math.PI) {
  effects.push({ x, y, r, color, angle, width, life: .3, max: .3, vx: 0, vy: 0 });
}

function floatText(x, y, text, color) {
  effects.push({ x, y, text, color, life: .68, max: .68, vx: random(-16,16), vy: -53 });
}

function spawnEnemy(kind) {
  const type = enemyTypes[kind];
  const gateway = Math.floor(random(0, round === 0 ? 2 : 4));
  const edges = [
    [bounds.left + 12, random(bounds.top + 35, bounds.bottom - 29)],
    [bounds.right - 12, random(bounds.top + 35, bounds.bottom - 29)],
    [random(bounds.left + 98, bounds.right - 98), bounds.top + 11],
    [random(bounds.left + 98, bounds.right - 98), bounds.bottom - 11],
  ];
  const [x, y] = kind === "boss" ? [720, bounds.top + 43] : edges[gateway];
  const hp = Math.round(type.hp * (1 + .24 * chapterIndex() + .087 * waveIndex()));
  enemies.push({
    ...type, kind, x, y, hp, max: hp, phase: random(0, 20), wind: 0, flash: 0,
    kx: 0, ky: 0, delay: 1.45, fresh: .52, lastBy: -1, lastHit: -10, combo: 0,
  });
  ring(x,y,type.r * 1.7, kind === "boss" ? "#ffe598" : "#c9ef91");
  if (kind === "boss") showNotice("왕관 슬라임 등장!", 2.35);
  burst(x,y - 7,"#d1dc99",8,66);
}

function hit(e, damage, player, p, chain = false) {
  if (e.hp <= 0) return false;
  const amount = Math.round(damage);
  e.hp = Math.max(0, e.hp - amount);
  e.flash = .115;
  if (!chain && (e.kind === "boss" || amount >= 40 || e.hp === 0)) {
    floatText(e.x + random(-12, 12), e.y - e.r * 1.44, String(amount), p.cast.color);
  }
  const angle = Math.atan2(e.y - p.y, e.x - p.x);
  const push = e.kind === "boss" ? 55 : (p.cast.kind === "hammer" ? 245 : 138);
  e.kx += Math.cos(angle) * push;
  e.ky += Math.sin(angle) * push * .58;
  burst(e.x, e.y - e.r * .64, chain ? "#e3b8ff" : p.cast.color, e.hp ? 5 : 15, e.hp ? 112 : 230);
  if (!chain && e.lastBy >= 0 && e.lastBy !== player && time - e.lastHit < .72 && e.combo <= time) {
    e.combo = time + 2.5;
    shake = Math.max(shake, 6);
    ring(e.x, e.y, 81, "#fff4d4");
    e.hp = Math.max(0, e.hp - Math.round(damage * .85));
    ring(e.x, e.y, 118 + upgrades.spark * 8, "#ffe39e");
    burst(e.x, e.y - 22, "#ffebad", 15, 255);
    floatText(e.x, e.y - e.r * 1.72, "협동!", "#ffe8a4");
    for (const other of enemies) {
      if (other !== e && distance(e, other) < 123 + upgrades.spark * 8 && other.hp > 0) {
        other.hp = Math.max(0, other.hp - Math.round(damage * .5));
        other.flash = .13;
      }
    }
    tone([240, 360, 630], "triangle", .052, .15);
  }
  if (!chain) {
    e.lastBy = player;
    e.lastHit = time;
  }
  return true;
}

function doChain(first, rawDamage, player, p) {
  if (upgrades.spark === 0) return;
  let source = first;
  const touched = new Set([first]);
  for (let i = 0; i < Math.min(7, upgrades.spark); i++) {
    const next = enemies.filter((e) => e.hp > 0 && !touched.has(e) && distance(source, e) < 158 + upgrades.spark * 10)
      .sort((a,b) => distance(source,a) - distance(source,b))[0];
    if (!next) break;
    const zap = [];
    for (let j = 0; j <= 8; j++) {
      const f = j / 8;
      const x = source.x + (next.x - source.x) * f;
      const y = source.y - 23 + (next.y - source.y) * f + (j % 2 ? random(-16, 16) : 0);
      zap.push([x, y]);
      particle(x, y, "#e8c7fd", 44);
    }
    effects.push({ x: next.x, y: next.y, zap, color: "#c481ef", life: .24, max: .24, vx: 0, vy: 0 });
    hit(next, rawDamage * (.43 + upgrades.spark * .055), player, p, true);
    touched.add(next);
    source = next;
  }
}

function attack(p, i) {
  const c = p.cast;
  const power = 1 + upgrades.power * .28;
  const range = c.range * (1 + Math.min(.85, upgrades.power * .11));
  const candidates = enemies.filter((e) => e.hp > 0 && distance(p, e) <= range + e.r * .65)
    .sort((a,b) => distance(p,a) - distance(p,b));
  const target = candidates[0];
  const angle = target ? Math.atan2((target.y-p.y) * 1.65, target.x-p.x) : Math.atan2(p.directionY * 1.45, p.directionX);
  p.face = Math.cos(angle) < 0 ? -1 : 1;
  p.cd = c.rate / (1 + Math.min(1.65, upgrades.speed * .2));
  p.anim = .24;
  let connected = false;

  if (c.kind === "wand") {
    if (target) {
      projectiles.push({ x: p.x + p.face * 21, y: p.y - 48, e: target, caster: p, player: i, damage: c.damage * power, life: .62 });
    } else {
      ring(p.x,p.y - 18,64,c.color,angle,.6);
    }
  } else {
    const width = c.kind === "hammer" ? 2.05 : c.kind === "shield" ? 1.85 : 1.05;
    const sweep = range * (c.kind === "glove" ? .86 : 1);
    effects.push({ x: p.x, y: p.y - 27, arc: sweep, color: c.color, angle, width, life: .31, max: .31, vx: 0, vy: 0 });
    ring(p.x, p.y - 7, sweep, c.color, angle, width);
    for (let n = 0; n < 6; n++) {
      const sparkAngle = angle + random(-width, width);
      const offset = sweep * random(.46, .86);
      particle(p.x + Math.cos(sparkAngle) * offset, p.y - 26 + Math.sin(sparkAngle) * offset * .66, c.color, 120);
    }
    const hits = c.kind === "glove" ? candidates.slice(0, 2 + Math.floor(upgrades.power / 2)) : candidates;
    for (const e of hits) {
      connected = hit(e, c.damage * power, i, p) || connected;
    }
    if (target) doChain(target, c.damage * power, i, p);
    if (c.kind === "shield") {
      p.invulnerable = Math.max(p.invulnerable, .32);
      const ally = players[1 - i];
      if (distance(p, ally) < 158 && !ally.down) {
        ally.invulnerable = Math.max(ally.invulnerable, .22);
        if (connected) ring(ally.x, ally.y - 16, 61, c.color);
      }
    }
  }

  if (connected) {
    shake = Math.min(7, 2 + upgrades.power * .48);
    freeze = c.kind === "glove" ? .018 : .032;
    tone(c.kind === "hammer" ? [163, 107] : [207], "triangle", .055, .16);
  } else {
    tone(c.kind === "wand" ? [430, 670] : [270], "sine", .024, .09);
  }
}

function advanceProjectiles(dt) {
  for (const bolt of projectiles) {
    const tx = bolt.e.x;
    const ty = bolt.e.y - bolt.e.r * .68;
    const len = Math.hypot(tx - bolt.x, ty - bolt.y);
    bolt.life -= dt;
    if (len < 1200 * dt + 10) {
      if (hit(bolt.e, bolt.damage, bolt.player, bolt.caster)) {
        doChain(bolt.e, bolt.damage, bolt.player, bolt.caster);
        shake = Math.max(shake, 2.1);
        tone([520, 290], "triangle", .057, .105);
      }
      bolt.life = 0;
      continue;
    }
    bolt.x += (tx - bolt.x) / len * 1200 * dt;
    bolt.y += (ty - bolt.y) / len * 1200 * dt;
    particle(bolt.x,bolt.y,"#befae3",29);
  }
  projectiles = projectiles.filter((bolt) => bolt.life > 0);
}

function damagePlayer(p, amount, e) {
  if (p.invulnerable > 0 || p.down || p.dash > 0) return;
  const index = players.indexOf(p);
  const ally = players[1 - index];
  let damage = amount * (p.cast.kind === "shield" ? .63 : 1);
  if (!ally.down && ally.cast.kind === "shield" && distance(p, ally) < 152) {
    damage *= .72;
    ring(p.x, p.y - 17, 45, ally.cast.color);
  }
  p.hp = Math.max(0, p.hp - Math.round(damage));
  p.invulnerable = 1.05;
  const a = Math.atan2(p.y - e.y, p.x - e.x);
  p.vx += Math.cos(a) * 190;
  p.vy += Math.sin(a) * 135;
  if (!p.hp) p.down = true;
  floatText(p.x, p.y - 95, "−" + Math.round(damage), "#ffbea2");
  burst(p.x,p.y - 40,"#ffc09f",9);
  tone([125], "triangle", .07, .18);
}

function advancePlayer(p, i, dt) {
  const control = inputs(i);
  p.cd -= dt;
  p.dash -= dt;
  p.invulnerable -= dt;
  p.dodgeDelay -= dt;
  p.anim = Math.max(0, p.anim - dt);
  if (p.down) {
    const partner = players[1 - i];
    if (!partner.down && distance(p, partner) < 111) {
      p.revive += dt;
      if (p.revive >= 1.12) {
        p.hp = Math.round(p.cast.hp * .58);
        p.down = false;
        p.invulnerable = 2;
        p.revive = 0;
        ring(p.x, p.y - 14, 96, "#c1f29e");
        showNotice(p.cast.name + " 구조 완료!", 1.6);
        tone([380, 570, 900], "sine", .04, .2);
      }
    } else p.revive = Math.max(0, p.revive - dt * .85);
    return;
  }
  if (Math.hypot(control.x,control.y) > .07 && p.dash <= 0) {
    p.directionX = control.x;
    p.directionY = control.y;
    if (Math.abs(control.x) > .09) p.face = Math.sign(control.x);
  }
  if (control.dodge && !p.dodgeHeld && p.dodgeDelay <= 0) {
    p.dash = .23;
    p.dodgeDelay = .62;
    p.invulnerable = Math.max(p.invulnerable, .31);
    ring(p.x, p.y, 47, p.cast.color);
    tone([285, 445], "sine", .032, .1);
  }
  p.dodgeHeld = control.dodge;
  const speed = p.cast.speed * (1 + Math.min(.5, upgrades.speed * .05));
  const tx = p.dash > 0 ? p.directionX * 645 : control.x * speed;
  const ty = p.dash > 0 ? p.directionY * 457 : control.y * speed * .71;
  const ease = 1 - Math.exp(-dt * (p.dash > 0 ? 21 : 14));
  p.vx += (tx - p.vx) * ease;
  p.vy += (ty - p.vy) * ease;
  p.x = clamp(p.x + p.vx * dt, bounds.left, bounds.right);
  p.y = clamp(p.y + p.vy * dt, bounds.top, bounds.bottom);
  p.moving = Math.hypot(p.vx, p.vy) > 36;
  if (p.dash > 0 && dashTrail < dt) particle(p.x, p.y - 12, p.cast.color, 70);
  if (control.attack && p.cd <= 0 && p.dash < .12) attack(p, i);
}

function updateEnemy(e, dt) {
  e.flash -= dt;
  e.fresh -= dt;
  e.delay -= dt;
  const closest = players.filter((p) => !p.down).sort((a,b) => distance(a,e) - distance(b,e))[0];
  if (!closest || e.fresh > 0) return;
  const range = distance(e,closest);
  if (e.wind > 0) {
    e.wind -= dt;
    if (e.wind <= 0) {
      e.wind = 0;
      const color = e.kind === "boss" ? "#dc9cdd" : "#ffa76c";
      ring(e.x,e.y,e.radius,color);
      for (const p of players) if (distance(p,e) < e.radius) damagePlayer(p,e.damage,e);
      e.delay = e.kind === "boss" ? 1.46 : random(1.1, 1.7);
      if (e.kind === "boss") shake = 5;
    }
  } else if (range < e.radius * .84 && e.delay <= 0) e.wind = e.warn;
  else if (range > e.radius * .65) {
    const speed = e.speed * (1 + .049 * chapterIndex());
    e.x += (closest.x - e.x) / range * speed * dt;
    e.y += (closest.y - e.y) / range * speed * dt;
  }
  e.x = clamp(e.x + e.kx * dt, bounds.left - 4, bounds.right + 4);
  e.y = clamp(e.y + e.ky * dt, bounds.top, bounds.bottom);
  e.kx *= Math.exp(-dt * 9.5);
  e.ky *= Math.exp(-dt * 9.5);
}

function collect(item, display = true) {
  if (item.kind === "heal") {
    for (const p of players) if (!p.down) p.hp = Math.min(p.cast.hp, p.hp + 34);
    if (display) showNotice("별사탕 · 두 배달원 체력 +34", 1.8);
  } else {
    upgrades[item.kind]++;
    if (display) showNotice(upgradeNames[item.kind] + " +" + upgrades[item.kind] + " · " + upgradeEffects[item.kind], 2.5);
  }
  if (display) {
    ring(item.x, item.y - 9, 102, "#ffe59b");
    burst(item.x, item.y-16, "#ffe9a2", 19, 241);
    tone([523, 659, 784, 1047], "sine", .042, .19);
  }
}

function awardRound() {
  const guaranteed = upgradeKeys[round % upgradeKeys.length];
  for (const item of items) if (item.kind === "heal") collect(item, false);
  items = [];
  collect({ kind: guaranteed, x: 720, y: 645 }, false);
  updateHud();
  const upgrade = upgradeNames[guaranteed] + " +" + upgrades[guaranteed] + " · " + upgradeEffects[guaranteed];
  tone([440, 550, 659, 880], "sine", .055, .34);
  const nextRound = round + 1;
  saveProgress(nextRound);
  if (nextRound >= totalWaves) {
    showBreak("win", "24 / 24 라운드", "배달 완료!", "스물네 번의 소동을 지나 마지막 소포까지 전했어요.\n" + upgrade, "다시 배달하기", openSelection);
    return;
  }
  const chapterComplete = waveIndex() === wavesPerChapter - 1;
  const title = chapterComplete ? chapters[chapterIndex()] + " 배달 완료!" : "라운드 클리어!";
  const nextLabel = chapterComplete ? "다음 챕터" : "다음 라운드";
  showBreak("rest", nextRound + " / " + totalWaves + " 라운드", title, upgrade + "\n여기까지 자동으로 저장되었어요.", nextLabel, () => {
    round = nextRound;
    startRound();
  });
}

function update(dt) {
  noticeTime -= dt;
  if (noticeTime <= 0) $("notice").hidden = true;
  dashTrail -= dt;
  if (dashTrail < 0) dashTrail += .075;
  players.forEach((p,i) => advancePlayer(p,i,dt));
  advanceProjectiles(dt);
  activeTime += dt;
  if (spawn.length && activeTime >= supplyAt) {
    const corners = [{ x: 306, y: 318 }, { x: 1135, y: 633 }, { x: 307, y: 632 }, { x: 1134, y: 320 }];
    const point = corners[(round + Math.floor(supplyAt)) % corners.length];
    const kind = upgradeKeys[(round + 1) % upgradeKeys.length];
    items.push({ ...point, kind });
    ring(point.x, point.y, 96, "#ffe6a0");
    burst(point.x, point.y - 16, "#ffdea0", 19, 175);
    showNotice("광장 가장자리에 장비가 도착했어요!", 2.2);
    supplyAt = Infinity;
  }
  spawnWait -= dt;
  if (spawn.length && spawnWait <= 0 && enemies.length < 7 + Math.floor(chapterIndex() * .8)) {
    spawnEnemy(spawn.shift());
    spawnWait = activeTime < 6 ? 1.4 : 2.36 - chapterIndex() * .085;
  }
  for (const e of enemies) if (e.hp > 0) updateEnemy(e,dt);
  enemies = enemies.filter((e) => {
    if (e.hp > 0) return true;
    if (e.kind === "boss" || Math.random() < .23) {
      const kind = e.kind !== "boss" && Math.random() < .58 ? "heal" : upgradeKeys[Math.floor(random(0,3))];
      items.push({ kind, x: e.x, y: e.y });
    }
    return false;
  });
  for (const item of items) {
    const nearby = players.find((p) => !p.down && distance(item, p) < 69);
    if (nearby) {
      collect(item);
      item.picked = true;
    }
  }
  items = items.filter((item) => !item.picked);
  if (players.every((p) => p.down)) {
    showBreak("retry", "달빛 특송", "다시 도전해 볼까요?", "이번 라운드 시작 지점에서 다시 만나요.", "라운드 재도전", () => {
      const saved = readSave();
      if (saved?.round === round) upgrades = { ...saved.upgrades };
      else upgrades = { ...roundStartUpgrades };
      startRound();
    });
  } else if (!enemies.length && !spawn.length) {
    clearedTime += dt;
    if (clearedTime > 1.25) awardRound();
  }
  hudTime -= dt;
  if (hudTime <= 0) {
    updateHud();
    hudTime = .14;
  }
}


function draw() {
  const isTitle = screen === "menu" || screen === "select";
  Art.background(ctx, time, isTitle ? 0 : chapterIndex(), isTitle);
  if (isTitle) {
    const positions = [[402,659,1],[1029,660,-1],[517,720,1],[916,722,-1]];
    positions.forEach(([x,y,face], i) => Art.hero(ctx,{ cast: CAST[i], x, y, face, phase: i * 1.57 },time,1.34));
    Art.enemy(ctx,{ kind: "blob", x: 670, y: 720, r: 25, phase: 7, hp: 1, max: 1 },time);
    Art.enemy(ctx,{ kind: "dash", x: 771, y: 711, r: 22, phase: 3, hp: 1, max: 1 },time);
    return;
  }
  ctx.save();
  if (shake > .3) ctx.translate(random(-shake,shake), random(-shake,shake) * .55);
  for (const item of items) Art.item(ctx, item, time);
  const actors = players.map((p) => ({ y: p.y, draw: () => {
    if (p.invulnerable > .1 && !p.down && Math.sin(time * 34) > .55) ctx.globalAlpha = .69;
    Art.hero(ctx, p, time);
    ctx.globalAlpha = 1;
    if (p.down) {
      ctx.fillStyle = "#2a2027";
      ctx.fillRect(p.x - 35, p.y - 84, 70, 6);
      ctx.fillStyle = "#d6f69d";
      ctx.fillRect(p.x - 35, p.y - 84, 70 * p.revive / 1.12, 6);
    }
  } }));
  for (const e of enemies) actors.push({ y: e.y, draw: () => Art.enemy(ctx,e,time) });
  actors.sort((a,b) => a.y - b.y).forEach((actor) => actor.draw());
  for (const bolt of projectiles) {
    Art.oval(ctx,bolt.x,bolt.y,16,16,"#c4fbe940");
    Art.star(ctx,bolt.x,bolt.y,11,"#e7fff0","#7cbdad");
  }
  for (const effect of effects) Art.effect(ctx, effect);
  ctx.restore();
}

function frame(ms) {
  const dt = Math.min(.034, (ms - (lastFrame || ms)) / 1000);
  lastFrame = ms;
  time += dt;
  pollPads();
  if (screen === "playing") {
    freeze -= dt;
    update(dt * (freeze > 0 ? .18 : 1));
    shake *= Math.exp(-dt * 12);
    for (const e of effects) {
      e.life -= dt;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
    }
    effects = effects.filter((e) => e.life > 0);
  }
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
