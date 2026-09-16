/**
 * enemy-spider.js — 自爆蜘蛛敌人（程序化）
 * 注册: window.MODELS.spider
 * 移动方式：贴地爬行，四肢摆动，速度较快
 * 攻击方式：贴近玩家后自爆，造成范围伤害
 * 
 * 主程序契约与 enemy.js 相同
 */
(function (global) {
  global.MODELS = global.MODELS || {};

  var LOOKS = {
    spider: { body: 0x2d1f1f, dark: 0x1a1212, eye: 0xff4444, leg: 0x3d2b2b }
  };

  // v11.15 水深采样 + 蜘蛛避水（深水>0.5m 不入水，沿水岸滑动绕行）
  function waterDepth(x, z) {
    if (!global.TERRAIN || global.TERRAIN.waterLevel == null || !global.TERRAIN.groundAt) return 0;
    var g = global.TERRAIN.groundAt(x, z);
    return g < global.TERRAIN.waterLevel ? (global.TERRAIN.waterLevel - g) : 0;
  }
  function stepAvoidWater(inst, dirX, dirZ, stepLen) {
    var nx = inst.position.x + dirX * stepLen, nz = inst.position.z + dirZ * stepLen;
    if (waterDepth(nx, nz) <= 0.5) { inst.position.x = nx; inst.position.z = nz; return true; }
    var px = -dirZ, pz = dirX;
    var lx = inst.position.x + px * stepLen, lz = inst.position.z + pz * stepLen;
    var rx = inst.position.x - px * stepLen, rz = inst.position.z - pz * stepLen;
    var dl = waterDepth(lx, lz), dr = waterDepth(rx, rz);
    if (dl <= 0.5 && dl <= dr) { inst.position.x = lx; inst.position.z = lz; return true; }
    if (dr <= 0.5) { inst.position.x = rx; inst.position.z = rz; return true; }
    return false;
  }

  global.MODELS.spider = {
    name: 'spider',

    create: function (config) {
      const T = global.THREE;
      const cfg = config || {};
      const look = LOOKS.spider;
      const g = new T.Group();

      const matBody = new window.MARIO.mat({ color: look.body});
      const matDark = new window.MARIO.mat({ color: look.dark});
      const matEye = new window.MARIO.mat({ color: look.eye, emissive: look.eye, emissiveIntensity: 1.2 });
      const matLeg = new window.MARIO.mat({ color: look.leg});

      // ===== v11.1 圆润 + 细节化蜘蛛 =====
      // 头胸部
      const body = new T.Mesh(new T.SphereGeometry(0.34, 16, 12), matBody);
      body.scale.set(1.0, 0.7, 1.15);
      body.position.set(0, 0.28, 0.05);
      g.add(body);
      // 头（前部）
      const head = new T.Mesh(new T.SphereGeometry(0.22, 14, 12), matBody);
      head.position.set(0, 0.3, 0.42);
      g.add(head);
      // 8 眼簇（4 大 4 小，发光红）
      const eyePos = [
        [-0.09, 0.36, 0.6, 0.05], [0.09, 0.36, 0.6, 0.05],
        [-0.15, 0.34, 0.55, 0.035], [0.15, 0.34, 0.55, 0.035],
        [-0.04, 0.41, 0.6, 0.03], [0.04, 0.41, 0.6, 0.03],
        [-0.11, 0.4, 0.55, 0.028], [0.11, 0.4, 0.55, 0.028]
      ];
      for (var ei = 0; ei < eyePos.length; ei++) {
        var ep = eyePos[ei];
        var em = new T.Mesh(new T.SphereGeometry(ep[3], 8, 6), matEye);
        em.position.set(ep[0], ep[1], ep[2]);
        g.add(em);
      }
      // 大颚（螯肢，向下前弯）
      function fang(side) {
        var grp = new T.Group();
        var f1 = new T.Mesh(new T.CylinderGeometry(0.03, 0.04, 0.14, 8), matDark);
        f1.position.y = -0.05; grp.add(f1);
        var f2 = new T.Mesh(new T.ConeGeometry(0.035, 0.16, 8), matDark);
        f2.position.set(side * 0.01, -0.16, 0.03); f2.rotation.x = 0.6; grp.add(f2);
        grp.position.set(side * 0.09, 0.2, 0.56); grp.rotation.z = side * 0.2;
        return grp;
      }
      g.add(fang(-1), fang(1));
      // 八条腿（两段带膝 + 爪），粗壮、关节分明
      var legPivots = [];
      for (var side = -1; side <= 1; side += 2) {
        for (var i = 0; i < 4; i++) {
          var pivot = new T.Group();
          pivot.position.set(side * 0.28, 0.26, -0.18 + i * 0.16);
          var femur = new T.Mesh(new T.CylinderGeometry(0.035, 0.03, 0.3, 8), matLeg);
          femur.position.set(side * 0.12, 0.06, 0); femur.rotation.z = side * 0.9; pivot.add(femur);
          var tibia = new T.Mesh(new T.CylinderGeometry(0.028, 0.018, 0.34, 8), matLeg);
          tibia.position.set(side * 0.3, -0.12, 0); tibia.rotation.z = side * 0.5; pivot.add(tibia);
          var claw = new T.Mesh(new T.SphereGeometry(0.03, 6, 5), matDark);
          claw.position.set(side * 0.4, -0.28, 0); pivot.add(claw);
          g.add(pivot);
          legPivots.push(pivot);
        }
      }
      // 膨大腹部 + 发光毒囊 + 斑纹
      const abdomen = new T.Mesh(new T.SphereGeometry(0.4, 18, 14), matBody);
      abdomen.scale.set(1.0, 0.85, 1.15);
      abdomen.position.set(0, 0.32, -0.42);
      g.add(abdomen);
      const sac = new T.Mesh(
        new T.SphereGeometry(0.2, 12, 10),
        new window.MARIO.mat({ color: 0x8800ff, emissive: 0x6600cc, emissiveIntensity: 0.8 })
      );
      sac.scale.set(1, 0.8, 1.1);
      sac.position.set(0, 0.36, -0.62);
      g.add(sac);
      for (var st = 0; st < 2; st++) {
        var stripe = new T.Mesh(
          new T.SphereGeometry(0.06, 8, 6),
          new window.MARIO.mat({ color: 0xbb44ff, emissive: 0x8822cc, emissiveIntensity: 0.6 })
        );
        stripe.scale.set(0.6, 0.4, 1.4);
        stripe.position.set((st ? 0.12 : -0.12), 0.5, -0.42);
        g.add(stripe);
      }

      const u = {
        kind: 'enemy',
        type: 'spider',
        health: cfg.health || 40,
        maxHealth: cfg.health || 40,
        speed: cfg.speed || 2.8,
        damage: cfg.damage || 25,
        explodeRange: cfg.explodeRange || 1.5,
        explodeDamage: cfg.explodeDamage || 45,
        explodeRadius: cfg.explodeRadius || 2.5,
        score: cfg.score || 150,
        walkPhase: 0,
        hitFlash: 0,
        dead: false,
        deathTimer: 0,
        respawning: false,
        exploding: false,
        explodeTimer: 0,
        legs: legPivots,
        bodyMat: matBody,
        _ctx: null
      };

      u.takeDamage = function (dmg) {
        if (u.dead || u.exploding) return;
        u.health -= dmg;
        u.hitFlash = 0.15;
        if (u._ctx && u._ctx.sfx) u._ctx.sfx.playHit();
        if (u.health <= 0) {
          u.dead = true;
          u.exploding = true;
          u.explodeTimer = 0.3;
          if (u._ctx && u._ctx.sfx) u._ctx.sfx.playDeath();
        }
      };

      u.triggerExplode = function (pos) {
        if (u._ctx && u._ctx.explode) {
          u._ctx.explode(pos.clone(), u.explodeRadius, u.explodeDamage, { chain: true, color: 0xaa44ff });
        }
        if (u._ctx && u._ctx.onEnemyKilled) u._ctx.onEnemyKilled(pos.clone(), 'spider');
        u.respawnReady = true;
      };

      g.userData = u;
      return g;
    },

    onHit: function (inst, point, ctx) {
      const u = inst.userData;
      if (u.dead || u.exploding) return false;
      u._ctx = ctx;
      let dmg = (ctx && ctx.currentDamage) || 15;
      u.takeDamage(dmg);
      return false;
    },

    update: function (inst, dt, ctx) {
      const T = global.THREE;
      const u = inst.userData;
      u._ctx = ctx;
      const player = ctx.player;
      if (!player) return;

      if (u.exploding) {
        // 自爆脉冲（health<=0 或贴近玩家触发）：优先于死亡动画
        u.explodeTimer -= dt;
        u.bodyMat.emissive.setHex(0xaa22ff);
        u.bodyMat.emissiveIntensity = Math.max(0, 1.5 - u.explodeTimer * 3);
        if (u.explodeTimer <= 0) {
          u.triggerExplode(inst.position.clone());
        }
        return;
      }

      if (u.dead) {
        u.deathTimer += dt;
        const k = Math.min(1, u.deathTimer / 0.5);
        inst.scale.y = 1 - k * 0.6;
        inst.position.y = -k * 0.15;
        if (k >= 1) u.respawnReady = true;
        return;
      }

      // 受击闪红
      if (u.hitFlash > 0) {
        u.hitFlash -= dt;
        u.bodyMat.emissive.setHex(0xff2222);
        u.bodyMat.emissiveIntensity = 1.0;
      } else {
        u.bodyMat.emissive.setHex(0x000000);
        u.bodyMat.emissiveIntensity = 0;
      }

      // 朝向玩家
      const dx = player.pos.x - inst.position.x;
      const dz = player.pos.z - inst.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > 0.1) inst.rotation.y = Math.atan2(dx, dz);

      // 移动：快速爬向玩家（v11.15 避开水深>0.5m 水域）
      if (dist > u.explodeRange) {
        stepAvoidWater(inst, dx / dist, dz / dist, u.speed * dt);
      }

      // 触发自爆
      if (dist <= u.explodeRange && !u.dead) {
        u.exploding = true;
        u.explodeTimer = 0.2;
        return;
      }

      // 爬行动画
      u.walkPhase += dt * u.speed * 5;
      u.legs.forEach(function (pivot, i) {
        const phase = u.walkPhase + i * 0.8;
        const swing = Math.sin(phase) * 0.35;
        pivot.rotation.z = swing;
        pivot.rotation.x = Math.sin(phase * 0.5) * 0.15;
      });

      // 身体微震动
      inst.position.y = Math.sin(u.walkPhase * 2) * 0.02;
    }
  };
})(window);
