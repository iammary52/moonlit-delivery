"use strict";

const CAST = [
  { name: "보리", role: "망치 · 넓은 휩쓸기", color: "#ffb468", dark: "#a84738", kind: "hammer", speed: 258, range: 155, rate: .54, damage: 28, hp: 120 },
  { name: "루미", role: "별지팡이 · 원거리", color: "#8beddb", dark: "#36788a", kind: "wand", speed: 285, range: 425, rate: .44, damage: 21, hp: 100 },
  { name: "토토", role: "도토리 장갑 · 속공", color: "#ffc1d2", dark: "#96446b", kind: "glove", speed: 344, range: 118, rate: .28, damage: 15, hp: 105 },
  { name: "밤비", role: "잎 방패 · 반격과 보호", color: "#d6ed84", dark: "#526838", kind: "shield", speed: 249, range: 136, rate: .62, damage: 26, hp: 155 },
];

const Art = (() => {
  const TAU = Math.PI * 2;
  const ink = "#392a2b";
  const boards = new Map();
  const lights = Array.from({ length: 45 }, (_, i) => ({
    x: (i * 237.386) % 1490, y: 140 + (i * 142.789) % 650, phase: i * 1.893,
    radius: 1 + (i * 1.561) % 3.4,
  }));

  function oval(ctx, x, y, rx, ry, color, outline, angle = 0) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, angle, 0, TAU);
    ctx.fillStyle = color;
    ctx.fill();
    if (outline) {
      ctx.lineWidth = 2.7;
      ctx.strokeStyle = outline;
      ctx.stroke();
    }
  }

  function shape(ctx, trace, color, outline, width = 3) {
    ctx.beginPath();
    trace();
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    if (outline) {
      ctx.lineWidth = width;
      ctx.strokeStyle = outline;
      ctx.stroke();
    }
  }

  function line(ctx, x1, y1, x2, y2, color, width) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.stroke();
  }

  function gradient(ctx, y, y2, top, bottom) {
    const fill = ctx.createLinearGradient(0, y, 0, y2);
    fill.addColorStop(0, top);
    fill.addColorStop(1, bottom);
    return fill;
  }

  function star(ctx, x, y, r, color, outline, points = 4) {
    shape(ctx, () => {
      for (let i = 0; i < points * 2; i++) {
        const angle = i * Math.PI / points - Math.PI / 2;
        const size = i % 2 ? r * .38 : r;
        ctx.lineTo(x + Math.cos(angle) * size, y + Math.sin(angle) * size);
      }
    }, color, outline, 2);
  }

  function background(ctx, time, chapter, menu) {
    function getBoard(index) {
      if (!boards.has(index)) {
        const asset = new Image();
        asset.src = "assets/board-" + (index + 1) + ".jpg";
        boards.set(index, asset);
      }
      return boards.get(index);
    }
    const wanted = getBoard(chapter);
    if (chapter < 5) getBoard(chapter + 1);
    const board = wanted.complete && wanted.naturalWidth ? wanted : getBoard(0);
    if (board.complete && board.naturalWidth) {
      ctx.drawImage(board, 0, 0, 1440, 810);
    } else {
      ctx.fillStyle = gradient(ctx, 0, 810, "#334f58", "#ba875c");
      ctx.fillRect(0, 0, 1440, 810);
      oval(ctx, 324, 171, 53, 53, "#ffe3a4");
      for (let i = 0; i < 7; i++) {
        oval(ctx, 38 + i * 260, 486 + i % 3 * 19, 340, 128, i % 2 ? "#4c6248" : "#56715b");
      }
      ctx.fillStyle = gradient(ctx, 520, 810, "#978563", "#605f45");
      ctx.fillRect(0, 536, 1440, 274);
    }
    const edge = ctx.createRadialGradient(720, 405, 230, 720, 445, 860);
    edge.addColorStop(0, menu ? "#231a1454" : "#17151200");
    edge.addColorStop(1, menu ? "#151d15b8" : "#151d1564");
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, 1440, 810);
    for (const light of lights) {
      const pulse = .5 + .5 * Math.sin(time * 1.4 + light.phase);
      ctx.globalAlpha = .2 + .65 * pulse;
      const x = (light.x + time * (4 + light.radius)) % 1490;
      const y = light.y + 17 * Math.sin(time * .58 + light.phase);
      oval(ctx, x, y, light.radius * 3, light.radius * 2.5, "#ffd98220");
      oval(ctx, x, y, light.radius, light.radius * .79, "#ffe5a4");
    }
    ctx.globalAlpha = 1;
    if (menu) {
      const shade = ctx.createRadialGradient(720, 320, 84, 720, 360, 523);
      shade.addColorStop(0, "#34291e96");
      shade.addColorStop(1, "#34291e00");
      ctx.fillStyle = shade;
      ctx.fillRect(0, 0, 1440, 810);
    }
  }

  function prop(ctx, kind, color, dark) {
    if (kind === "hammer") {
      line(ctx, -1, 7, 15, -25, ink, 8);
      line(ctx, -1, 7, 15, -25, "#b48357", 4);
      ctx.save();
      ctx.translate(15, -27);
      ctx.rotate(.37);
      shape(ctx, () => { ctx.roundRect(-17, -9, 34, 18, 5); }, gradient(ctx, -9, 9, "#ffe09e", "#ba6f42"), ink);
      line(ctx, -10, -8, -10, 8, "#bf713d", 2);
      line(ctx, 10, -8, 10, 8, "#bf713d", 2);
      ctx.restore();
    } else if (kind === "wand") {
      line(ctx, 0, 8, 12, -24, ink, 6);
      line(ctx, 0, 8, 12, -24, "#bd8b58", 3);
      star(ctx, 13, -26, 13, "#fff0a4", "#5c5540", 5);
      oval(ctx, 12, -26, 3, 3, "#fffdf0");
    } else if (kind === "glove") {
      oval(ctx, 5, -2, 12, 10, gradient(ctx, -12, 8, color, dark), ink, -.4);
      oval(ctx, 11, -5, 6, 5, color, ink);
      line(ctx, 1, -8, 4, -4, "#fff0c587", 2);
    } else {
      shape(ctx, () => {
        ctx.moveTo(-7, -7);
        ctx.quadraticCurveTo(-1, -19, 20, -23);
        ctx.quadraticCurveTo(25, -1, 5, 13);
        ctx.quadraticCurveTo(-4, 10, -7, -7);
      }, gradient(ctx, -23, 13, color, dark), ink);
      line(ctx, 0, 8, 16, -16, "#e9eda2", 2);
      line(ctx, 7, -2, 0, -8, "#e9eda2", 1.6);
      line(ctx, 8, -4, 17, -4, "#e9eda2", 1.6);
    }
  }

  function hero(ctx, p, time, scale = 1) {
    const c = p.cast;
    const gait = p.moving ? Math.sin(time * (c.kind === "glove" ? 20 : 16) + (p.phase || 0)) : 0;
    const bob = p.moving ? -Math.abs(gait) * 5 : Math.sin(time * 4 + (p.phase || 0)) * 1.75;
    const strike = p.anim > 0 ? Math.sin(Math.min(1, p.anim / .24) * Math.PI) : 0;
    const blink = Math.sin(time * 1.91 + (p.phase || 0)) > .993;
    const facing = p.face || 1;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(scale, scale);
    oval(ctx, 0, 0, 36, 9, "#271f1760");
    if (p.down) {
      ctx.rotate(facing * .63);
      ctx.globalAlpha *= .74;
    }
    ctx.scale(facing, 1);
    ctx.translate(0, bob - (p.dash > 0 ? 7 : 0));
    ctx.rotate(gait * .038 + strike * .13);
    const cloth = gradient(ctx, -82, -19, c.color, c.dark);
    const scarf = c.kind === "wand" ? "#fed785" : "#f1bb62";
    const sway = Math.sin(time * 6) * 4 + gait * 6;
    shape(ctx, () => {
      ctx.moveTo(-11, -48);
      ctx.bezierCurveTo(-34, -44, -36, -35 + sway, -59, -43 + sway);
      ctx.lineTo(-56, -34 + sway);
      ctx.lineTo(-63, -28 + sway);
      ctx.quadraticCurveTo(-35, -21 + sway, -11, -39);
    }, scarf, ink);
    for (const direction of [-1, 1]) {
      const swing = gait * 10 * direction;
      oval(ctx, direction * 11 + swing, -6 - Math.max(0, swing * .37), 10, 7, "#513a32", ink, swing * .024);
      oval(ctx, direction * 11 + swing + 3, -7 - Math.max(0, swing * .37), 5, 2, "#ac7858");
    }
    oval(ctx, -21 - gait * 3, -26, 11, 16, "#956845", ink, -.22);
    shape(ctx, () => {
      ctx.moveTo(-13, -48);
      ctx.bezierCurveTo(-23, -37, -23, -20, -16, -12);
      ctx.quadraticCurveTo(0, -6, 18, -12);
      ctx.bezierCurveTo(25, -26, 19, -41, 11, -47);
    }, cloth, ink);
    line(ctx, -19, -15, 18, -15, "#503937", 4);
    oval(ctx, 5, -17, 4, 4, "#fedb8e", ink);
    if (c.kind === "glove" || c.kind === "shield") {
      oval(ctx, -19, -80, 10, c.kind === "glove" ? 19 : 12, cloth, ink, -.35);
      oval(ctx, 11, -82, 9, c.kind === "glove" ? 17 : 11, cloth, ink, .32);
      oval(ctx, -19, -82, 4, 10, "#f7cc9c96", null, -.35);
    }
    oval(ctx, 0, -65, 28, 26, cloth, ink, -.11);
    oval(ctx, 5, -62, 21, 17, gradient(ctx, -78, -43, "#fff0c4", "#ebad7f"), "#704a42", -.10);
    shape(ctx, () => {
      ctx.moveTo(-17, -65);
      ctx.quadraticCurveTo(-17, -86, 7, -89);
      ctx.quadraticCurveTo(19, -83, 26, -69);
      ctx.quadraticCurveTo(15, -73, 7, -76);
      ctx.quadraticCurveTo(-4, -69, -17, -65);
    }, c.color, ink, 2.5);
    if (c.kind === "wand") star(ctx, -19, -78, 7, "#fff1af", "#645449");
    else oval(ctx, -18, -78, 4, 4, scarf, ink);
    for (const x of [1, 16]) {
      oval(ctx, x, -62, 2.45, blink ? 1 : 4, "#38292e");
      if (!blink) oval(ctx, x+.7, -63.6, .8, 1.1, "#fffae0");
    }
    oval(ctx, -3, -56, 4, 2.15, "#e28673");
    oval(ctx, 20, -56, 3, 1.9, "#e28673");
    ctx.beginPath();
    ctx.moveTo(7, -55);
    ctx.quadraticCurveTo(10, -51, 13, -55);
    ctx.strokeStyle = "#834b46";
    ctx.lineWidth = 1.6;
    ctx.stroke();
    oval(ctx, 0, -44, 20, 5, scarf, ink, -.03);
    ctx.save();
    ctx.translate(21 + strike * 7, -26 + gait * 2 - strike * 7);
    ctx.rotate(strike * 1.05 - .19);
    oval(ctx, -4, 1, 9, 9, cloth, ink);
    prop(ctx, c.kind, c.color, c.dark);
    ctx.restore();
    ctx.restore();
    if (p.label) {
      ctx.save();
      ctx.textAlign = "center";
      ctx.font = "800 16px system-ui";
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#293021";
      ctx.strokeText(p.label, p.x, p.y - 105);
      ctx.fillStyle = c.color;
      ctx.fillText(p.label, p.x, p.y - 105);
      ctx.restore();
    }
  }

  function enemy(ctx, e, time) {
    const r = e.r;
    const gait = Math.sin(time * 8 + e.phase);
    const wobble = !e.wind ? gait * .065 : -.12;
    const palettes = {
      blob: ["#d6ef79", "#629653", "#3a5340"],
      dash: ["#ffd49f", "#cc7757", "#633f3b"],
      shell: ["#aedde3", "#538aa0", "#364b58"],
      boss: ["#ebc7e8", "#9a589c", "#513650"],
    };
    const [light, dark, border] = palettes[e.kind];
    ctx.save();
    ctx.translate(e.x, e.y);
    oval(ctx, 0, 0, r * 1.14, r * .29, "#221c1766");
    if (e.wind) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#ffd28b";
      ctx.beginPath();
      ctx.ellipse(0, 0, e.radius, e.radius * .54, 0, 0, TAU);
      ctx.stroke();
      oval(ctx, 0, 0, e.radius, e.radius * .54, "#ffb44b35");
    }
    ctx.scale(1 - wobble, 1 + wobble);
    shape(ctx, () => {
      ctx.moveTo(-r, -r * .38);
      ctx.bezierCurveTo(-r * 1.12, -r * 1.13, -r * .5, -r * 1.26, -r * .13, -r * 1.48);
      ctx.quadraticCurveTo(r * .28, -r * 1.73, r * .66, -r * 1.25);
      ctx.bezierCurveTo(r * 1.18, -r * .87, r * 1.37, -r * .02, r * .46, r * .05);
      ctx.quadraticCurveTo(-r * .89, r * .19, -r, -r * .38);
    }, e.flash > 0 ? "#fff4c3" : gradient(ctx, -r * 1.5, r * .15, light, dark), border, 3.4);
    oval(ctx, -r * .45, -r * 1.12, r * .22, r * .08, "#fff5c992", null, -.46);
    for (const x of [-.33, .37]) {
      oval(ctx, x*r, -.71*r, .097*r, .154*r, "#302933");
      oval(ctx, (x+.025)*r, -.77*r, .034*r, .04*r, "#fff5df");
    }
    oval(ctx, .018*r, -.46*r, .12*r, .064*r, border);
    if (e.kind === "shell") {
      oval(ctx, -.65*r, -.52*r, .39*r, .54*r, "#90c4ce", border, -.35);
      oval(ctx, .74*r, -.44*r, .30*r, .49*r, "#76aebb", border, .44);
    }
    if (e.kind === "boss") {
      shape(ctx, () => {
        ctx.moveTo(-r*.5,-r*1.35);
        ctx.lineTo(-r*.64,-r*2);
        ctx.lineTo(-r*.25,-r*1.79);
        ctx.lineTo(0,-r*2.22);
        ctx.lineTo(r*.25,-r*1.81);
        ctx.lineTo(r*.62,-r*1.97);
        ctx.lineTo(r*.49,-r*1.35);
      }, gradient(ctx,-r*2.2,-r*1.4,"#ffed9b","#cb874f"), border);
      star(ctx, 0, -r*1.66, r*.14, "#fff2af");
    }
    if (e.hp < e.max) {
      ctx.fillStyle = "#2b2529ae";
      ctx.fillRect(-r * .68, -r * 1.66 - (e.kind === "boss" ? 34 : 0), r * 1.36, 4.5);
      ctx.fillStyle = "#ffe599";
      ctx.fillRect(-r * .68, -r * 1.66 - (e.kind === "boss" ? 34 : 0), r * 1.36 * e.hp / e.max, 4.5);
    }
    ctx.restore();
  }

  function item(ctx, item, time) {
    const y = item.y - 16 + Math.sin(time * 5 + item.x) * 4;
    const colors = { power: "#ffbd73", speed: "#9ee4f3", spark: "#e5b7fe", heal: "#a9ef9a" };
    const color = colors[item.kind];
    oval(ctx, item.x, item.y + 3, 20, 7, "#211b1260");
    oval(ctx, item.x, y, 25, 25, color + "22");
    oval(ctx, item.x, y, 16, 16, "#322839", color);
    if (item.kind === "heal") {
      line(ctx, item.x - 7, y, item.x + 7, y, color, 4);
      line(ctx, item.x, y - 7, item.x, y + 7, color, 4);
    } else {
      star(ctx, item.x, y, 11, color, null, item.kind === "speed" ? 3 : 4);
    }
  }

  function effect(ctx, f) {
    const age = f.life / f.max;
    ctx.save();
    ctx.globalAlpha = Math.max(0, age);
    if (f.zap) {
      ctx.globalCompositeOperation = "screen";
      for (const [color, width] of [[f.color, 15], ["#fff4ff", 3]]) {
        ctx.strokeStyle = color;
        ctx.lineWidth = width * age;
        ctx.beginPath();
        for (const [x, y] of f.zap) ctx.lineTo(x, y);
        ctx.stroke();
      }
    } else if (f.arc) {
      const phase = 1 - age;
      ctx.translate(f.x, f.y);
      ctx.scale(1, .76);
      ctx.rotate(f.angle);
      const flare = ctx.createRadialGradient(0, 0, f.arc * .38, 0, 0, f.arc);
      flare.addColorStop(0, f.color + "00");
      flare.addColorStop(.8, f.color + "49");
      flare.addColorStop(.96, f.color + "bd");
      flare.addColorStop(1, "#fff5c7cf");
      ctx.globalCompositeOperation = "screen";
      const radius = f.arc * (.72 + phase * .27);
      const start = -f.width + phase * .27;
      const finish = f.width * (.6 + phase * .4);
      ctx.beginPath();
      ctx.arc(0, 0, radius, start, finish);
      ctx.ellipse(0, 0, radius*.75, radius*.78, 0, finish, start, true);
      ctx.closePath();
      ctx.fillStyle = flare;
      ctx.fill();
      ctx.strokeStyle = "#fff0c9";
      ctx.lineWidth = 2.8 * age;
      ctx.stroke();
    } else if (f.r !== undefined) {
      ctx.translate(f.x, f.y);
      ctx.scale(1, .54);
      ctx.beginPath();
      ctx.arc(0, 0, f.r * (.49 + .51 * (1 - age)), f.angle - f.width, f.angle + f.width);
      ctx.strokeStyle = f.color;
      ctx.lineWidth = Math.max(2, 16 * age);
      ctx.stroke();
      ctx.strokeStyle = "#fff3bf";
      ctx.lineWidth = Math.max(1.4, 5 * age);
      ctx.stroke();
    } else if (f.text) {
      ctx.textAlign = "center";
      ctx.font = "900 22px system-ui";
      ctx.strokeStyle = "#33262d";
      ctx.lineWidth = 4;
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    } else {
      if (f.size > 6) {
        ctx.globalCompositeOperation = "screen";
        line(ctx, f.x, f.y, f.x - f.vx * .064, f.y - f.vy * .064, f.color + "8e", Math.max(1.4, age * 3.8));
      }
      star(ctx, f.x, f.y, f.size * (.40 + .60 * age), f.color);
    }
    ctx.restore();
  }

  return { background, hero, enemy, item, effect, star, oval };
})();
