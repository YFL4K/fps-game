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

  global.MODELS.spider = {
    name: 'spider',

    create: function (config) {
      const T = global.THREE;
      const cfg = config || {};
      const look = LOOKS.spider;
      const g = new T.Group();

      const matBody = new T.MeshStandardMaterial({ color: look.body, roughness: 0.5, metalness: 0.3 });
      const matDark = new T.MeshStandardMaterial({ color: look.dark, roughness: 0.7, metalness: 0.2 });
      const matEye = new T.MeshStandardMaterial({ color: look.eye, emissive: look.eye, emissiveIntensity: 1.2 });
      const matLeg = new T.MeshStandardMaterial({ color: look.leg, roughness: 0.6, metalness: 0.1 });

      // 身体（椭圆形）
      const body = new T.Mesh(new T.SphereGeometry(0.35, 10, 8), matBody);
      body.scale.set(1, 0.6, 1.3);
      body.position.y = 0.25;
      body.castShadow = true;
      g.add(body);

      // 头部
      const head = new T.Mesh(new T.SphereGeometry(0.25, 8, 8), matBody);
      head.position.set(0, 0.3, 0.35);
      head.castShadow = true;
      g.add(head);

      // 眼睛（复眼效果）
      const eyeL = new T.Mesh(new T.SphereGeometry(0.06, 6, 6), matEye);
      eyeL.position.set(-0.12, 0.38, 0.52);
      const eyeR = eyeL.clone();
      eyeR.position.x = 0.12;
      g.add(eyeL, eyeR);

      // 大颚
      const jawL = new T.Mesh(new T.ConeGeometry(0.06, 0.18, 6), matDark);
      jawL.position.set(-0.1, 0.15, 0.45);
      jawL.rotation.x = 0.3;
      const jawR = jawL.clone();
      jawR.position.x = 0.1;
      g.add(jawL, jawR);

      // 八条腿
      var legPivots = [];
      for (var side = -1; side <= 1; side += 2) {
        for (var i = 0; i < 4; i++) {
          var pivot = new T.Group();
          pivot.position.set(side * 0.3, 0.15, -0.15 + i * 0.15);
          var legSeg1 = new T.Mesh(new T.CylinderGeometry(0.025, 0.02, 0.25, 6), matLeg);
          legSeg1.position.y = -0.12;
          legSeg1.rotation.z = side * 0.4;
          pivot.add(legSeg1);
          var legSeg2 = new T.Mesh(new T.CylinderGeometry(0.02, 0.015, 0.22, 6), matLeg);
          legSeg2.position.set(side * 0.12, -0.3, 0);
          legSeg2.rotation.z = side * 0.3;
          pivot.add(legSeg2);
          var claw = new T.Mesh(new T.SphereGeometry(0.035, 6, 6), matDark);
          claw.position.set(side * 0.22, -0.38, 0);
          pivot.add(claw);
          g.add(pivot);
          legPivots.push(pivot);
        }
      }

      // 毒囊（腹部末端）
      const poisonSac = new T.Mesh(
        new T.SphereGeometry(0.18, 8, 8),
        new T.MeshStandardMaterial({ color: 0x8800ff, emissive: 0x440088, emissiveIntensity: 0.5 })
      );
      poisonSac.scale.set(1, 0.7, 1.1);
      poisonSac.position.set(0, 0.2, -0.4);
      g.add(poisonSac);

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

      if (u.dead) {
        u.deathTimer += dt;
        const k = Math.min(1, u.deathTimer / 0.5);
        inst.scale.y = 1 - k * 0.6;
        inst.position.y = -k * 0.15;
        if (k >= 1) u.respawnReady = true;
        return;
      }

      // 自爆逻辑
      if (u.exploding) {
        u.explodeTimer -= dt;
        // 发光脉冲
        u.bodyMat.emissive.setHex(0xaa22ff);
        u.bodyMat.emissiveIntensity = 1.5 - u.explodeTimer * 3;
        if (u.explodeTimer <= 0) {
          u.triggerExplode(inst.position.clone());
        }
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

      // 移动：快速爬向玩家
      if (dist > u.explodeRange) {
        const mv = u.speed * dt;
        inst.position.x += (dx / dist) * mv;
        inst.position.z += (dz / dist) * mv;
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
