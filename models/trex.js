/**
 * trex.js — 霸王龙敌人模型 + AI（v8.4 新增，v8.6 外观重做，v11.1 真实恐龙重做）
 * 注册: window.MODELS.trex
 *
 * v11.1 造型：参考写实霸王龙图——棕灰鳞皮 + 巨大张口颅骨(上下颌+两排利齿+暗红口腔) +
 *   琥珀前视眼+眉骨 + 短小双爪前肢 + 粗壮弯曲后腿(三趾爪) + 长渐细水平尾 + 背脊低鳞甲。
 * 行为（update 每帧调用）不变：吃蘑菇 / 追玩家 / 喷火扇形 / 踩踏 AOE / 冲撞 / 60 秒自爆。
 */
(function (global) {
  global.MODELS = global.MODELS || {};
  const T = global.THREE;
  const R = global.ROUND;

  function sq(a) { return a * a; }
  function sqDist(ax, az, bx, bz) { return sq(ax - bx) + sq(az - bz); }

  global.MODELS.trex = {
    name: 'trex',

    create: function (config) {
      const cfg = config || {};
      const g = new T.Group();

      function rb(p, mat, w, h, d, r, x, y, z, rx, ry, rz) { var m = new T.Mesh(R.roundedBox(w, h, d, r), mat); m.position.set(x, y, z); if (rx || ry || rz) m.rotation.set(rx || 0, ry || 0, rz || 0); p.add(m); return m; }
      function capY(p, mat, radius, len, x, y, z, rx, ry, rz) { var m = new T.Mesh(R.roundedCyl(radius, radius, len, 12), mat); m.position.set(x, y, z); if (rx || ry || rz) m.rotation.set(rx || 0, ry || 0, rz || 0); p.add(m); return m; }
      function sph(p, mat, r, x, y, z, sx, sy, sz) { var m = new T.Mesh(new T.SphereGeometry(r, 18, 14), mat); m.position.set(x, y, z); if (sx !== undefined) m.scale.set(sx, sy, sz); p.add(m); return m; }
      function cone(p, mat, r, h, x, y, z, rx, ry, rz) { var m = new T.Mesh(new T.ConeGeometry(r, h, 6), mat); m.position.set(x, y, z); if (rx || ry || rz) m.rotation.set(rx || 0, ry || 0, rz || 0); p.add(m); return m; }

      const skin = new T.MeshStandardMaterial({ color: 0x6f5a40, roughness: 0.82, metalness: 0.05 });
      const skinDark = new T.MeshStandardMaterial({ color: 0x4a3a28, roughness: 0.85 });
      const belly = new T.MeshStandardMaterial({ color: 0x8a7458, roughness: 0.8 });
      const mouthMat = new T.MeshStandardMaterial({ color: 0x4a1616, roughness: 0.6 });
      const toothMat = new T.MeshStandardMaterial({ color: 0xe9e1cb, roughness: 0.5 });
      const clawMat = new T.MeshStandardMaterial({ color: 0x241a12, roughness: 0.5 });
      const eyeMat = new T.MeshStandardMaterial({ color: 0xc88a2a, emissive: 0x3a2200, emissiveIntensity: 0.5, roughness: 0.3 });
      const pupilMat = new T.MeshBasicMaterial({ color: 0x0a0603 });

      // 躯干（前倾、胸厚尾根粗）
      sph(g, skin, 0.82, 0, 1.42, -0.15, 0.95, 1.05, 1.5);
      sph(g, skin, 0.66, 0, 1.5, -0.85, 1.0, 1.0, 0.9);
      sph(g, belly, 0.6, 0, 1.05, 0.1, 0.9, 0.6, 1.3);
      sph(g, skinDark, 0.5, 0, 1.35, 0.75, 0.95, 0.85, 0.9);
      capY(g, skin, 0.3, 0.6, 0, 1.78, -1.0, -0.6, 0, 0);   // 颈

      // 头：巨大颅骨 + 前突上颌 + 下颚（张口）+ 口腔 + 利齿 + 前视眼 + 眉骨 + 鼻孔
      rb(g, skin, 0.62, 0.62, 0.95, 0.18, 0, 2.02, -1.55, 0.1, 0, 0);
      rb(g, skin, 0.5, 0.44, 0.78, 0.14, 0, 1.86, -2.2, 0.12, 0, 0);
      rb(g, skinDark, 0.46, 0.24, 0.72, 0.1, 0, 1.58, -2.12, -0.42, 0, 0);
      rb(g, mouthMat, 0.4, 0.16, 0.66, 0.06, 0, 1.72, -2.1, 0.05, 0, 0);
      for (let i = 0; i < 8; i++) {
        const z = -1.9 - i * 0.075;
        cone(g, toothMat, 0.035, 0.16, -0.19, 1.66, z, Math.PI, 0, 0);
        cone(g, toothMat, 0.035, 0.16, 0.19, 1.66, z, Math.PI, 0, 0);
      }
      for (let i = 0; i < 6; i++) {
        const z = -1.86 - i * 0.09;
        cone(g, toothMat, 0.03, 0.13, -0.16, 1.6, z, 0, 0, 0);
        cone(g, toothMat, 0.03, 0.13, 0.16, 1.6, z, 0, 0, 0);
      }
      for (let i = 0; i < 2; i++) {
        const side = (i === 0 ? -1 : 1);
        sph(g, eyeMat, 0.085, side * 0.28, 2.12, -1.78);
        sph(g, pupilMat, 0.04, side * 0.3, 2.12, -1.86);
        rb(g, skinDark, 0.2, 0.09, 0.16, 0.04, side * 0.28, 2.26, -1.78, 0, 0, side * -0.35);
      }
      sph(g, pupilMat, 0.03, -0.12, 1.98, -2.55);
      sph(g, pupilMat, 0.03, 0.12, 1.98, -2.55);

      // 背脊低鳞甲
      for (let i = 0; i < 7; i++) {
        const z = -1.0 + i * 0.42;
        const h = 0.16 - Math.abs(i - 3) * 0.012;
        cone(g, skinDark, 0.07, h, 0, 2.05 - Math.max(0, i - 3) * 0.12, z, 0.25, 0, 0);
      }

      // 尾巴（长、渐细、水平后伸微垂）
      for (let i = 0; i < 7; i++) {
        const r = 0.42 - i * 0.05;
        const seg = new T.Mesh(R.roundedCyl(r, r * 0.86, 0.72, 12), i < 3 ? skin : skinDark);
        seg.rotation.x = Math.PI / 2;
        seg.position.set(0, 1.35 - i * 0.06, 1.15 + i * 0.66);
        g.add(seg);
      }

      // 短小前肢（上臂 + 前臂 + 双爪）
      for (let i = 0; i < 2; i++) {
        const side = (i === 0 ? -1 : 1);
        const arm = new T.Group();
        capY(arm, skinDark, 0.08, 0.28, 0, -0.12, 0, 0, 0, side * 0.3);
        capY(arm, skinDark, 0.055, 0.22, side * 0.05, -0.34, -0.05, -0.5, 0, side * 0.2);
        cone(arm, clawMat, 0.028, 0.12, side * 0.03, -0.46, -0.16, -1.2, 0, 0);
        cone(arm, clawMat, 0.028, 0.12, side * 0.1, -0.45, -0.14, -1.2, 0, 0);
        arm.position.set(side * 0.46, 1.62, -0.85);
        g.add(arm);
      }

      // 后腿（粗壮弯曲：大腿 + 小腿 + 跖骨 + 三趾爪），legL/legR 供行走动画
      function buildLeg(side) {
        const pivot = new T.Group();
        pivot.position.set(side * 0.44, 1.5, 0.15);
        capY(pivot, skin, 0.26, 0.7, 0, -0.32, 0.02, 0.12, 0, 0);
        capY(pivot, skinDark, 0.15, 0.62, 0, -0.92, -0.08, -0.18, 0, 0);
        rb(pivot, skinDark, 0.26, 0.16, 0.5, 0.06, 0, -1.24, 0.12);
        for (let j = 0; j < 3; j++) {
          const tx = -0.14 + j * 0.14;
          capY(pivot, skinDark, 0.05, 0.22, tx, -1.28, 0.34, 1.35, 0, 0);
          cone(pivot, clawMat, 0.035, 0.14, tx, -1.3, 0.5, 1.6, 0, 0);
        }
        g.add(pivot);
        return pivot;
      }
      const legL = buildLeg(-1);
      const legR = buildLeg(1);

      const u = {
        kind: 'trex',
        health: cfg.health || 24000,
        maxHealth: cfg.health || 24000,
        speed: cfg.speed || 8,
        defense: cfg.defense || 1,
        life: cfg.life || 60,
        dead: false,
        hitFlash: 0,
        fireCd: 2,
        stompCd: 3,
        runPhase: 0,
        legL: legL, legR: legR,
        skin: skin,
        _ctx: null, _rec: null,
        respawnReady: false
      };

      u.takeDamage = function (dmg) {
        if (u.dead) return;
        u.health -= dmg / (u.defense || 1);
        u.hitFlash = 0.15;
        if (u.health <= 0) {
          u.dead = true;
          const c = u._ctx;
          if (c && c.onEnemyKilled) c.onEnemyKilled(g.position.clone(), 'trex');
        }
      };

      g.userData = u;
      return g;
    },

    onHit: function (inst, point, ctx) {
      const u = inst.userData;
      if (u.dead) return false;
      let dmg = (ctx && ctx.currentDamage) || 15;
      if (ctx && ctx.oneShotKill) dmg = 99999;
      u.takeDamage(dmg);
      return false;
    },

    update: function (inst, dt, ctx) {
      const u = inst.userData;
      u._ctx = ctx;
      const player = ctx.player;
      const list = ctx.entities || [];

      u.life -= dt;
      if (u.life <= 0 && !u.dead) {
        u.dead = true;
        if (ctx.onTrexSelfDestruct) ctx.onTrexSelfDestruct(inst.position.clone());
        return;
      }
      if (u.dead) return;

      if (u.hitFlash > 0) {
        u.hitFlash -= dt;
        u.skin.emissive.setHex(0xff2222);
        u.skin.emissiveIntensity = 1.0;
      } else {
        u.skin.emissive.setHex(0x000000);
        u.skin.emissiveIntensity = 0;
      }

      const px = inst.position.x, pz = inst.position.z;

      let tx = null, tz = null, targetDist2 = Infinity;
      for (let i = 0; i < list.length; i++) {
        const rec = list[i];
        if (!rec.alive || !rec.cfg || rec.cfg.model !== 'mushroom') continue;
        const d2 = sqDist(px, pz, rec.inst.position.x, rec.inst.position.z);
        if (d2 < targetDist2) { targetDist2 = d2; tx = rec.inst.position.x; tz = rec.inst.position.z; }
      }
      if (tx === null && player && !player.dead) {
        tx = player.pos.x; tz = player.pos.z; targetDist2 = sqDist(px, pz, tx, tz);
      }

      let moving = false;
      if (tx !== null) {
        const dx = tx - px, dz = tz - pz;
        const d = Math.sqrt(dx * dx + dz * dz) || 1;
        if (d > 1.4) {
          inst.position.x += (dx / d) * u.speed * dt;
          inst.position.z += (dz / d) * u.speed * dt;
          inst.rotation.y = Math.atan2(dx, dz);
          moving = true;
        } else {
          for (let i = list.length - 1; i >= 0; i--) {
            const rec = list[i];
            if (!rec.alive || !rec.cfg || rec.cfg.model !== 'mushroom') continue;
            if (sqDist(px, pz, rec.inst.position.x, rec.inst.position.z) < 2.25) {
              if (ctx.removeEntity) ctx.removeEntity(rec);
              if (ctx.spawnSparks) ctx.spawnSparks(rec.inst.position, 0x55ccff);
              if (ctx.score !== undefined) { ctx.score += 50; }
              break;
            }
          }
        }
      }

      u.runPhase += dt * (moving ? 9 : 2);
      const swing = Math.sin(u.runPhase) * (moving ? 0.7 : 0.05);
      u.legL.rotation.x = -swing;
      u.legR.rotation.x = swing;

      u.stompCd -= dt;
      if (u.stompCd <= 0) {
        u.stompCd = 3.5;
        const s = inst.scale.x || 1;
        const radius = 3.2 * s;
        if (ctx.hitPlayer && player && !player.dead) {
          if (sqDist(px, pz, player.pos.x, player.pos.z) < radius * radius) {
            ctx.hitPlayer(15);
          }
        }
        for (let i = 0; i < list.length; i++) {
          const rec = list[i];
          if (!rec.alive || rec.inst === inst) continue;
          const cu = rec.inst.userData;
          if (!cu || cu.kind === 'trex' || cu.dead) continue;
          if (rec.cfg.model === 'helicopter') continue;
          if (sqDist(px, pz, rec.inst.position.x, rec.inst.position.z) < radius * radius) {
            if (rec.cfg.model === 'barrel' || rec.cfg.model === 'tnt') {
              if (rec.def && rec.def.onHit) { try { rec.def.onHit(rec.inst, rec.inst.position.clone(), ctx); } catch (e) {} }
            } else if (typeof cu.takeDamage === 'function') {
              cu.takeDamage(40);
            }
          }
        }
        if (ctx.screenShake !== undefined) ctx.screenShake = Math.min(1.0, ctx.screenShake + 0.5);
      }

      u.fireCd -= dt;
      if (u.fireCd <= 0) {
        u.fireCd = 4;
        if (ctx.hitPlayer && player && !player.dead) {
          const df = Math.sqrt(sqDist(px, pz, player.pos.x, player.pos.z));
          if (df < 8) ctx.hitPlayer(20);
        }
        for (let i = 0; i < list.length; i++) {
          const rec = list[i];
          if (!rec.alive || rec.inst === inst) continue;
          const cu = rec.inst.userData;
          if (!cu || cu.kind === 'trex' || cu.dead) continue;
          if (rec.cfg.model === 'helicopter') continue;
          const df2 = sqDist(px, pz, rec.inst.position.x, rec.inst.position.z);
          if (df2 > 64) continue;
          const fx = rec.inst.position.x - px, fz = rec.inst.position.z - pz;
          const hx = Math.sin(inst.rotation.y), hz = Math.cos(inst.rotation.y);
          const dot = fx * hx + fz * hz;
          if (dot < -0.5) continue;
          if (rec.cfg.model === 'barrel' || rec.cfg.model === 'tnt') {
            if (rec.def && rec.def.onHit) { try { rec.def.onHit(rec.inst, rec.inst.position.clone(), ctx); } catch (e) {} }
          } else if (typeof cu.takeDamage === 'function') {
            cu.takeDamage(30);
          }
        }
        if (ctx.spawnSparks) {
          const fx2 = px + Math.sin(inst.rotation.y) * 2;
          const fz2 = pz + Math.cos(inst.rotation.y) * 2;
          ctx.spawnSparks(new T.Vector3(fx2, 1.2, fz2), 0xff6622);
        }
      }
    }
  };
})(window);
