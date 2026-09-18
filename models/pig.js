/**
 * pig.js — 猪头佳小BOSS：巨型野猪冲撞（v11.1 参考「黑神话」野猪图重做）
 * 注册: window.MODELS.pig
 *
 * 造型（对齐参考图）：近黑炭色乱毛躯体 + 颈背高耸的黑色鬃刺 + 巨大上扬弯獠牙
 *   + 血红发光怒眼 + 下压长吻 + 尖耳 + 粗壮四肢；去掉金属护甲（自然野兽）。
 * 行为/契约完全不变：create / update / onHit / userData.takeDamage / 激光 / 冲撞 / 动画枢轴(legs/head)。
 */
(function (global) {
  global.MODELS = global.MODELS || {};
  var T = global.THREE;
  var R = global.ROUND;

  // v11.24 猪头佳 5 种规格
  var PIG_VARIANTS = [
    { name: '瘟疫猪头佳', scale: 1.5, hp: 68500, dmgMul: 0.7, fur: 0x8a7b6b, furDark: 0x5a4b3b, mane: 0x4a3b2b, laser: 0xffffff, laserCore: 0xeeeeee, eye: 0xffffff, ember: 0xdddddd, prob: 0.35 },
    { name: '撼地尊猪头佳', scale: 3.0, hp: 105000, dmgMul: 1, fur: 0x241b15, furDark: 0x18110d, mane: 0x0c0a08, laser: 0x00ff66, laserCore: 0xd2ffd2, eye: 0xff4422, ember: 0xff3a10, prob: 0.30 },
    { name: '镇海兽猪头佳', scale: 6.0, hp: 237500, dmgMul: 2.5, fur: 0x4a4a4a, furDark: 0x2a2a2a, mane: 0x1a1a1a, laser: 0x00aaff, laserCore: 0xaad4ff, eye: 0xff4422, ember: 0xff3a10, prob: 0.10 },
    { name: '灾厄猪头佳', scale: 9.0, hp: 522500, dmgMul: 3.5, fur: 0x1a3a3a, furDark: 0x0a1a1a, mane: 0x051515, laser: 0xcc44ff, laserCore: 0xe8b4ff, eye: 0xff4422, ember: 0xff3a10, prob: 0.10 },
    { name: '灭世猪头佳', scale: 12.0, hp: 1085000, dmgMul: 5, fur: 0x0a0a0a, furDark: 0x050505, mane: 0x000000, laser: 0xff0000, laserCore: 0xffaaaa, eye: 0xff0000, ember: 0xff3300, prob: 0.05 }
  ];

  function pickVariant() {
    var r = Math.random();
    var acc = 0;
    for (var i = 0; i < PIG_VARIANTS.length; i++) {
      acc += PIG_VARIANTS[i].prob;
      if (r < acc) return PIG_VARIANTS[i];
    }
    return PIG_VARIANTS[1];   // 默认撼地尊
  }

  function sqDist(ax, az, bx, bz) { var dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; }

  // v11.15 水深采样（猪头佳避水：深水>0.5m 不入水，沿水岸滑动绕行）
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

  var LASER_ON = 5, LASER_OFF = 3, LASER_RANGE = 200, LASER_HALF_W = 1.5;
  var LASER_PITCH_MIN = 20, LASER_PITCH_MAX = 20;
  var LASER_DPS_PLAYER = 30, LASER_DPS_ENEMY = 50;

  function laserRayHit(eye, dxv, dyv, dzv, tx, ty, tz, range, r) {
    var ax = tx - eye.x, ay = ty - eye.y, az = tz - eye.z;
    var t = ax * dxv + ay * dyv + az * dzv;
    if (t < -0.01 || t > range) return false;
    var ox = ax - dxv * t, oy = ay - dyv * t, oz = az - dzv * t;
    return (ox * ox + oy * oy + oz * oz) <= r * r;
  }

  function ensureBeams(u, ctx) {
    if (u.laserBeams) return;
    var lc = u.laserColor || 0x00ff66;
    var lcc = u.laserCoreColor || 0xd2ffd2;
    var outer = new global.window.MARIO.basicS({ color: lc, transparent: true, opacity: 0.8 });
    var core = new global.window.MARIO.basicS({ color: lcc, transparent: true, opacity: 0.95 });
    u.laserBeams = [];
    for (var i = 0; i < 2; i++) {
      var beam = new T.Mesh(new T.BoxGeometry(1, 1, 1), outer);
      var c = new T.Mesh(new T.BoxGeometry(1, 1, 1), core);
      c.scale.set(0.42, 1, 1);
      beam.add(c);
      beam.visible = false;
      beam.frustumCulled = false;
      if (ctx && ctx.scene) ctx.scene.add(beam);
      u.laserBeams.push(beam);
    }
  }

  function removeBeams(u) {
    if (u.laserBeams) {
      for (var i = 0; i < u.laserBeams.length; i++) {
        var b = u.laserBeams[i];
        if (b && b.parent) b.parent.remove(b);
      }
      u.laserBeams = null;
    }
  }

  function rb(g, mat, w, h, d, r, x, y, z, rx, ry, rz) {
    var m = new T.Mesh(R.roundedBox(w, h, d, r), mat);
    m.position.set(x, y, z);
    if (rx || ry || rz) m.rotation.set(rx || 0, ry || 0, rz || 0);
    g.add(m);
    return m;
  }
  function cap(g, mat, radius, len, x, y, z, rx, ry, rz) {
    var m = new T.Mesh(R.roundedCyl(radius, radius, len, 12), mat);
    m.position.set(x, y, z);
    if (rx || ry || rz) m.rotation.set(rx || 0, ry || 0, rz || 0);
    g.add(m);
    return m;
  }

  global.MODELS.pig = {
    name: 'pig',

    create: function (config) {
      var cfg = config || {};
      var g = new T.Group();

      // v11.24 选择变体（cfg.variant 0-4 或随机）
      var variant = cfg.variant != null ? PIG_VARIANTS[cfg.variant] : pickVariant();
      if (!variant) variant = PIG_VARIANTS[1];

      // 哑光深色材质（不受 MARIO 调色板提亮，忠实还原参考图的近黑乱毛野猪）
      function std(color, rough, metal) {
        return new T.MeshStandardMaterial({ color: color, roughness: (rough === undefined ? 0.9 : rough), metalness: (metal || 0) });
      }
      var fur = std(variant.fur, 0.92);
      var furBelly = std(variant.furDark, 0.95);
      var maneMat = std(variant.mane, 0.96);
      var tuskMat = std(0xd8c59c, 0.55, 0.05);
      var noseMat = std(0x120d0a, 0.7);
      var holeMat = std(0x000000, 1);
      var eyeMat = new T.MeshStandardMaterial({ color: variant.eye, emissive: variant.eye, emissiveIntensity: 3.2, roughness: 0.4 });
      var emberMat = new T.MeshBasicMaterial({ color: variant.ember });

      // —— 躯体：前倾弓背（肩部高、臀低），高分段椭圆 ——
      var body = new T.Mesh(new T.SphereGeometry(1.0, 22, 16), fur);
      body.scale.set(1.16, 0.96, 1.42);
      body.position.set(0, 1.02, -0.05);
      body.rotation.x = -0.06;
      g.add(body);
      // 肩部隆起（肌肉驼峰，鬃刺基部）
      var hump = new T.Mesh(new T.SphereGeometry(0.72, 18, 14), fur);
      hump.scale.set(1.05, 0.9, 1.0);
      hump.position.set(0, 1.5, 0.55);
      g.add(hump);
      // 臀部
      var rump = new T.Mesh(new T.SphereGeometry(0.72, 16, 12), fur);
      rump.scale.set(1.0, 0.85, 0.95);
      rump.position.set(0, 1.0, -1.1);
      g.add(rump);
      // 下腹暗色
      var belly = new T.Mesh(new T.SphereGeometry(0.7, 14, 12), furBelly);
      belly.scale.set(0.85, 0.55, 1.0);
      belly.position.set(0, 0.62, 0.1);
      g.add(belly);

      // —— 头：下压前伸（冲锋姿态）——
      var head = rb(g, fur, 0.82, 0.74, 0.9, 0.24, 0, 1.16, 1.28, 0.34, 0, 0);
      // 重眉骨（压在眼上，凶相）
      rb(g, furBelly, 0.72, 0.16, 0.34, 0.07, 0, 1.34, 1.42, 0.34, 0, 0);

      // —— 长吻：向前下方伸出，末端鼻镜 + 双鼻孔 ——
      rb(g, fur, 0.36, 0.32, 0.7, 0.13, 0, 0.96, 1.86, 0.28, 0, 0);
      var noseTip = new T.Mesh(new T.SphereGeometry(0.19, 12, 10), noseMat);
      noseTip.position.set(0, 0.86, 2.18);
      noseTip.scale.set(1.1, 0.85, 0.8);
      g.add(noseTip);
      var n1 = new T.Mesh(new T.SphereGeometry(0.05, 8, 6), holeMat);
      n1.position.set(-0.08, 0.9, 2.3); g.add(n1);
      var n2 = n1.clone(); n2.position.x = 0.08; g.add(n2);

      // —— 血红怒眼（重眉下，发光）——
      function makeEye(side) {
        var grp = new T.Group();
        var e = new T.Mesh(new T.SphereGeometry(0.1, 12, 10), eyeMat);
        e.position.set(side * 0.3, 1.24, 1.5); grp.add(e);
        var glow = new T.Mesh(new T.SphereGeometry(0.15, 10, 8),
          new T.MeshBasicMaterial({ color: 0xff2a00, transparent: true, opacity: 0.35 }));
        glow.position.copy(e.position); grp.add(glow);
        return grp;
      }
      g.add(makeEye(-1), makeEye(1));

      // —— 尖耳（向后外撇）——
      function makeEar(side) {
        var ear = new T.Mesh(new T.ConeGeometry(0.14, 0.4, 8), maneMat);
        ear.position.set(side * 0.36, 1.6, 1.02);
        ear.rotation.set(-0.5, 0, side * 0.5);
        return ear;
      }
      g.add(makeEar(-1), makeEar(1));

      // —— 巨大弯獠牙：自下颌向上向前弯过鼻尖（三段弧线）——
      function makeTusk(side) {
        var grp = new T.Group();
        var s1 = new T.Mesh(new T.ConeGeometry(0.1, 0.42, 8), tuskMat);
        s1.position.set(0, 0.2, 0.02); s1.rotation.z = side * -0.3; grp.add(s1);
        var s2 = new T.Mesh(new T.ConeGeometry(0.078, 0.42, 8), tuskMat);
        s2.position.set(side * -0.14, 0.48, 0.16); s2.rotation.set(-0.55, 0, side * -0.7); grp.add(s2);
        var s3 = new T.Mesh(new T.ConeGeometry(0.05, 0.4, 8), tuskMat);
        s3.position.set(side * -0.2, 0.66, 0.42); s3.rotation.set(-1.15, 0, side * -0.4); grp.add(s3);
        grp.position.set(side * 0.24, 0.74, 1.6);
        return grp;
      }
      g.add(makeTusk(-1), makeTusk(1));

      // —— 颈背高耸鬃刺（黑色，颈高尾低，向前倾，乱毛感）——
      function makeMane(z, h, tilt) {
        var m = new T.Mesh(new T.ConeGeometry(0.07, h, 6), maneMat);
        m.position.set(0, 1.9 + h * 0.35, z);
        m.rotation.x = tilt;
        return m;
      }
      g.add(
        makeMane(0.95, 0.62, -0.5), makeMane(0.55, 0.72, -0.45), makeMane(0.15, 0.66, -0.4),
        makeMane(-0.3, 0.56, -0.35), makeMane(-0.75, 0.46, -0.3), makeMane(-1.15, 0.36, -0.28),
        makeMane(-1.5, 0.26, -0.25)
      );
      // 体侧乱毛簇（肩部两侧，增强 shaggy）
      function tuft(x, y, z, ry) {
        var t = new T.Mesh(new T.ConeGeometry(0.08, 0.3, 5), maneMat);
        t.position.set(x, y, z); t.rotation.set(-0.3, ry, 0); return t;
      }
      g.add(tuft(-0.9, 1.5, 0.5, -0.6), tuft(0.9, 1.5, 0.5, 0.6),
        tuft(-0.95, 1.1, 0.0, -0.9), tuft(0.95, 1.1, 0.0, 0.9),
        tuft(-0.85, 1.3, -0.6, -1.1), tuft(0.85, 1.3, -0.6, 1.1));

      // —— 身上暗红余烬光点（还原参考图的红色斑点）——
      function ember(x, y, z) {
        var e = new T.Mesh(new T.SphereGeometry(0.05, 6, 5), emberMat);
        e.position.set(x, y, z); return e;
      }
      g.add(ember(0.5, 1.6, 0.3), ember(-0.55, 1.45, -0.2), ember(0.3, 1.3, -0.8), ember(-0.4, 1.55, 0.7));

      // —— 四腿：粗壮胶囊 + 球蹄 ——
      var legs = [];
      function makeLeg(sx, sz) {
        var leg = new T.Mesh(R.roundedCyl(0.15, 0.15, 0.72, 12), fur);
        leg.position.set(0, -0.34, 0);
        var hoof = new T.Mesh(new T.SphereGeometry(0.16, 10, 8), furBelly);
        hoof.position.set(0, -0.7, 0.02); hoof.scale.set(1, 0.75, 1.1); leg.add(hoof);
        var pivot = new T.Group();
        pivot.position.set(sx, 0.8, sz);
        pivot.add(leg);
        g.add(pivot);
        return pivot;
      }
      legs.push(makeLeg(-0.6, 0.78), makeLeg(0.6, 0.78), makeLeg(-0.6, -0.9), makeLeg(0.6, -0.9));

      // —— 短尾 ——
      cap(g, fur, 0.05, 0.34, 0, 1.15, -1.75, -0.7, 0, 0);

      // —— 状态（契约不变）——
      var hp = (cfg.health || 55000) * variant.hpMul;
      var u = {
        kind: 'pig',
        variant: variant,
        variantName: variant.name,
        dmgMul: variant.dmgMul,
        laserColor: variant.laser,
        laserCoreColor: variant.laserCore,
        health: hp,
        maxHealth: hp,
        dead: false,
        life: cfg.life || 30,
        speed: cfg.speed || 2.7,
        hitPlayerCd: 0,
        hitEnemyCd: 0,
        runPhase: 0,
        hitFlash: 0,
        defense: 2,
        _ctx: null,
        _rec: null,
        legs: legs,
        head: head,
        respawnReady: false,
        laserPhase: 'on',
        laserTimer: 0,
        laserDmgTick: 0,
        laserBeams: null,
        laserEyeL: new T.Vector3(-0.3, 1.24, 1.5),
        laserEyeR: new T.Vector3(0.3, 1.24, 1.5),
        laserSweep: 0,
        laserPitch: 40
      };
      g.userData = u;

      // v11.28 应用变体缩放 (直接使用 variant.scale，不再乘以 cfg.scale 基数)
      g.scale.set(variant.scale, variant.scale, variant.scale);

      // v11.28 HP 直接取 variant.hp (绝对值)
      var hp = variant.hp;
      var u = {
        kind: 'pig',
        variant: variant,
        variantName: variant.name,
        dmgMul: variant.dmgMul,
        laserColor: variant.laser,
        laserCoreColor: variant.laserCore,
        health: hp,
        maxHealth: hp,
        dead: false,
        life: cfg.life || 30,
        speed: cfg.speed || 2.7,
        hitPlayerCd: 0,
        hitEnemyCd: 0,
        runPhase: 0,
        hitFlash: 0,
        defense: 2,
        _ctx: null,
        _rec: null,
        legs: legs,
        head: head,
        respawnReady: false,
        laserPhase: 'on',
        laserTimer: 0,
        laserDmgTick: 0,
        laserBeams: null,
        laserEyeL: new T.Vector3(-0.3, 1.24, 1.5),
        laserEyeR: new T.Vector3(0.3, 1.24, 1.5),
        laserSweep: 0,
        laserPitch: 40
      };
      g.userData = u;

      // v11.28 HP 绝对值，不再乘以倍率
      u.takeDamage = function (dmg) {
        if (u.dead) return;
        u.health -= dmg / (u.defense || 1);
        u.hitFlash = 0.15;
        var c = u._ctx;
        if (c && c.sfx) c.sfx.playHit();
        if (u.health <= 0) {
          u.dead = true;
          removeBeams(u);
          if (c && c.sfx) c.sfx.playDeath();
          if (c && c.onEnemyKilled) c.onEnemyKilled(g.position.clone(), 'pig', u.variantName);
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

      if (u.life <= 0) {
        u.life = 0;
        u.dead = true;
        removeBeams(u);
        if (ctx.onPigSelfDestruct) ctx.onPigSelfDestruct(inst.position.clone(), u);
        u.respawnReady = true;
        return;
      }

      var px = inst.position.x, pz = inst.position.z;
      var list = ctx.entities || [];
      var best = null, bestD = Infinity;
      if (!ctx.player.dead) {
        var dxp = ctx.player.pos.x - px, dzp = ctx.player.pos.z - pz;
        bestD = dxp * dxp + dzp * dzp;
        best = { x: ctx.player.pos.x, z: ctx.player.pos.z };
      } else {
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
      }

      var dirX = 0, dirZ = -1;
      if (best) {
        var dx = best.x - px, dz = best.z - pz;
        var d = Math.sqrt(dx * dx + dz * dz) || 1;
        dirX = dx / d; dirZ = dz / d;
        inst.rotation.y = Math.atan2(dirX, dirZ);
      }
      stepAvoidWater(inst, dirX, dirZ, u.speed * dt);

      if (best && ctx.breakObstacleAhead) {
        u._ramT = (u._ramT || 0) + dt;
        if (u._ramT > 0.25) {
          u._ramT = 0;
          ctx.breakObstacleAhead(inst.position, dirX, dirZ, 3.5 * (inst.scale.x || 1), 400, 'pig');
        }
      }

      u.runPhase += dt * (11 + u.speed * 0.5);
      for (var li = 0; li < 4; li++) {
        var phase = (li % 2 === 0 ? 0 : Math.PI) + (li < 2 ? 0 : Math.PI);
        u.legs[li].rotation.x = Math.sin(u.runPhase + phase) * 0.85;
      }
      u.head.rotation.z = Math.sin(u.runPhase * 0.5) * 0.06;

      var s = inst.scale.x || 1;
      var contactR = 1.7 * s;

      if (ctx.hitPlayer && !ctx.player.dead && u.hitPlayerCd <= 0) {
        var pr = contactR + (ctx.playerRadius || 0.4);
        if (sqDist(px, pz, ctx.player.pos.x, ctx.player.pos.z) < pr * pr) {
          u.hitPlayerCd = 0.7;
          var _dm = u.dmgMul || 1;
          ctx.hitPlayer(Math.round((5 + Math.floor(Math.random() * 16)) * 1.5 * _dm));
        }
      }

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
            var _edm = u.dmgMul || 1;
            tgt.takeDamage(Math.round((30 + Math.floor(Math.random() * 21)) * _edm));
            var kn = new T.Vector3().subVectors(hit.inst.position, inst.position);
            kn.y = 0;
            if (kn.lengthSq() > 1e-6) { kn.normalize().multiplyScalar(3.0); hit.inst.position.add(kn); }
          }
        }
      }

      /* 激光：双眼以固定 20° 俯角向正前方地面扫射 */
      u.laserTimer += dt;
      if (u.laserPhase === 'on' && u.laserTimer >= LASER_ON) { u.laserPhase = 'off'; u.laserTimer = 0; }
      else if (u.laserPhase === 'off' && u.laserTimer >= LASER_OFF) { u.laserPhase = 'on'; u.laserTimer = 0; }
      u.laserSweep += dt * 1.2;
      var pitchRad = (LASER_PITCH_MIN + (LASER_PITCH_MAX - LASER_PITCH_MIN) * (0.5 + 0.5 * Math.sin(u.laserSweep))) * Math.PI / 180;
      u.laserPitch = Math.round((pitchRad * 180 / Math.PI) * 10) / 10;
      var hx = Math.sin(inst.rotation.y), hz = Math.cos(inst.rotation.y);
      var dxv = hx * Math.cos(pitchRad);
      var dyv = -Math.sin(pitchRad);
      var dzv = hz * Math.cos(pitchRad);

      ensureBeams(u, ctx);
      inst.updateMatrixWorld(true);
      var eyeMid = new T.Vector3(0, 1.24, 1.5).applyMatrix4(inst.matrixWorld);
      for (var bi = 0; bi < u.laserBeams.length; bi++) {
        var bm = u.laserBeams[bi];
        var eye = bi === 0 ? u.laserEyeL : u.laserEyeR;
        var ew = new T.Vector3().copy(eye).applyMatrix4(inst.matrixWorld);
        var st = new T.Vector3(ew.x, Math.max(0.25, ew.y), ew.z);
        var tGround = ew.y > 0.15 ? (ew.y - 0.15) / Math.sin(pitchRad) : LASER_RANGE;
        var en = new T.Vector3(ew.x + dxv * tGround, 0.15, ew.z + dzv * tGround);
        bm.position.addVectors(st, en).multiplyScalar(0.5);
        bm.lookAt(en);
        bm.scale.set(0.4, 0.06, Math.max(0.5, st.distanceTo(en)));
        bm.visible = (u.laserPhase === 'on');
      }
      if (u.laserPhase === 'on') {
        u.laserDmgTick += dt;
        var _ldm = u.dmgMul || 1;
        while (u.laserDmgTick >= 1) {
          u.laserDmgTick -= 1;
          if (ctx.hitPlayer && !ctx.player.dead &&
              laserRayHit(eyeMid, dxv, dyv, dzv,
                ctx.player.pos.x, ctx.player.pos.y + 0.5, ctx.player.pos.z, LASER_RANGE, LASER_HALF_W)) {
            ctx.hitPlayer(Math.round(LASER_DPS_PLAYER * _ldm));
          }
          for (var li2 = 0; li2 < list.length; li2++) {
            var recL = list[li2];
            if (!recL.alive || recL === u._rec) continue;
            var cuL = recL.inst.userData;
            if (!cuL) continue;
            if (cuL.kind === 'pig') continue;
            var mL = recL.cfg.model;
            if (mL === 'helicopter') continue;
            if (!(recL.cfg.dynamic && typeof cuL.takeDamage === 'function' && !cuL.dead)) continue;
            var tyL = recL.inst.position.y + (mL === 'spider' ? 0.15 : 0.5);
            if (laserRayHit(eyeMid, dxv, dyv, dzv,
                recL.inst.position.x, tyL, recL.inst.position.z, LASER_RANGE, LASER_HALF_W)) {
              cuL.takeDamage(Math.round(LASER_DPS_ENEMY * _ldm));
            }
          }
        }
      }
    }
  };
})(window);
