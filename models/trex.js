/**
 * trex.js — 霸王龙敌人模型 + AI（v8.4 新增，v8.6 外观重做）
 * 注册: window.MODELS.trex
 *
 * v8.6 造型重做：逼真霸王龙——巨大颅骨+前突吻部+两排利齿+张嘴下颚+红色发光眼、
 *   前倾粗壮身体、水平伸展渐细长尾、粗壮后腿（大腿/小腿/三趾脚掌）、短小前肢+双爪。
 *   体型缩小 50%（由主程序 scale 3.2→1.6 控制）。
 * 行为（update 每帧调用）：
 *   1. 行走路径吃地图上的蘑菇（朝最近蘑菇走，靠近后吃掉移除）
 *   2. 向地面喷火：前方扇形区域对玩家/敌人无差别火焰伤害 + 毁坏可破坏地图物品
 *   3. 踩踏：周期性脚下范围 AOE，对玩家/敌人无差别伤害
 *   4. 无差别冲撞：撞玩家/敌人/爆炸物
 *   5. 60 秒超时自爆（ctx.onTrexSelfDestruct），血量与猪头佳一致（24000）
 */
(function (global) {
  global.MODELS = global.MODELS || {};
  const T = global.THREE;

  function sq(a) { return a * a; }
  function sqDist(ax, az, bx, bz) { return sq(ax - bx) + sq(az - bz); }

  global.MODELS.trex = {
    name: 'trex',

    create: function (config) {
      const cfg = config || {};
      const g = new T.Group();

      // 黑灰皮肤 + 红眼 + 白牙 + 深色爪
      const skin = new T.MeshStandardMaterial({ color: 0x4a4d52, roughness: 0.65, metalness: 0.2, flatShading: true });
      const skinDark = new T.MeshStandardMaterial({ color: 0x2f3236, roughness: 0.7, metalness: 0.2, flatShading: true });
      const belly = new T.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.7, metalness: 0.2, flatShading: true });
      const toothMat = new T.MeshStandardMaterial({ color: 0xf0f0e8, roughness: 0.4, metalness: 0 });
      const clawMat = new T.MeshStandardMaterial({ color: 0x1f2124, roughness: 0.6, metalness: 0.2 });
      const eye = new T.MeshBasicMaterial({ color: 0xff2020 });

      // 身体（前倾：胸大腹小）
      const chest = new T.Mesh(new T.BoxGeometry(1.15, 1.35, 1.2), skin);
      chest.position.set(0, 1.55, -0.1);
      g.add(chest);
      const bellyBox = new T.Mesh(new T.BoxGeometry(0.95, 1.1, 1.0), belly);
      bellyBox.position.set(0, 1.4, 0.55);
      g.add(bellyBox);

      // 头（巨大颅骨 + 前突吻部）
      const skull = new T.Mesh(new T.BoxGeometry(0.6, 0.5, 0.7), skin);
      skull.position.set(0, 2.1, -1.25);
      g.add(skull);
      const snout = new T.Mesh(new T.BoxGeometry(0.45, 0.32, 0.6), skin);
      snout.position.set(0, 1.95, -1.85);
      g.add(snout);
      // 下颚（张嘴）
      const lowerJaw = new T.Mesh(new T.BoxGeometry(0.4, 0.18, 0.55), skinDark);
      lowerJaw.position.set(0, 1.65, -1.85);
      lowerJaw.rotation.x = 0.15;
      g.add(lowerJaw);
      // 牙齿（上下两排白色利齿）
      for (let i = 0; i < 6; i++) {
        const tooth = new T.Mesh(new T.BoxGeometry(0.045, 0.12, 0.045), toothMat);
        tooth.position.set(-0.18 + i * 0.07, 1.8, -2.05);
        g.add(tooth);
        const tooth2 = new T.Mesh(new T.BoxGeometry(0.045, 0.1, 0.045), toothMat);
        tooth2.position.set(-0.18 + i * 0.07, 1.66, -2.05);
        g.add(tooth2);
      }
      // 红色发光眼睛（左右）
      for (let i = 0; i < 2; i++) {
        const e = new T.Mesh(new T.SphereGeometry(0.07, 8, 6), eye);
        e.position.set((i === 0 ? -1 : 1) * 0.2, 2.2, -1.5);
        g.add(e);
      }

      // 尾巴（5 段渐细，水平向后伸展 + 微上翘）
      for (let i = 0; i < 5; i++) {
        const seg = new T.Mesh(new T.BoxGeometry(0.42 - i * 0.07, 0.4 - i * 0.06, 0.7), skinDark);
        seg.position.set(0, 1.45 + Math.sin(i * 0.25) * 0.15, 1.0 + i * 0.65);
        g.add(seg);
      }

      // 后腿（大腿 + 小腿 + 三趾脚掌，legL/legR 是 pivot 供行走动画）
      function buildLeg(side) {
        const pivot = new T.Group();
        pivot.position.set(side * 0.42, 1.15, 0.3);
        const thigh = new T.Mesh(new T.BoxGeometry(0.4, 0.75, 0.5), skinDark);
        thigh.position.set(0, -0.2, 0);
        pivot.add(thigh);
        const shin = new T.Mesh(new T.BoxGeometry(0.3, 0.7, 0.4), skin);
        shin.position.set(0, -0.8, 0);
        pivot.add(shin);
        const foot = new T.Mesh(new T.BoxGeometry(0.45, 0.15, 0.7), clawMat);
        foot.position.set(0, -1.15, 0.2);
        pivot.add(foot);
        // 三趾
        for (let j = 0; j < 3; j++) {
          const toe = new T.Mesh(new T.BoxGeometry(0.08, 0.08, 0.18), clawMat);
          toe.position.set(-0.12 + j * 0.12, -1.22, 0.45);
          pivot.add(toe);
        }
        g.add(pivot);
        return pivot;
      }
      const legL = buildLeg(-1);
      const legR = buildLeg(1);

      // 前肢（短小 + 双爪）
      for (let i = 0; i < 2; i++) {
        const arm = new T.Mesh(new T.BoxGeometry(0.14, 0.3, 0.14), skinDark);
        arm.position.set((i === 0 ? -1 : 1) * 0.5, 1.5, -0.6);
        arm.rotation.z = (i === 0 ? -1 : 1) * 0.2;
        g.add(arm);
        for (let j = 0; j < 2; j++) {
          const claw = new T.Mesh(new T.BoxGeometry(0.04, 0.12, 0.04), clawMat);
          claw.position.set((i === 0 ? -1 : 1) * 0.5 + (j === 0 ? -0.04 : 0.04), 1.35, -0.65);
          g.add(claw);
        }
      }

      const u = {
        kind: 'trex',
        health: cfg.health || 24000,
        maxHealth: cfg.health || 24000,
        speed: cfg.speed || 8,
        defense: cfg.defense || 1,
        life: cfg.life || 60,       // 出现 60 秒
        dead: false,
        hitFlash: 0,
        fireCd: 2,                  // 喷火冷却
        stompCd: 3,                 // 踩踏冷却
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
          if (c && c.onEnemyKilled) c.onEnemyKilled(g.position.clone(), 'trex');   // 击杀走击杀回调
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

      // ---- 倒计时 / 自爆 ----
      u.life -= dt;
      if (u.life <= 0 && !u.dead) {
        u.dead = true;
        if (ctx.onTrexSelfDestruct) ctx.onTrexSelfDestruct(inst.position.clone());
        return;
      }
      if (u.dead) return;

      // ---- 受击闪红 ----
      if (u.hitFlash > 0) {
        u.hitFlash -= dt;
        u.skin.emissive.setHex(0xff2222);   // v9.0 复用 emissive 对象，避免每帧 new Color
        u.skin.emissiveIntensity = 1.0;
      } else {
        u.skin.emissive.setHex(0x000000);
        u.skin.emissiveIntensity = 0;
      }

      const px = inst.position.x, pz = inst.position.z;

      // ---- 目标：优先吃蘑菇（最近的），无蘑菇则追玩家 ----
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

      // ---- 移动（吃蘑菇 / 追玩家） ----
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
          // 到达蘑菇：吃掉（移除蘑菇）
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

      // ---- 行走动画 ----
      u.runPhase += dt * (moving ? 9 : 2);
      const swing = Math.sin(u.runPhase) * (moving ? 0.7 : 0.05);
      u.legL.rotation.x = -swing;
      u.legR.rotation.x = swing;

      // ---- 踩踏：周期性脚下 AOE 无差别伤害 ----
      u.stompCd -= dt;
      if (u.stompCd <= 0) {
        u.stompCd = 3.5;
        const s = inst.scale.x || 1;
        const radius = 3.2 * s;
        // 玩家
        if (ctx.hitPlayer && player && !player.dead) {
          if (sqDist(px, pz, player.pos.x, player.pos.z) < radius * radius) {
            ctx.hitPlayer(15);
          }
        }
        // 敌人/爆炸物（无差别）
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

      // ---- 喷火：前方扇形对玩家/敌人无差别火焰伤害 + 毁坏物品 ----
      u.fireCd -= dt;
      if (u.fireCd <= 0) {
        u.fireCd = 4;
        // 玩家
        if (ctx.hitPlayer && player && !player.dead) {
          const df = Math.sqrt(sqDist(px, pz, player.pos.x, player.pos.z));
          if (df < 8) ctx.hitPlayer(20);
        }
        // 敌人/物品（前方扇形）
        for (let i = 0; i < list.length; i++) {
          const rec = list[i];
          if (!rec.alive || rec.inst === inst) continue;
          const cu = rec.inst.userData;
          if (!cu || cu.kind === 'trex' || cu.dead) continue;
          if (rec.cfg.model === 'helicopter') continue;
          const df2 = sqDist(px, pz, rec.inst.position.x, rec.inst.position.z);
          if (df2 > 64) continue;
          // 前方判定（朝 inst.rotation.y 方向）
          const fx = rec.inst.position.x - px, fz = rec.inst.position.z - pz;
          const hx = Math.sin(inst.rotation.y), hz = Math.cos(inst.rotation.y);
          const dot = fx * hx + fz * hz;
          if (dot < -0.5) continue;   // 在前方
          if (rec.cfg.model === 'barrel' || rec.cfg.model === 'tnt') {
            if (rec.def && rec.def.onHit) { try { rec.def.onHit(rec.inst, rec.inst.position.clone(), ctx); } catch (e) {} }
          } else if (typeof cu.takeDamage === 'function') {
            cu.takeDamage(30);
          }
        }
        // 火焰视觉
        if (ctx.spawnSparks) {
          const fx2 = px + Math.sin(inst.rotation.y) * 2;
          const fz2 = pz + Math.cos(inst.rotation.y) * 2;
          ctx.spawnSparks(new T.Vector3(fx2, 1.2, fz2), 0xff6622);
        }
      }
    }
  };
})(window);
