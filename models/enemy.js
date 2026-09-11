/**
 * enemy.js — 敌人模型 + AI + 动画 + 投射物（全自包含，v3：三类敌人；v6.5：机甲 BOSS）
 * 注册: window.MODELS.enemy
 *
 * 三大类敌人（config.enemyType）：
 *   'human'   人类士兵：持枪向玩家射击（散布较大，精准度低）
 *   'monster' 怪物：从口中喷射火球，体型更大、血量/伤害更高
 *   'boss'    BOSS：体型巨大（config.scale 放大）
 *             - 旧版人形 BOSS：火球 + 三向子弹
 *             - v6.5 机甲 BOSS（config.bossKind === 'mech'）：巨型机器人造型（每关不同配色），
 *               防御×2（defense=2，伤害减半），武器为火箭炮（AoE 爆炸）
 *
 * 主程序契约：
 *   1. create(config, ctx) 创建实例
 *   2. update(inst, dt, ctx) 每帧 AI/动画/投射物
 *   3. onHit(inst, point, ctx) 玩家子弹命中 → 返回 true 表示爆头
 *   4. inst.userData.takeDamage(dmg) 外部范围伤害（爆炸/火箭/核弹）
 *   5. inst.userData.respawnReady === true → 主程序移除（cfg.respawn=0 不重生）
 *   6. 死亡 → ctx.onEnemyKilled(pos, type)（BOSS 额外 ctx.onBossKilled(pos)）
 */
(function (global) {
  global.MODELS = global.MODELS || {};

  var LOOKS = {
    human:   { body: 0x3d5a80, dark: 0x293241, eye: 0xff3b3b },
    monster: { body: 0x7a3b58, dark: 0x4a2236, eye: 0xffe24a },
    boss:    { body: 0x4a1f2c, dark: 0x2a1016, eye: 0xff2a2a },
    spider:  { body: 0x2d1f1f, dark: 0x1a1212, eye: 0xff4444, leg: 0x3d2b2b }
  };

  // v6.5 机甲 BOSS 配色（每关不同造型）：红 / 蓝 / 绿 / 紫 / 金
  var MECH_SKINS = [
    { main: 0xb03a2e, dark: 0x5a1d16, accent: 0xffd166, visor: 0xff5533 },  // 红（第3关）
    { main: 0x2e5fb0, dark: 0x16305a, accent: 0x8fd3ff, visor: 0x66ccff },  // 蓝（第4关）
    { main: 0x2e8f4e, dark: 0x12401f, accent: 0xb6ff8f, visor: 0x88ff66 },  // 绿（第5关）
    { main: 0x7a3bb0, dark: 0x38155a, accent: 0xe6b8ff, visor: 0xd488ff },  // 紫（无尽随机）
    { main: 0xc9a227, dark: 0x5c4708, accent: 0xfff3c4, visor: 0xffcc33 }   // 金（无尽随机）
  ];

  global.MODELS.enemy = {
    name: 'enemy',

    create: function (config) {
      const T = global.THREE;
      const cfg = config || {};
      const type = cfg.enemyType || 'human';
      const look = LOOKS[type] || LOOKS.human;
      const isMonster = (type === 'monster');
      const isBoss = (type === 'boss');
      // v6.5 机甲 BOSS
      const isMech = isBoss && cfg.bossKind === 'mech';
      const skinIdx = Math.max(0, Math.min(MECH_SKINS.length - 1, (cfg.bossSkin || 1) - 1));
      const skin = MECH_SKINS[skinIdx];
      const g = new T.Group();

      const matBody = new window.MARIO.mat({ color: isMech ? skin.main : look.body});
      const matDark = new window.MARIO.mat({ color: isMech ? skin.dark : look.dark});
      const matEye = new window.MARIO.mat({ color: look.eye, emissive: look.eye, emissiveIntensity: 1.6 });
      const matGun = new window.MARIO.mat({ color: 0x1b1e23});
      const matHand = new window.MARIO.mat({ color: 0x2e3d52});
      const matAccent = new window.MARIO.mat({ color: (skin && skin.accent) || 0xffd166});
      const matVisor = new window.MARIO.mat({ color: (skin && skin.visor) || 0xff5533, emissive: (skin && skin.visor) || 0xff5533, emissiveIntensity: 2.2 });

      // ---- 共享枢轴（机甲 / 人形共用） ----
      var gunPivot, armPivotL, armPivotR, legPivotL, legPivotR, muzzleLocal = null, gunZ = 0.6;

      if (isMech) {
        // ===== v10.6 机甲 BOSS：酷霸王(Bowser)机甲风格（圆润厚重 + 刺球肩 + 履带重足 + 半透明座舱）=====
        gunZ = 0.55;
        var warnMat = new window.MARIO.mat({ color: 0xffc107 });   // 警示黄
        var redMat = new window.MARIO.mat({ color: 0xa02222 });    // 暗红
        var cockpitMat = new window.MARIO.mat({ color: 0x7a1f1f, transparent: true, opacity: 0.55 }); // 半透明暗红座舱盖

        // 腿 + 圆角履带重足
        legPivotL = new T.Group(); legPivotL.position.set(-0.38, 0.95, 0);
        var legL = new T.Mesh(new T.CylinderGeometry(0.2, 0.24, 0.95, 16), matDark);
        legL.position.y = -0.45; legL.castShadow = true; legPivotL.add(legL);
        var trackL = new T.Mesh(new T.CylinderGeometry(0.28, 0.28, 0.5, 20), warnMat);
        trackL.rotation.x = Math.PI / 2; trackL.position.set(0, -0.98, 0.06); legPivotL.add(trackL);
        g.add(legPivotL);

        legPivotR = new T.Group(); legPivotR.position.set(0.38, 0.95, 0);
        var legR = new T.Mesh(new T.CylinderGeometry(0.2, 0.24, 0.95, 16), matDark);
        legR.position.y = -0.45; legR.castShadow = true; legPivotR.add(legR);
        var trackR = new T.Mesh(new T.CylinderGeometry(0.28, 0.28, 0.5, 20), warnMat);
        trackR.rotation.x = Math.PI / 2; trackR.position.set(0, -0.98, 0.06); legPivotR.add(trackR);
        g.add(legPivotR);

        // 髋部（圆润）
        var hip = new T.Mesh(new T.SphereGeometry(0.55, 20, 16), matDark);
        hip.scale.set(1.6, 0.6, 1.0); hip.position.y = 1.05; hip.castShadow = true; g.add(hip);

        // 躯干（厚重圆润）
        var torso = new T.Mesh(new T.SphereGeometry(0.85, 24, 20), matBody);
        torso.scale.set(1.0, 1.15, 0.85); torso.position.y = 1.85; torso.castShadow = true; g.add(torso);
        var chestPlate = new T.Mesh(new T.SphereGeometry(0.5, 18, 14), warnMat);
        chestPlate.scale.set(1.1, 0.9, 0.5); chestPlate.position.set(0, 1.95, 0.5); g.add(chestPlate);
        var core = new T.Mesh(new T.SphereGeometry(0.16, 14, 12), matVisor);
        core.position.set(0, 1.95, 0.68); g.add(core);

        // 刺球肩膀（球体 + 尖刺）
        function makeSpikedShoulder(side) {
          var grp = new T.Group();
          var ball = new T.Mesh(new T.SphereGeometry(0.45, 20, 16), matDark);
          grp.add(ball);
          for (var si = 0; si < 8; si++) {
            var a = (si / 8) * Math.PI * 2;
            var spike = new T.Mesh(new T.ConeGeometry(0.09, 0.35, 8), warnMat);
            spike.position.set(Math.cos(a) * 0.42, Math.sin(a) * 0.42, 0);
            spike.rotation.z = a;
            grp.add(spike);
          }
          grp.position.set(side * 1.05, 2.45, 0);
          return grp;
        }
        g.add(makeSpikedShoulder(-1), makeSpikedShoulder(1));

        // 头 + 半透明座舱盖 + 发光复眼核心
        var head = new T.Mesh(new T.SphereGeometry(0.42, 20, 16), matDark);
        head.scale.set(1.0, 0.85, 0.9); head.position.y = 2.72; head.castShadow = true; g.add(head);
        var cockpit = new T.Mesh(new T.SphereGeometry(0.34, 20, 16), cockpitMat);
        cockpit.scale.set(0.9, 0.7, 0.8); cockpit.position.set(0, 2.7, 0.2); g.add(cockpit);
        var eyeCore = new T.Mesh(new T.SphereGeometry(0.12, 12, 10), matVisor);
        eyeCore.position.set(0, 2.72, 0.38); g.add(eyeCore);

        // 粗圆柱机械臂
        armPivotL = new T.Group();
        armPivotL.position.set(-1.1, 2.0, 0.15);
        armPivotL.rotation.x = -1.15; armPivotL.rotation.y = 0.22;
        var armL = new T.Mesh(new T.CylinderGeometry(0.16, 0.2, 0.95, 14), matDark);
        armL.position.y = -0.475; armL.castShadow = true; armPivotL.add(armL);
        var fistL = new T.Mesh(new T.SphereGeometry(0.24, 16, 14), redMat);
        fistL.position.y = -0.95; armPivotL.add(fistL);
        g.add(armPivotL);

        armPivotR = new T.Group();
        armPivotR.position.set(1.1, 2.0, 0.15);
        armPivotR.rotation.x = -1.15; armPivotR.rotation.y = -0.22;
        var armR = new T.Mesh(new T.CylinderGeometry(0.16, 0.2, 0.95, 14), matDark);
        armR.position.y = -0.475; armR.castShadow = true; armPivotR.add(armR);
        var fistR = new T.Mesh(new T.SphereGeometry(0.24, 16, 14), redMat);
        fistR.position.y = -0.95; armPivotR.add(fistR);
        g.add(armPivotR);

        // 火箭炮主武器（粗圆筒 + 圆头）
        gunPivot = new T.Group();
        gunPivot.position.set(0, 1.75, 0.55);
        var launcher = new T.Mesh(new T.CylinderGeometry(0.26, 0.3, 1.3, 16), matDark);
        launcher.rotation.x = Math.PI / 2; launcher.position.z = 0.35; launcher.castShadow = true; gunPivot.add(launcher);
        var barrel = new T.Mesh(new T.CylinderGeometry(0.15, 0.17, 0.8, 14), matGun);
        barrel.rotation.x = Math.PI / 2; barrel.position.z = 1.0; barrel.castShadow = true; gunPivot.add(barrel);
        var muzzle = new T.Mesh(new T.SphereGeometry(0.18, 14, 12), warnMat);
        muzzle.position.z = 1.42; gunPivot.add(muzzle);
        var grip = new T.Mesh(new T.CylinderGeometry(0.1, 0.12, 0.3, 10), matGun);
        grip.position.set(0, -0.3, 0.3); gunPivot.add(grip);
        var finL = new T.Mesh(new T.BoxGeometry(0.08, 0.32, 0.5), warnMat);
        finL.position.set(-0.24, 0, 0.5); gunPivot.add(finL);
        var finR = finL.clone(); finR.position.x = 0.24; gunPivot.add(finR);
        g.add(gunPivot);
        muzzleLocal = new T.Vector3(0, 1.75, 1.55);
      } else {
      // ---- 躯干（怪物更宽更高） ----
      const torso = new T.Mesh(
        new T.BoxGeometry(isMonster ? 0.95 : 0.7, isMonster ? 1.05 : 0.9, isMonster ? 0.6 : 0.45),
        matBody
      );
      torso.position.y = isMonster ? 1.32 : 1.25;
      torso.castShadow = true;
      g.add(torso);

      // ---- 头（怪物更大） ----
      const head = new T.Mesh(
        new T.BoxGeometry(isMonster ? 0.56 : 0.4, isMonster ? 0.5 : 0.4, isMonster ? 0.52 : 0.4),
        matDark
      );
      head.position.y = isMonster ? 2.08 : 1.9;
      head.castShadow = true;
      g.add(head);

      // ---- 眼睛 ----
      const eyeSize = isMonster ? 0.13 : 0.09;
      const eyeL = new T.Mesh(new T.BoxGeometry(eyeSize, eyeSize * 0.75, 0.035), matEye);
      eyeL.position.set(-0.12, (isMonster ? 2.1 : 1.93), (isMonster ? 0.27 : 0.21));
      const eyeR = eyeL.clone();
      eyeR.position.x = 0.12;
      g.add(eyeL, eyeR);

      // ---- BOSS 专属：犄角 + 肩甲 ----
      if (isBoss) {
        const hornMat = new window.MARIO.mat({ color: 0xd8d8e0});
        const h1 = new T.Mesh(new T.ConeGeometry(0.12, 0.55, 8), hornMat);
        h1.position.set(-0.2, 2.32, 0.02);
        h1.rotation.z = 0.5;
        const h2 = h1.clone();
        h2.position.x = 0.2;
        h2.rotation.z = -0.5;
        g.add(h1, h2);

        const shoulder = new T.Mesh(new T.BoxGeometry(1.55, 0.36, 0.72), matDark);
        shoulder.position.y = 1.88;
        shoulder.castShadow = true;
        g.add(shoulder);
      }

      // ---- 双臂（怪物前伸，人类/BOSS 持枪姿势） ----
      const armLen = isMonster ? 0.72 : 0.62;
      const armW = isMonster ? 0.17 : 0.12;
      const armBase = isMonster ? -0.55 : -0.42;
      const armRotX = isMonster ? -0.5 : -1.15;

      armPivotL = new T.Group();
      armPivotL.position.set(-armBase, 1.6, 0.05);
      armPivotL.rotation.x = armRotX;
      armPivotL.rotation.y = 0.18;
      const armL = new T.Mesh(new T.BoxGeometry(armW, armLen, armW), matDark);
      armL.position.y = -armLen / 2;
      armL.castShadow = true;
      armPivotL.add(armL);
      g.add(armPivotL);

      armPivotR = new T.Group();
      armPivotR.position.set(armBase, 1.6, 0.05);
      armPivotR.rotation.x = armRotX;
      armPivotR.rotation.y = -0.18;
      const armR = new T.Mesh(new T.BoxGeometry(armW, armLen, armW), matDark);
      armR.position.y = -armLen / 2;
      armR.castShadow = true;
      armPivotR.add(armR);
      g.add(armPivotR);

      // 怪物巨掌
      if (isMonster) {
        const palmL = new T.Mesh(new T.BoxGeometry(0.32, 0.24, 0.32), matBody);
        palmL.position.y = -armLen - 0.07;
        armPivotL.add(palmL);
        const palmR = new T.Mesh(new T.BoxGeometry(0.32, 0.24, 0.32), matBody);
        palmR.position.y = -armLen - 0.07;
        armPivotR.add(palmR);
      }

      // ---- 枪（人类 / BOSS 才有） ----
      gunPivot = new T.Group();
      gunPivot.position.set(0, 1.42, 0.6);
      if (!isMonster) {
        const gun = new T.Mesh(new T.BoxGeometry(0.1, 0.14, 0.7), matGun);
        gun.castShadow = true;
        gunPivot.add(gun);
        const tip = new T.Mesh(new T.SphereGeometry(0.05, 6, 6), new window.MARIO.basic({ color: 0xff8844 }));
        tip.position.z = 0.36;
        gunPivot.add(tip);
        const handL = new T.Mesh(new T.BoxGeometry(0.14, 0.14, 0.16), matHand);
        handL.position.set(-0.12, -0.04, 0.06);
        gunPivot.add(handL);
        const handR = new T.Mesh(new T.BoxGeometry(0.14, 0.14, 0.16), matHand);
        handR.position.set(0.12, -0.04, -0.16);
        gunPivot.add(handR);
      }
      g.add(gunPivot);

      // ---- 腿 ----
      const legH = 0.85;
      legPivotL = new T.Group();
      legPivotL.position.set(-0.2, 0.85, 0);
      const legL = new T.Mesh(new T.BoxGeometry(0.16, legH, 0.18), matDark);
      legL.position.y = -legH / 2;
      legL.castShadow = true;
      legPivotL.add(legL);
      g.add(legPivotL);

      legPivotR = new T.Group();
      legPivotR.position.set(0.2, 0.85, 0);
      const legR = new T.Mesh(new T.BoxGeometry(0.16, legH, 0.18), matDark);
      legR.position.y = -legH / 2;
      legR.castShadow = true;
      legPivotR.add(legR);
      g.add(legPivotR);
      }  // end humanoid (非机甲) body

      // ---- 运行时状态 ----
      const u = {
        kind: 'enemy',
        type: type,
        health: cfg.health || 100,
        maxHealth: cfg.health || 100,
        speed: cfg.speed || 1.5,
        damage: cfg.damage || 10,
        // v6.5: 防御倍率（机甲 BOSS defense=2 → 受到的伤害减半）
        defense: cfg.defense || 1,
        weapon: cfg.weapon || 'bullet',   // 'bullet' | 'fireball'(怪物) | 'rocket'(机甲)
        muzzleLocal: muzzleLocal,
        gunZ: gunZ,
        shootRange: cfg.shootRange || 20,
        shootCooldown: cfg.shootCooldown || 2,
        baseStopDist: cfg.stopDist || 5,
        score: cfg.score || 100,
        walkPhase: 0,
        hitFlash: 0,
        dead: false,
        deathTimer: 0,
        respawnReady: false,
        shootTimer: Math.random() * 1.5,
        projectiles: [],
        bodyMat: matBody,
        gunPivot: gunPivot,
        pivots: { armL: armPivotL, armR: armPivotR, legL: legPivotL, legR: legPivotR },
        _ctx: null
      };
      u.takeDamage = function (dmg) {
        if (u.dead) return;
        // v6.5 防御：机甲 BOSS 防御 ×2 → 伤害 ÷2
        u.health -= dmg / u.defense;
        u.hitFlash = 0.18;
        const c = u._ctx;
        if (c && c.sfx) c.sfx.playHit();
        if (u.health <= 0) {
          u.dead = true;
          u.deathTimer = 0;
          if (c && c.sfx) c.sfx.playDeath();
          if (c && c.onEnemyKilled) c.onEnemyKilled(g.position.clone(), u.type);
          if (c && c.onBossKilled && u.type === 'boss') c.onBossKilled(g.position.clone());
        }
      };
      g.userData = u;
      return g;
    },

    /** 玩家子弹命中；返回 true 表示爆头（爆头 ×5，暴击一击必杀由 ctx.oneShotKill 控制） */
    onHit: function (inst, point, ctx) {
      const u = inst.userData;
      if (u.dead) return false;
      u._ctx = ctx;
      const s = inst.scale.x || 1;
      const headBottom = inst.position.y + 1.68 * s;
      const head = !!(point && point.y > headBottom);
      let dmg = (ctx && ctx.currentDamage) || 15;
      if (head) dmg *= 5;
      if (ctx && ctx.oneShotKill && u.type !== 'boss') dmg = 99999;
      u.takeDamage(dmg);
      if (ctx && ctx.sfx && head) ctx.sfx.playHeadshot();
      return head;
    },

    /** 主程序每帧调用 */
    update: function (inst, dt, ctx) {
      const T = global.THREE;
      const u = inst.userData;
      u._ctx = ctx;
      const player = ctx.player;
      if (!player) return;
      const pr = ctx.playerRadius || 0.5;
      const ph = ctx.playerHeight || 1.7;
      const s = inst.scale.x || 1;

      // ---- 投射物更新（子弹 / 火球） ----
      updateProjectiles(u, inst, dt, ctx, pr, ph);

      // ---- 死亡动画：倒下 + 下沉 ----
      if (u.dead) {
        u.deathTimer += dt;
        const k = Math.min(1, u.deathTimer / 1.3);
        inst.rotation.z = -k * Math.PI / 2;
        inst.position.y = -k * 0.5;
        if (k >= 1) u.respawnReady = true;
        return;
      }

      // ---- 受击闪红 ----
      if (u.hitFlash > 0) {
        u.hitFlash -= dt;
        u.bodyMat.emissive.setHex(0xff2222);
        u.bodyMat.emissiveIntensity = 1.2;
      } else {
        u.bodyMat.emissive.setHex(0x000000);
        u.bodyMat.emissiveIntensity = 0;
      }

      // ---- 朝向玩家 ----
      const dx = player.pos.x - inst.position.x;
      const dz = player.pos.z - inst.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > 1e-4) inst.rotation.y = Math.atan2(dx, dz);

      // ---- 移动：太远靠近，太近后退 ----
      const stopDist = u.baseStopDist * s;
      let moving = false;
      if (dist > stopDist) {
        const mv = u.speed * dt;
        inst.position.x += (dx / dist) * mv;
        inst.position.z += (dz / dist) * mv;
        moving = true;
      } else if (u.type !== 'boss' && dist < stopDist * 0.55 && dist > 1e-4) {
        inst.position.x -= (dx / dist) * u.speed * dt * 0.5;
        inst.position.z -= (dz / dist) * u.speed * dt * 0.5;
        moving = true;
      }

      // v10.3 BOSS 撞开前方障碍物（前进时自动破坏挡路的墙/房/箱）
      if (u.type === 'boss' && moving && dist > stopDist && ctx.breakObstacleAhead) {
        u._ramT = (u._ramT || 0) + dt;
        if (u._ramT > 0.25) {
          u._ramT = 0;
          ctx.breakObstacleAhead(inst.position, dx / dist, dz / dist, 4.0 * s, 400);
        }
      }

      // ---- 动画 ----
      u.walkPhase += dt * (moving ? 8 : 2);
      const swing = Math.sin(u.walkPhase) * (moving ? 0.85 : 0.1);
      u.pivots.legL.rotation.x = -swing;
      u.pivots.legR.rotation.x = swing;

      if (isMonsterType(u)) {
        // 怪物：抬臂蓄力 + 手掌前推
        const k = moving ? 0.08 : 0.03;
        u.pivots.armL.rotation.x = -0.5 + Math.sin(u.walkPhase * 0.5) * k;
        u.pivots.armR.rotation.x = -0.5 - Math.sin(u.walkPhase * 0.5) * k;
      } else {
        // 人类/BOSS/机甲：持枪姿势
        const k2 = moving ? 0.05 : 0.015;
        u.pivots.armL.rotation.x = -1.15 + Math.sin(u.walkPhase * 0.5) * k2;
        u.pivots.armR.rotation.x = -1.15 - Math.sin(u.walkPhase * 0.5) * k2;
        if (u.gunKick > 0) {
          u.gunKick -= dt * 8;
          u.gunPivot.position.z = u.gunZ - Math.max(0, u.gunKick) * 0.12;
        } else {
          u.gunPivot.position.z = u.gunZ;
        }
      }

      // ---- 攻击（先检查视线：被墙/建筑/车辆等挡住则不开枪） ----
      u.shootTimer -= dt;
      if (u.shootTimer <= 0 && dist < u.shootRange && !player.dead && canSeePlayer(inst, ctx, player)) {
        u.shootTimer = u.shootCooldown;
        if (isMonsterType(u)) {
          fireFireball(u, inst, ctx, player);
        } else if (u.weapon === 'rocket') {
          // v6.5 机甲 BOSS：火箭炮（AoE 爆炸）
          fireRocket(u, inst, ctx, player);
        } else {
          fireBullet(u, inst, ctx, player, dist);
          if (u.type === 'boss') {
            // 旧版人形 BOSS：额外两发偏转子弹（三向）
            fireBullet(u, inst, ctx, player, dist, -0.24);
            fireBullet(u, inst, ctx, player, dist, 0.24);
          }
        }
      }

      function isMonsterType(uu) { return uu.type === 'monster'; }
    }
  };

  /** 视线检测：从敌人头部到玩家躯干，中间若被存活碰撞体（墙/建筑/车/箱）挡住则不可见 */
  function canSeePlayer(inst, ctx, player) {
    if (!ctx.scene || !ctx.findEntityById) return true;
    const T = global.THREE;
    const from = inst.position.clone();
    from.y += (inst.scale.x || 1) * 1.6;
    const to = new T.Vector3(player.pos.x, player.pos.y + 0.85, player.pos.z);
    const dir = to.clone().sub(from);
    const d = dir.length();
    if (d < 0.01) return true;
    dir.normalize();
    const ray = new T.Raycaster(from, dir, 0, d);
    const hits = ray.intersectObjects(ctx.scene.children, true);
    for (let i = 0; i < hits.length; i++) {
      const o = hits[i].object;
      if (o.userData && o.userData.noHit) continue;
      const id = o.userData && o.userData.entityId;
      if (!id) continue;
      const rec = ctx.findEntityById(id);
      if (rec && rec.alive && rec.cfg.collision && rec.cfg.model !== 'sky' && rec.cfg.model !== 'floor') {
        return false;
      }
    }
    return true;
  }

  // ---- 投射物更新 ----
  function updateProjectiles(u, inst, dt, ctx, pr, ph) {
    const T = global.THREE;
    for (let i = u.projectiles.length - 1; i >= 0; i--) {
      const b = u.projectiles[i];
      b.life -= dt;
      b.mesh.position.addScaledVector(b.vel, dt);
      if (b.kind === 'fireball') {
        b.mesh.rotation.x += dt * 8;
        b.mesh.rotation.z += dt * 6;
      }

      const hdx = b.mesh.position.x - ctx.player.pos.x;
      const hdz = b.mesh.position.z - ctx.player.pos.z;
      const hd = Math.sqrt(hdx * hdx + hdz * hdz);
      const by = b.mesh.position.y;
      const hitR = (b.kind === 'fireball' ? 0.55 : b.kind === 'rocket' ? 0.75 : 0.22) + pr;

      // ---- 火箭弹（机甲 BOSS）：命中或到期 → 爆炸（范围伤害） ----
      if (b.kind === 'rocket') {
        const directHit = hd < hitR && by > -0.3 && by < ph;
        const expired = b.life <= 0 || hd > u.shootRange * 3;
        if (directHit || expired) {
          if (ctx.spawnSparks) ctx.spawnSparks(b.mesh.position.clone(), 0xff8844);
          // 爆炸范围：以弹着点为中心 3.4m 内对玩家造成全额伤害
          const d2p = Math.sqrt(
            (b.mesh.position.x - ctx.player.pos.x) * (b.mesh.position.x - ctx.player.pos.x) +
            (b.mesh.position.z - ctx.player.pos.z) * (b.mesh.position.z - ctx.player.pos.z)
          );
          if (d2p < 3.4) {
            if (ctx.hitPlayer) ctx.hitPlayer(b.damage);
          }
          if (ctx.explode) ctx.explode(b.mesh.position.clone(), 2.8, b.damage * 0.3, { noPlayer: true, quiet: true });
          ctx.scene.remove(b.mesh);
          u.projectiles.splice(i, 1);
          continue;
        }
      }

      if (hd < hitR && by > -0.3 && by < ph) {
        if (ctx.hitPlayer) ctx.hitPlayer(b.damage * 0.5);   // 敌人伤害已减半
        if (ctx.spawnSparks) ctx.spawnSparks(b.mesh.position.clone(), b.kind === 'fireball' ? 0xff7722 : 0xffaa55);
        ctx.scene.remove(b.mesh);
        u.projectiles.splice(i, 1);
        continue;
      }
      if (b.life <= 0 || hd > u.shootRange * 3) {
        ctx.scene.remove(b.mesh);
        u.projectiles.splice(i, 1);
      }
    }
  }

  // ---- 火箭炮（v6.5 机甲 BOSS）：体积大、速度快、爆炸范围伤害 ----
  function fireRocket(u, inst, ctx, player) {
    const T = global.THREE;
    const muzzle = (u.muzzleLocal || new T.Vector3(0, 1.42, 0.98)).clone();
    inst.localToWorld(muzzle);
    const aim = new T.Vector3(
      player.pos.x - muzzle.x + (Math.random() - 0.5) * 1.2,
      (player.pos.y + 0.9) - muzzle.y + (Math.random() - 0.5) * 0.6,
      player.pos.z - muzzle.z + (Math.random() - 0.5) * 1.2
    ).normalize();
    if (ctx.sfx) ctx.sfx.playEnemyShot();
    u.gunKick = 1;
    if (ctx.spawnTracer) ctx.spawnTracer(muzzle, muzzle.clone().addScaledVector(aim, 9), 0xff8844);

    const bmesh = new T.Mesh(
      new T.CylinderGeometry(0.09, 0.09, 0.8, 8),
      new window.MARIO.mat({ color: 0x3a3f45, emissive: 0xff6622, emissiveIntensity: 0.7 })
    );
    bmesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), aim.clone());
    bmesh.position.copy(muzzle);
    ctx.scene.add(bmesh);
    u.projectiles.push({ mesh: bmesh, vel: aim.multiplyScalar(19), life: 5, damage: u.damage, kind: 'rocket' });
  }

  // ---- 子弹（人类 / BOSS）：大散布 = 低精准度 ----
  function fireBullet(u, inst, ctx, player, dist, yawOffset) {
    const T = global.THREE;
    const muzzle = new T.Vector3(0, 1.42, 0.98);
    inst.localToWorld(muzzle);
    // 精准度降低：瞄向玩家躯干时加入 ±1.2 单位的随机散布
    const aim = new T.Vector3(
      player.pos.x - muzzle.x + (Math.random() - 0.5) * 2.4,
      (player.pos.y + 0.85) - muzzle.y + (Math.random() - 0.5) * 1.4,
      player.pos.z - muzzle.z + (Math.random() - 0.5) * 2.4
    ).normalize();
    if (yawOffset) {
      const cos = Math.cos(yawOffset), sin = Math.sin(yawOffset);
      const nx = aim.x * cos - aim.z * sin;
      const nz = aim.x * sin + aim.z * cos;
      aim.set(nx, aim.y, nz).normalize();
    }
    if (ctx.sfx) ctx.sfx.playEnemyShot();
    u.gunKick = 1;
    if (ctx.spawnTracer) ctx.spawnTracer(muzzle, muzzle.clone().addScaledVector(aim, dist), 0xff6633);

    const bmesh = new T.Mesh(
      new T.CylinderGeometry(0.03, 0.03, 0.5, 6),
      new window.MARIO.basic({ color: 0xffaa55 })
    );
    bmesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), aim.clone());
    bmesh.position.copy(muzzle);
    ctx.scene.add(bmesh);
    u.projectiles.push({ mesh: bmesh, vel: aim.multiplyScalar(26), life: 3, damage: u.damage, kind: 'bullet' });
  }

  // ---- 火球（怪物 / BOSS）：体积大、速度慢、伤害高 ----
  function fireFireball(u, inst, ctx, player) {
    const T = global.THREE;
    const s = inst.scale.x || 1;
    const muzzle = new T.Vector3(0, 1.95 * s, 0.42 * s);
    inst.localToWorld(muzzle);
    const aim = new T.Vector3(
      player.pos.x - muzzle.x + (Math.random() - 0.5) * 1.6,
      (player.pos.y + 0.9) - muzzle.y + (Math.random() - 0.5) * 1.0,
      player.pos.z - muzzle.z + (Math.random() - 0.5) * 1.6
    ).normalize();
    if (ctx.sfx) ctx.sfx.playEnemyShot();

    // 蓄力动作
    u.pivots.armL.rotation.x = -1.25;
    u.pivots.armR.rotation.x = -1.25;

    if (ctx.spawnTracer) ctx.spawnTracer(muzzle, muzzle.clone().addScaledVector(aim, 6), 0xff5522);

    const R = 0.34 * s;
    const bmesh = new T.Mesh(
      new T.SphereGeometry(R, 10, 10),
      new window.MARIO.basic({ color: 0xff6a1a, transparent: true, opacity: 0.95 })
    );
    const glow = new T.Mesh(
      new T.SphereGeometry(R * 1.55, 10, 10),
      new window.MARIO.basic({ color: 0xff9944, transparent: true, opacity: 0.3 })
    );
    bmesh.add(glow);
    bmesh.position.copy(muzzle);
    ctx.scene.add(bmesh);
    u.projectiles.push({ mesh: bmesh, vel: aim.multiplyScalar(15), life: 4, damage: u.damage, kind: 'fireball' });
  }
})(window);
