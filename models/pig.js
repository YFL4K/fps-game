/**
 * pig.js — v7.0 猪头佳小BOSS：巨型野猪冲撞
 * 注册: window.MODELS.pig
 *
 * 造型：棕色身体 + 白色上弯獠牙 + 绿色发光眼睛 + 立耳 + 尾巴 + 深棕四腿
 * 行为（update 每帧由主程序调用）：
 *   1. 30 秒出场时间，超时自爆（调用 ctx.onPigSelfDestruct）
 *   2. 无差别冲撞：不断冲向最近目标（玩家/地面敌人/爆炸物）
 *   3. 撞玩家 → ctx.hitPlayer(5~20)（主程序钳制 5~20）
 *   4. 撞敌人 → takeDamage(30~50) + 击退
 *   5. 撞爆炸物（油桶/TNT）→ 触发 def.onHit 引爆（explode chain）
 *   6. 撞场景 → 由主程序 collideEnemies 推挤（不穿模）
 *
 * 主程序契约：
 *   1. create(config, ctx) 创建实例（scale 由 cfg.scale 控制，主程序传 [3,3,3]）
 *   2. update(inst, dt, ctx) 每帧冲撞 AI / 奔跑动画 / 倒计时
 *   3. onHit(inst, point, ctx) 玩家子弹命中
 *   4. inst.userData.takeDamage(dmg) 外部范围伤害（爆炸等）
 *   5. 死亡/自爆 → ctx.onEnemyKilled(pos, 'pig') 或 ctx.onPigSelfDestruct(pos)，并置 respawnReady
 */
(function (global) {
  global.MODELS = global.MODELS || {};
  var T = global.THREE;

  function sqDist(ax, az, bx, bz) { var dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; }

  global.MODELS.pig = {
    name: 'pig',

    create: function (config) {
      var cfg = config || {};
      var g = new T.Group();

      var fur = new T.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.85, metalness: 0.05 });
      var furDark = new T.MeshStandardMaterial({ color: 0x5f3d1d, roughness: 0.9, metalness: 0.02 });
      var tuskMat = new T.MeshStandardMaterial({ color: 0xf7f2e8, roughness: 0.35, metalness: 0.1 });
      var eyeMat = new T.MeshStandardMaterial({ color: 0x0a2a10, emissive: 0x00ff55, emissiveIntensity: 2.4 });
      var noseMat = new T.MeshStandardMaterial({ color: 0xc97b4a, roughness: 0.6 });
      var holeMat = new T.MeshStandardMaterial({ color: 0x3a1e0c });

      // 身体（椭圆，z 轴为前进方向）
      var body = new T.Mesh(new T.SphereGeometry(1.0, 24, 18), fur);
      body.scale.set(1.05, 0.92, 1.32);
      body.position.y = 1.05;
      body.castShadow = body.receiveShadow = true;
      g.add(body);

      // 头
      var head = new T.Mesh(new T.SphereGeometry(0.64, 20, 16), fur);
      head.scale.set(0.95, 0.9, 0.88);
      head.position.set(0, 1.18, 1.12);
      head.castShadow = true;
      g.add(head);

      // 鼻子 + 鼻孔
      var snout = new T.Mesh(new T.BoxGeometry(0.42, 0.26, 0.22), noseMat);
      snout.position.set(0, 1.04, 1.6);
      g.add(snout);
      var n1 = new T.Mesh(new T.SphereGeometry(0.07, 10, 8), holeMat);
      n1.position.set(-0.1, 1.07, 1.72);
      g.add(n1);
      var n2 = n1.clone();
      n2.position.x = 0.1;
      g.add(n2);

      // 獠牙（白色，上弯外撇）
      function makeTusk(side) {
        var tusk = new T.Mesh(new T.ConeGeometry(0.085, 0.6, 10), tuskMat);
        tusk.position.set(side * 0.3, 0.95, 1.5);
        tusk.rotation.z = side * -0.42;
        tusk.rotation.x = 0.5;
        tusk.castShadow = true;
        return tusk;
      }
      g.add(makeTusk(-1), makeTusk(1));

      // 眼睛（绿色发光）
      function makeEye(side) {
        var e = new T.Mesh(new T.SphereGeometry(0.115, 12, 10), eyeMat);
        e.position.set(side * 0.42, 1.44, 1.26);
        return e;
      }
      var eyeL = makeEye(-1), eyeR = makeEye(1);
      g.add(eyeL, eyeR);

      // 耳朵（立耳）
      function makeEar(side) {
        var ear = new T.Mesh(new T.ConeGeometry(0.15, 0.34, 8), furDark);
        ear.position.set(side * 0.4, 1.7, 1.0);
        ear.rotation.x = 0.5;
        ear.rotation.z = side * 0.45;
        ear.castShadow = true;
        return ear;
      }
      g.add(makeEar(-1), makeEar(1));

      // 四腿（奔跑动画 pivot）
      var legs = [];
      function makeLeg(sx, sz) {
        var leg = new T.Mesh(new T.CylinderGeometry(0.16, 0.13, 0.8, 10), furDark);
        leg.position.set(0, -0.4, 0);
        leg.castShadow = true;
        var pivot = new T.Group();
        pivot.position.set(sx, 0.8, sz);
        pivot.add(leg);
        g.add(pivot);
        return pivot;
      }
      legs.push(makeLeg(-0.62, 0.8), makeLeg(0.62, 0.8), makeLeg(-0.62, -0.8), makeLeg(0.62, -0.8));

      // 尾巴（翘起）
      var tail = new T.Mesh(new T.CylinderGeometry(0.045, 0.09, 0.5, 8), furDark);
      tail.position.set(0, 1.18, -1.42);
      tail.rotation.x = 1.15;
      tail.castShadow = true;
      g.add(tail);

      // 背脊鬃毛（增强野猪感）
      function makeMane(z, s) {
        var m = new T.Mesh(new T.ConeGeometry(0.1, 0.3, 6), furDark);
        m.position.set(0, 1.85, z);
        m.scale.set(1, s, 1);
        return m;
      }
      g.add(makeMane(0.35, 1), makeMane(-0.2, 0.85), makeMane(-0.75, 0.7), makeMane(-1.2, 0.6));

      // 状态
      var u = {
        kind: 'pig',
        health: cfg.health || 800,
        maxHealth: cfg.health || 800,
        dead: false,
        life: cfg.life || 30,
        speed: cfg.speed || 13,
        hitPlayerCd: 0,
        hitEnemyCd: 0,
        runPhase: 0,
        hitFlash: 0,
        defense: 1,
        _ctx: null,
        _rec: null,
        legs: legs,
        head: head,
        respawnReady: false
      };
      g.userData = u;

      u.takeDamage = function (dmg) {
        if (u.dead) return;
        u.health -= dmg / (u.defense || 1);
        u.hitFlash = 0.15;
        var c = u._ctx;
        if (c && c.sfx) c.sfx.playHit();
        if (u.health <= 0) {
          u.dead = true;
          if (c && c.sfx) c.sfx.playDeath();
          if (c && c.onEnemyKilled) c.onEnemyKilled(g.position.clone(), 'pig');
          u.respawnReady = true;
        }
      };
      return g;
    },

    onHit: function (inst, point, ctx) {
      var u = inst.userData;
      if (u.dead) return false;
      var dmg = (ctx && ctx.currentDamage) || 15;
      if (ctx && ctx.oneShotKill) dmg = 99999;
      u.takeDamage(dmg);
      return false;
    },

    update: function (inst, dt, ctx) {
      var u = inst.userData;
      u._ctx = ctx;
      if (u.dead || !ctx || !ctx.player) return;
      u.life -= dt;
      u.hitPlayerCd = Math.max(0, u.hitPlayerCd - dt);
      u.hitEnemyCd = Math.max(0, u.hitEnemyCd - dt);
      if (u.hitFlash > 0) u.hitFlash -= dt;

      // 30 秒超时 → 自爆
      if (u.life <= 0) {
        u.life = 0;
        u.dead = true;
        if (ctx.onPigSelfDestruct) ctx.onPigSelfDestruct(inst.position.clone());
        u.respawnReady = true;
        return;
      }

      // 选择最近目标（玩家/敌人/爆炸物）无差别冲撞
      var px = inst.position.x, pz = inst.position.z;
      var best = null, bestD = Infinity;
      if (!ctx.player.dead) {
        var dxp = ctx.player.pos.x - px, dzp = ctx.player.pos.z - pz;
        var dp = dxp * dxp + dzp * dzp;
        if (dp < bestD) { bestD = dp; best = { x: ctx.player.pos.x, z: ctx.player.pos.z }; }
      }
      var list = ctx.entities || [];
      for (var i = 0; i < list.length; i++) {
        var rec = list[i];
        if (!rec.alive || rec === u._rec) continue;
        var cu = rec.inst.userData;
        if (!cu) continue;
        var m = rec.cfg.model;
        var isTarget = false;
        if (m === 'barrel' || m === 'tnt') isTarget = !(cu.exploded || cu.destroyed);
        else if (cu.kind !== 'pig' && rec.cfg.dynamic && typeof cu.takeDamage === 'function' && m !== 'helicopter' && !cu.dead) isTarget = true;
        if (!isTarget) continue;
        var dx2 = rec.inst.position.x - px, dz2 = rec.inst.position.z - pz;
        var d2 = dx2 * dx2 + dz2 * dz2;
        if (d2 < bestD) { bestD = d2; best = { x: rec.inst.position.x, z: rec.inst.position.z }; }
      }

      // 冲刺移动
      var dirX = 0, dirZ = -1;
      if (best) {
        var dx = best.x - px, dz = best.z - pz;
        var d = Math.sqrt(dx * dx + dz * dz) || 1;
        dirX = dx / d; dirZ = dz / d;
        inst.rotation.y = Math.atan2(dirX, dirZ);
      }
      inst.position.x += dirX * u.speed * dt;
      inst.position.z += dirZ * u.speed * dt;

      // 奔跑动画：四腿摆动 + 头部轻晃
      u.runPhase += dt * (11 + u.speed * 0.5);
      for (var li = 0; li < 4; li++) {
        var phase = (li % 2 === 0 ? 0 : Math.PI) + (li < 2 ? 0 : Math.PI);
        u.legs[li].rotation.x = Math.sin(u.runPhase + phase) * 0.85;
      }
      u.head.rotation.z = Math.sin(u.runPhase * 0.5) * 0.06;

      // 冲撞伤害
      var s = inst.scale.x || 1;
      var contactR = 1.7 * s;

      // 撞玩家：每次 5~20 伤害（v7.1 图鉴表）
      if (ctx.hitPlayer && !ctx.player.dead && u.hitPlayerCd <= 0) {
        var pr = contactR + (ctx.playerRadius || 0.4);
        if (sqDist(px, pz, ctx.player.pos.x, ctx.player.pos.z) < pr * pr) {
          u.hitPlayerCd = 0.7;
          ctx.hitPlayer(5 + Math.floor(Math.random() * 16));
        }
      }

      // 撞敌人（30~50）/ 撞爆炸物（引爆）
      if (u.hitEnemyCd <= 0) {
        var hit = null, hitD = contactR * contactR * 0.9;
        for (var j = 0; j < list.length; j++) {
          var rec2 = list[j];
          if (!rec2.alive || rec2 === u._rec) continue;
          var cu2 = rec2.inst.userData;
          if (!cu2) continue;
          var m2 = rec2.cfg.model;
          var isHit = false;
          if (m2 === 'barrel' || m2 === 'tnt') isHit = !(cu2.exploded || cu2.destroyed);
          else if (cu2.kind !== 'pig' && rec2.cfg.dynamic && typeof cu2.takeDamage === 'function' && m2 !== 'helicopter' && !cu2.dead) isHit = true;
          if (!isHit) continue;
          var hd = sqDist(px, pz, rec2.inst.position.x, rec2.inst.position.z);
          if (hd < hitD) { hitD = hd; hit = rec2; }
        }
        if (hit) {
          u.hitEnemyCd = 0.5;
          if (hit.cfg.model === 'barrel' || hit.cfg.model === 'tnt') {
            if (hit.def && typeof hit.def.onHit === 'function') {
              try { hit.def.onHit(hit.inst, hit.inst.position.clone(), ctx); } catch (e) {}
            }
          } else {
            var tgt = hit.inst.userData;
            tgt.takeDamage(30 + Math.floor(Math.random() * 21));   // 30~50
            var kn = new T.Vector3().subVectors(hit.inst.position, inst.position);
            kn.y = 0;
            if (kn.lengthSq() > 1e-6) {
              kn.normalize().multiplyScalar(3.0);
              hit.inst.position.add(kn);
            }
          }
        }
      }
    }
  };
})(window);
