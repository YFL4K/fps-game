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

      // —— 超级马里奥奥德赛恐龙风格：强壮夸张、饱满肉感、凶恶黄瞳 + 圆角背刺 ——
      const skin = new window.MARIO.mat({ color: 0x6b8f3a });        // 鲜绿皮肤（明亮）
      const skinDark = new window.MARIO.mat({ color: 0x4a6b2a });    // 深绿
      const belly = new window.MARIO.mat({ color: 0xc8e0a0 });       // 浅绿肚皮
      const toothMat = new window.MARIO.mat({ color: 0xffffff });    // 白亮牙齿
      const clawMat = new window.MARIO.mat({ color: 0xd8c8a0 });     // 米黄爪
      const eye = new window.MARIO.basic({ color: 0xffcc00 });       // 凶恶黄色瞳孔
      const pupil = new window.MARIO.basic({ color: 0x1a0a00 });     // 深色瞳仁
      const browMat = new window.MARIO.mat({ color: 0x3a5520 });     // 眉骨深绿

      // 身体（饱满前倾圆润：胸大腹小）
      const chest = new T.Mesh(new T.SphereGeometry(0.85, 28, 22), skin);
      chest.scale.set(1.05, 1.2, 1.1);
      chest.position.set(0, 1.5, -0.1);
      g.add(chest);
      const bellyBox = new T.Mesh(new T.SphereGeometry(0.75, 24, 18), belly);
      bellyBox.scale.set(0.9, 1.0, 0.8);
      bellyBox.position.set(0, 1.35, 0.55);
      g.add(bellyBox);

      // 头（巨大圆润颅骨 + 前突吻部）
      const skull = new T.Mesh(new T.SphereGeometry(0.52, 24, 20), skin);
      skull.scale.set(1.1, 0.9, 1.1);
      skull.position.set(0, 2.1, -1.25);
      g.add(skull);
      const snout = new T.Mesh(new T.SphereGeometry(0.4, 20, 16), skin);
      snout.scale.set(1.0, 0.65, 1.3);
      snout.position.set(0, 1.95, -1.85);
      g.add(snout);
      // 下颚（张嘴）
      const lowerJaw = new T.Mesh(new T.SphereGeometry(0.35, 20, 16), skinDark);
      lowerJaw.scale.set(0.9, 0.5, 1.1);
      lowerJaw.position.set(0, 1.6, -1.85);
      lowerJaw.rotation.x = 0.15;
      g.add(lowerJaw);
      // 白亮利齿（上下两排，圆润锥形）
      for (let i = 0; i < 7; i++) {
        const tooth = new T.Mesh(new T.ConeGeometry(0.04, 0.16, 8), toothMat);
        tooth.position.set(-0.21 + i * 0.07, 1.78, -2.12);
        g.add(tooth);
        const tooth2 = new T.Mesh(new T.ConeGeometry(0.035, 0.13, 8), toothMat);
        tooth2.position.set(-0.21 + i * 0.07, 1.6, -2.1);
        g.add(tooth2);
      }
      // 凶恶黄色瞳孔 + 拱起眉骨
      for (let i = 0; i < 2; i++) {
        const side = (i === 0 ? -1 : 1);
        const eg = new T.Group();
        const e = new T.Mesh(new T.SphereGeometry(0.09, 14, 12), eye);
        e.position.set(side * 0.2, 2.2, -1.52);
        eg.add(e);
        const p = new T.Mesh(new T.SphereGeometry(0.04, 10, 8), pupil);
        p.position.set(side * 0.21, 2.2, -1.6);
        eg.add(p);
        const brow = new T.Mesh(new T.BoxGeometry(0.16, 0.09, 0.08), browMat);
        brow.position.set(side * 0.2, 2.34, -1.5);
        brow.rotation.z = side * -0.4;
        eg.add(brow);
        g.add(eg);
      }

      // 圆角背刺（背部一排）
      for (let i = 0; i < 5; i++) {
        const spike = new T.Mesh(new T.ConeGeometry(0.09, 0.28, 8), skinDark);
        spike.position.set(0, 2.5 - Math.abs(i - 2) * 0.08, -0.5 + i * 0.28);
        spike.rotation.x = 0.6;
        g.add(spike);
      }

      // 尾巴（圆润圆柱渐细，水平向后 + 微上翘）
      for (let i = 0; i < 5; i++) {
        const r = 0.32 - i * 0.05;
        const seg = new T.Mesh(new T.CylinderGeometry(r, r * 0.85, 0.7, 14), skinDark);
        seg.rotation.x = Math.PI / 2;
        seg.position.set(0, 1.4 + Math.sin(i * 0.3) * 0.12, 1.0 + i * 0.65);
        g.add(seg);
      }

      // 后腿（圆润大腿 + 小腿 + 三趾，legL/legR 是 pivot 供行走动画）
      function buildLeg(side) {
        const pivot = new T.Group();
        pivot.position.set(side * 0.42, 1.15, 0.3);
        const thigh = new T.Mesh(new T.CylinderGeometry(0.24, 0.28, 0.75, 16), skinDark);
        thigh.position.set(0, -0.2, 0);
        pivot.add(thigh);
        const shin = new T.Mesh(new T.CylinderGeometry(0.18, 0.16, 0.7, 14), skin);
        shin.position.set(0, -0.8, 0);
        pivot.add(shin);
        const foot = new T.Mesh(new T.SphereGeometry(0.26, 16, 12), clawMat);
        foot.scale.set(1.1, 0.5, 1.3);
        foot.position.set(0, -1.15, 0.2);
        pivot.add(foot);
        // 三趾
        for (let j = 0; j < 3; j++) {
          const toe = new T.Mesh(new T.ConeGeometry(0.05, 0.18, 6), clawMat);
          toe.position.set(-0.14 + j * 0.14, -1.28, 0.48);
          toe.rotation.x = -0.3;
          pivot.add(toe);
        }
        g.add(pivot);
        return pivot;
      }
      const legL = buildLeg(-1);
      const legR = buildLeg(1);

      // 前肢（短小圆润 + 双爪）
      for (let i = 0; i < 2; i++) {
        const side = (i === 0 ? -1 : 1);
        const arm = new T.Mesh(new T.CylinderGeometry(0.09, 0.12, 0.3, 10), skinDark);
        arm.position.set(side * 0.5, 1.5, -0.6);
        arm.rotation.z = side * 0.3;
        g.add(arm);
        for (let j = 0; j < 2; j++) {
          const claw = new T.Mesh(new T.ConeGeometry(0.03, 0.12, 6), clawMat);
          claw.position.set(side * 0.5 + (j === 0 ? -0.04 : 0.04), 1.32, -0.65);
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
