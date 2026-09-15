/**
 * pig.js — 猪头佳小BOSS：巨型野猪冲撞（v11 圆润重做：去除方块化）
 * 注册: window.MODELS.pig
 *
 * v11 造型改动（行为/契约完全不变）：
 *   - 头/吻/肩/胸甲/护甲等方块改为圆角长方体（ROUND.roundedBox，12 棱倒角）。
 *   - 四肢由方柱改为胶囊体(圆润圆柱)，蹄为球形。
 *   - 耳朵/鬃刺由 4 边方锥改为 8 边圆锥，眼神/瞳仁用球体。
 *   - 整体为「凶狠但圆润」的有机野猪，而非积木块。
 *
 * 主程序契约不变（见 v7.0 注释）：create / update / onHit / userData.takeDamage。
 */
(function (global) {
  global.MODELS = global.MODELS || {};
  var T = global.THREE;
  var R = global.ROUND;

  function sqDist(ax, az, bx, bz) { var dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; }

  // v7.3 激光常量
  var LASER_ON = 5, LASER_OFF = 3, LASER_RANGE = 200, LASER_HALF_W = 1.5;
  var LASER_PITCH_MIN = 20, LASER_PITCH_MAX = 20;
  var LASER_DPS_PLAYER = 30, LASER_DPS_ENEMY = 50;

  /** 3D 射线命中判定 */
  function laserRayHit(eye, dxv, dyv, dzv, tx, ty, tz, range, r) {
    var ax = tx - eye.x, ay = ty - eye.y, az = tz - eye.z;
    var t = ax * dxv + ay * dyv + az * dzv;
    if (t < -0.01 || t > range) return false;
    var ox = ax - dxv * t, oy = ay - dyv * t, oz = az - dzv * t;
    return (ox * ox + oy * oy + oz * oz) <= r * r;
  }

  /** 两条激光光束（挂在 scene 层级） */
  function ensureBeams(u, ctx) {
    if (u.laserBeams) return;
    var outer = new global.window.MARIO.basic({ color: 0x00ff66, transparent: true, opacity: 0.8 });
    var core = new global.window.MARIO.basic({ color: 0xd2ffd2, transparent: true, opacity: 0.95 });
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

  // 圆角方块快捷
  function rb(g, mat, w, h, d, r, x, y, z, rx, ry, rz) {
    var m = new T.Mesh(R.roundedBox(w, h, d, r), mat);
    m.position.set(x, y, z);
    if (rx || ry || rz) m.rotation.set(rx || 0, ry || 0, rz || 0);
    g.add(m);
    return m;
  }
  // 胶囊(沿Y)快捷
  function cap(g, mat, radius, len, x, y, z) {
    var m = new T.Mesh(R.roundedCyl(radius, radius, len, 12), mat);
    m.position.set(x, y, z);
    g.add(m);
    return m;
  }

  global.MODELS.pig = {
    name: 'pig',

    create: function (config) {
      var cfg = config || {};
      var g = new T.Group();

      // —— v11 凶狠圆润野猪：圆角块体 + 胶囊四肢 + 球体眼神 + 深棕黑配色 ——
      var fur = new global.window.MARIO.mat({ color: 0x5a3320 });        // 深棕（主毛色，凶悍但不过黑）
      var furDark = new global.window.MARIO.mat({ color: 0x2e1a0e });    // 近黑（腿/耳/鬃/骨点）
      var belly = new global.window.MARIO.mat({ color: 0x7a573a });      // 暗棕肚皮
      var tuskMat = new global.window.MARIO.mat({ color: 0xe6d8b4 });    // 战损象牙（微黄）
      var eyeMat = new global.window.MARIO.mat({ color: 0xff1500, emissive: 0xff0d00, emissiveIntensity: 2.8 });
      var pupilMat = new global.window.MARIO.mat({ color: 0x000000 });
      var browMat = new global.window.MARIO.mat({ color: 0x180c06 });
      var scarMat = new global.window.MARIO.mat({ color: 0x9a3a22 });
      var hoofMat = new global.window.MARIO.mat({ color: 0x18120c });
      var armorMat = new global.window.MARIO.mat({ color: 0x3a3f45, metalness: 0.6, roughness: 0.5 });
      var spikeMat = new global.window.MARIO.mat({ color: 0x5a5f65, metalness: 0.7, roughness: 0.4 });
      var noseMat = new global.window.MARIO.mat({ color: 0x43241a });
      var holeMat = new global.window.MARIO.mat({ color: 0x0a0503 });

      // 身体（高分段椭圆球体 = 圆润肌肉感，前倾冲锋姿态）
      var body = new T.Mesh(new T.SphereGeometry(1.0, 18, 14), fur);
      body.scale.set(1.18, 0.95, 1.4);
      body.position.y = 1.05;
      body.rotation.x = -0.08;
      g.add(body);

      // 肩胛（圆角块 + 球体肩肌，棱角化消除）
      rb(g, furDark, 0.5, 0.56, 0.6, 0.18, -0.72, 1.42, 0.5, -0.15, 0.3, 0.4);
      rb(g, furDark, 0.5, 0.56, 0.6, 0.18, 0.72, 1.42, 0.5, -0.15, -0.3, -0.4);
      cap(g, fur, 0.26, 0.5, -0.78, 1.5, 0.45);
      cap(g, fur, 0.26, 0.5, 0.78, 1.5, 0.45);

      // 肋骨暗示（侧面圆润弧形，不再用尖棱）
      for (var rbi = 0; rbi < 3; rbi++) {
        var ribL = new T.Mesh(new T.TorusGeometry(0.18, 0.05, 8, 14, Math.PI * 0.6), furDark);
        ribL.position.set(-1.04, 0.95 - rbi * 0.02, 0.35 - rbi * 0.42);
        ribL.rotation.set(0.2, 0, 0.5);
        g.add(ribL);
        var ribR = ribL.clone(); ribR.position.x = 1.04; ribR.rotation.z = -0.5; g.add(ribR);
      }

      // 肚皮（暗色圆润）
      var bellyMesh = new T.Mesh(new T.SphereGeometry(0.8, 14, 12), belly);
      bellyMesh.scale.set(0.85, 0.6, 0.9);
      bellyMesh.position.set(0, 0.6, 0.55);
      g.add(bellyMesh);

      // 头（圆角长方体，前倾下压，不再 45° 方块）
      var head = rb(g, fur, 0.98, 0.86, 1.0, 0.26, 0, 1.30, 1.15, 0.16, 0, 0);
      // 头顶圆润骨冠（矮圆台，非尖方）
      var crown = new T.Mesh(new T.CylinderGeometry(0.16, 0.26, 0.22, 10), furDark);
      crown.position.set(0, 1.74, 1.02);
      g.add(crown);

      // 圆润猪吻（圆角块 + 球形鼻镜 + 球状鼻孔）
      rb(g, noseMat, 0.46, 0.36, 0.4, 0.14, 0, 1.06, 1.66, 0.22, 0, 0);
      var noseBall = new T.Mesh(new T.SphereGeometry(0.2, 12, 10), noseMat);
      noseBall.position.set(0, 1.08, 1.84);
      g.add(noseBall);
      var n1 = new T.Mesh(new T.SphereGeometry(0.05, 8, 6), holeMat);
      n1.position.set(-0.09, 1.1, 1.96); g.add(n1);
      var n2 = n1.clone(); n2.position.x = 0.09; g.add(n2);

      // 超长獠牙（两段式，6 边圆锥，尖过鼻尖）
      function makeTusk(side) {
        var grp = new T.Group();
        var lower = new T.Mesh(new T.ConeGeometry(0.09, 0.55, 8), tuskMat);
        lower.position.set(0, 0.28, 0); lower.rotation.z = side * -0.3; grp.add(lower);
        var upper = new T.Mesh(new T.ConeGeometry(0.06, 0.6, 8), tuskMat);
        upper.position.set(side * -0.1, 0.72, 0.08); upper.rotation.set(-0.3, 0, side * -0.75); grp.add(upper);
        grp.position.set(side * 0.3, 0.72, 1.5);
        return grp;
      }
      g.add(makeTusk(-1), makeTusk(1));

      // 血红怒眼：球体眼球 + 球状瞳仁 + 深压怒眉 + 眼下疤
      function makeEye(side) {
        var grp = new T.Group();
        var e = new T.Mesh(new T.SphereGeometry(0.12, 12, 10), eyeMat);
        e.position.set(side * 0.36, 1.4, 1.32); grp.add(e);
        var pupil = new T.Mesh(new T.SphereGeometry(0.06, 8, 6), pupilMat);
        pupil.position.set(side * 0.4, 1.38, 1.42); grp.add(pupil);
        var brow = rb(g, null, 0.3, 0.1, 0.14, 0.05, side * 0.36, 1.54, 1.34, 0.25, 0, side * -0.55);
        brow.material = browMat;
        var scar = rb(g, scarMat, 0.05, 0.18, 0.04, 0.02, side * 0.52, 1.22, 1.3, 0, 0, side * 0.5);
        grp.add(brow, scar);
        return grp;
      }
      g.add(makeEye(-1), makeEye(1));

      // 尖耳（8 边圆锥前倾，非方块）
      function makeEar(side) {
        var ear = new T.Mesh(new T.ConeGeometry(0.14, 0.44, 8), furDark);
        ear.position.set(side * 0.42, 1.8, 0.98);
        ear.rotation.set(0.7, 0, side * 0.3);
        return ear;
      }
      g.add(makeEar(-1), makeEar(1));

      // 破烂金属护甲（圆角胸甲 + 肩甲球 + 圆润尖刺）
      rb(g, armorMat, 1.5, 0.52, 0.32, 0.14, 0, 1.35, 0.95, -0.15, 0, 0);
      var armorStud = new T.Mesh(new T.ConeGeometry(0.08, 0.2, 8), spikeMat);
      armorStud.position.set(0, 1.52, 1.06); armorStud.rotation.x = -1.2; g.add(armorStud);
      function pauldron(side) {
        var grp = new T.Group();
        var plate = new T.Mesh(new T.SphereGeometry(0.34, 12, 10), armorMat);
        plate.scale.set(1, 0.8, 0.7); grp.add(plate);
        for (var s = 0; s < 3; s++) {
          var sp = new T.Mesh(new T.ConeGeometry(0.05, 0.22, 6), spikeMat);
          sp.position.set(side * 0.05, 0.18, -0.08 + s * 0.08); sp.rotation.x = -0.4; grp.add(sp);
        }
        grp.position.set(side * 0.9, 1.55, 0.5);
        return grp;
      }
      g.add(pauldron(-1), pauldron(1));

      // 四腿（胶囊圆润 + 球蹄，奔跑动画 pivot）
      var legs = [];
      function makeLeg(sx, sz) {
        var leg = new T.Mesh(R.roundedCyl(0.14, 0.14, 0.7, 12), furDark);
        leg.position.set(0, -0.35, 0);
        var hoof = new T.Mesh(new T.SphereGeometry(0.15, 10, 8), hoofMat);
        hoof.position.set(0, -0.72, 0.02); hoof.scale.set(1, 0.8, 1.1); leg.add(hoof);
        var pivot = new T.Group();
        pivot.position.set(sx, 0.8, sz);
        pivot.add(leg);
        g.add(pivot);
        return pivot;
      }
      legs.push(makeLeg(-0.62, 0.8), makeLeg(0.62, 0.8), makeLeg(-0.62, -0.8), makeLeg(0.62, -0.8));

      // 尾巴（圆润上翘）
      cap(g, furDark, 0.05, 0.4, 0, 1.35, -1.45);
      g.children[g.children.length - 1].rotation.x = -0.6;

      // 背脊鬃毛（8 边圆润尖刺，颈到尾错落）
      function makeMane(z, h) {
        var m = new T.Mesh(new T.ConeGeometry(0.1, h, 8), furDark);
        m.position.set(0, 1.85 + h * 0.2, z);
        m.rotation.x = -0.25;
        return m;
      }
      g.add(
        makeMane(0.75, 0.34), makeMane(0.3, 0.42), makeMane(-0.15, 0.48),
        makeMane(-0.6, 0.44), makeMane(-1.0, 0.36), makeMane(-1.35, 0.26), makeMane(-1.6, 0.18)
      );

      // 状态
      var u = {
        kind: 'pig',
        health: cfg.health || 55000,
        maxHealth: cfg.health || 55000,
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
        laserEyeL: new T.Vector3(-0.38, 1.42, 1.30),
        laserEyeR: new T.Vector3(0.38, 1.42, 1.30),
        laserSweep: 0,
        laserPitch: 40
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
          removeBeams(u);
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

      if (u.life <= 0) {
        u.life = 0;
        u.dead = true;
        removeBeams(u);
        if (ctx.onPigSelfDestruct) ctx.onPigSelfDestruct(inst.position.clone());
        u.respawnReady = true;
        return;
      }

      // 优先攻击玩家（v10.2）
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
      inst.position.x += dirX * u.speed * dt;
      inst.position.z += dirZ * u.speed * dt;

      if (best && ctx.breakObstacleAhead) {
        u._ramT = (u._ramT || 0) + dt;
        if (u._ramT > 0.25) {
          u._ramT = 0;
          ctx.breakObstacleAhead(inst.position, dirX, dirZ, 3.5 * (inst.scale.x || 1), 400);
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
          ctx.hitPlayer(Math.round((5 + Math.floor(Math.random() * 16)) * 1.5));
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
            tgt.takeDamage(30 + Math.floor(Math.random() * 21));
            var kn = new T.Vector3().subVectors(hit.inst.position, inst.position);
            kn.y = 0;
            if (kn.lengthSq() > 1e-6) { kn.normalize().multiplyScalar(3.0); hit.inst.position.add(kn); }
          }
        }
      }

      /* ============ 激光武器：双眼以固定 20° 俯角向正前方地面扫射 ============ */
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
      var eyeMid = new T.Vector3(0, 1.44, 1.26).applyMatrix4(inst.matrixWorld);
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
        while (u.laserDmgTick >= 1) {
          u.laserDmgTick -= 1;
          if (ctx.hitPlayer && !ctx.player.dead &&
              laserRayHit(eyeMid, dxv, dyv, dzv,
                ctx.player.pos.x, ctx.player.pos.y + 0.5, ctx.player.pos.z, LASER_RANGE, LASER_HALF_W)) {
            ctx.hitPlayer(LASER_DPS_PLAYER);
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
              cuL.takeDamage(LASER_DPS_ENEMY);
            }
          }
        }
      }
    }
  };
})(window);
