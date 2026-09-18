/**
 * helicopter.js — 空中直升机（v11.1 按真实武装直升机外观重做）
 * 注册: window.MODELS.helicopter
 *
 * 造型：圆润机身(大倒角) + 气泡式座舱罩 + 机鼻光电转塔 + 顶部发动机舱 +
 *   锥形尾梁 + 垂直尾翼 + 侧置尾桨 + 四叶主旋翼(绕竖直轴自旋) + 双滑橇起落架 +
 *   短翼火箭发射巢 + 机腹机炮。行为/契约不变（悬停轨道/导弹/坠毁/掉落）。
 */
(function (global) {
  global.MODELS = global.MODELS || {};
  var R = global.ROUND;

  function rb(g, mat, w, h, d, r, x, y, z, rx, ry, rz) {
    var m = new global.THREE.Mesh(R.roundedBox(w, h, d, r), mat);
    m.position.set(x, y, z);
    if (rx || ry || rz) m.rotation.set(rx || 0, ry || 0, rz || 0);
    g.add(m);
    return m;
  }
  function tubeZ(g, mat, rt, rbm, len, x, y, z, seg) {
    var m = new global.THREE.Mesh(R.cylZ(rt, rbm, len, seg || 14), mat);
    m.position.set(x, y, z);
    g.add(m);
    return m;
  }

  global.MODELS.helicopter = {
    name: 'helicopter',

    create: function (config) {
      const T = global.THREE;
      const cfg = config || {};
      const g = new T.Group();

      const bodyMat = new T.MeshStandardMaterial({ color: 0x39422f, roughness: 0.6, metalness: 0.25 }); // 军绿机身
      const panelMat = new T.MeshStandardMaterial({ color: 0x2a3122, roughness: 0.7, metalness: 0.2 });
      const glassMat = new T.MeshStandardMaterial({ color: 0x1b2b3a, transparent: true, opacity: 0.55, roughness: 0.15, metalness: 0.1, emissive: 0x081822, emissiveIntensity: 0.5 });
      const darkMat = new T.MeshStandardMaterial({ color: 0x14161a, roughness: 0.6, metalness: 0.3 });
      const redMat = new T.MeshStandardMaterial({ color: 0xc0392b, emissive: 0x6a1010, emissiveIntensity: 0.6, roughness: 0.5 });
      const steelMat = new T.MeshStandardMaterial({ color: 0x6e7883, roughness: 0.4, metalness: 0.6 });

      // 机身（大倒角圆角块 = 圆润水滴形）
      rb(g, bodyMat, 1.15, 0.95, 2.4, 0.42, 0, 0, 0.1);
      // 机鼻（前部收圆）
      const nose = new T.Mesh(new T.SphereGeometry(0.5, 18, 14), bodyMat);
      nose.scale.set(1.05, 0.82, 1.1); nose.position.set(0, -0.02, -1.15); g.add(nose);
      // 机鼻光电转塔（球形传感器）
      const turret = new T.Mesh(new T.SphereGeometry(0.2, 14, 12), darkMat);
      turret.position.set(0, -0.42, -1.15); g.add(turret);
      const turretGlass = new T.Mesh(new T.SphereGeometry(0.1, 12, 10),
        new T.MeshBasicMaterial({ color: 0x2266aa }));
      turretGlass.position.set(0, -0.42, -1.3); g.add(turretGlass);

      // 气泡式座舱罩（前上方半球玻璃）
      const canopy = new T.Mesh(new T.SphereGeometry(0.6, 20, 16), glassMat);
      canopy.scale.set(1.0, 0.85, 1.25); canopy.position.set(0, 0.28, -0.72); g.add(canopy);
      // 座舱风框
      rb(g, darkMat, 0.06, 0.5, 0.06, 0.02, 0, 0.3, -1.1);

      // 顶部发动机舱 + 排气口
      rb(g, panelMat, 0.7, 0.42, 1.1, 0.16, 0, 0.62, 0.25);
      const ex1 = new T.Mesh(new T.CylinderGeometry(0.12, 0.14, 0.3, 12), darkMat);
      ex1.rotation.x = Math.PI / 2; ex1.position.set(0.22, 0.66, 0.85); g.add(ex1);
      const ex2 = ex1.clone(); ex2.position.x = -0.22; g.add(ex2);

      // 主旋翼桅杆
      const mast = new T.Mesh(new T.CylinderGeometry(0.09, 0.12, 0.4, 12), steelMat);
      mast.position.set(0, 0.95, 0.15); g.add(mast);

      // 四叶主旋翼（水平面内，绕竖直 Y 轴自旋）
      const mainRotor = new T.Group();
      mainRotor.position.set(0, 1.12, 0.15);
      const bladeMat = new T.MeshStandardMaterial({ color: 0x0d0d0f, roughness: 0.6, metalness: 0.2 });
      const hub = new T.Mesh(new T.CylinderGeometry(0.16, 0.2, 0.14, 14), darkMat);
      mainRotor.add(hub);
      for (let bi = 0; bi < 4; bi++) {
        const bl = new T.Mesh(R.roundedBox(7.0, 0.05, 0.26, 0.02), bladeMat);
        bl.position.set(0, 0, 0);
        bl.rotation.y = bi * Math.PI / 2;
        // 桨叶沿长度方向（x）；绕 y 旋转排布四叶
        const holder = new T.Group();
        holder.rotation.y = bi * Math.PI / 2;
        bl.position.x = 3.5;
        bl.rotation.y = 0;
        holder.add(bl);
        mainRotor.add(holder);
      }
      g.add(mainRotor);

      // 尾梁（锥形，向后上抬）
      const boom = tubeZ(g, bodyMat, 0.34, 0.16, 2.2, 0, 0.28, 2.35, 14);
      boom.rotation.x = -0.12;
      // 垂直尾翼 + 水平安定面
      rb(g, panelMat, 0.1, 0.72, 0.5, 0.1, 0, 0.72, 3.35, 0, 0, 0);
      rb(g, panelMat, 0.9, 0.08, 0.4, 0.04, 0, 0.5, 3.3);
      // 尾桨（侧置，绕 X 轴自旋）
      const tailRotor = new T.Group();
      tailRotor.position.set(0.28, 0.78, 3.4);
      const trHub = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 0.12, 10), darkMat);
      trHub.rotation.z = Math.PI / 2; tailRotor.add(trHub);
      for (let ti = 0; ti < 3; ti++) {
        const tb = new T.Mesh(R.roundedBox(0.06, 1.0, 0.12, 0.02), bladeMat);
        const th = new T.Group(); th.rotation.x = ti * Math.PI * 2 / 3; tb.position.y = 0.5; th.add(tb); tailRotor.add(th);
      }
      g.add(tailRotor);

      // 短翼 + 火箭发射巢（武装直升机特征）
      function stubWing(side) {
        const grp = new T.Group();
        rb(grp, panelMat, 0.9, 0.14, 0.5, 0.06, side * 0.7, 0, 0);
        const pod = new T.Mesh(new T.CylinderGeometry(0.14, 0.14, 0.7, 12), darkMat);
        pod.rotation.x = Math.PI / 2; pod.position.set(side * 1.05, -0.12, -0.1); grp.add(pod);
        for (let ri = 0; ri < 4; ri++) {
          const rk = new T.Mesh(new T.CylinderGeometry(0.04, 0.04, 0.2, 6), steelMat);
          rk.rotation.x = Math.PI / 2;
          const a = ri * Math.PI / 2;
          rk.position.set(side * 1.05 + Math.cos(a) * 0.08, -0.12 + Math.sin(a) * 0.08, -0.45); grp.add(rk);
        }
        return grp;
      }
      g.add(stubWing(-1), stubWing(1));

      // 双滑橇起落架
      function skid(side) {
        const grp = new T.Group();
        const rail = tubeZ(grp, steelMat, 0.06, 0.06, 2.4, side * 0.6, -1.05, -0.1, 10);
        const up = new T.Mesh(R.cylZ(0.05, 0.05, 0.5, 8), steelMat); up.rotation.x = 0.5; up.position.set(side * 0.6, -0.8, -0.7); grp.add(up);
        const dn = new T.Mesh(R.cylZ(0.05, 0.05, 0.5, 8), steelMat); dn.rotation.x = -0.5; dn.position.set(side * 0.6, -0.8, 0.5); grp.add(dn);
        return grp;
      }
      g.add(skid(-1), skid(1));

      // 机腹机炮（保留原发射锚点位置 ~ (0,-0.44,-1.2)）
      const gun = tubeZ(g, darkMat, 0.07, 0.07, 0.8, 0, -0.44, -1.0, 10);
      const gunTip = new T.Mesh(new T.SphereGeometry(0.06, 8, 8), new T.MeshBasicMaterial({ color: 0xff5533 }));
      gunTip.position.set(0, -0.44, -1.4); g.add(gunTip);

      // 航行灯
      const navL = new T.Mesh(new T.SphereGeometry(0.06, 8, 8), new T.MeshBasicMaterial({ color: 0xff3333 })); navL.position.set(-0.6, 0.2, 0.1); g.add(navL);
      const navR = new T.Mesh(new T.SphereGeometry(0.06, 8, 8), new T.MeshBasicMaterial({ color: 0x33ff55 })); navR.position.set(0.6, 0.2, 0.1); g.add(navR);

      g.userData = {
        kind: 'helicopter',
        health: cfg.health || 150,
        maxHealth: cfg.health || 150,
        damage: cfg.damage || 14,
        shootCooldown: cfg.shootCooldown || 3.2,
        shootTimer: 1.6,
        speed: cfg.speed || 3.2,
        hoverBase: cfg.hoverY || 11,
        orbitPhase: Math.random() * 6.28,
        mainRotor: mainRotor,
        tailRotor: tailRotor,
        dead: false,
        deathTimer: 0,
        respawnReady: false,
        // v11.18 迫降/驾驶状态
        landing: false,     // 被击落但改为坠地迫降（不空中爆炸）
        landed: false,      // 已停在地面，玩家可按 E 登机
        playerPiloting: false,   // 玩家正在驾驶
        projectiles: []
      };
      return g;
    },

    onHit: function (inst, point, ctx) {
      const u = inst.userData;
      if (u.dead) return false;
      const dmg = (ctx && ctx.currentDamage) || 15;
      u.health -= dmg;
      u.hitFlash = 0.12;
      if (ctx && ctx.sfx) ctx.sfx.playHit();
      if (ctx && ctx.spawnSparks && point) ctx.spawnSparks(point.clone(), 0xffaa44);
      if (u.health <= 0) {
        // v11.18 杀满 3 只猪头佳后，玩家击毁直升机 30% 概率改为"迫降"（坠地可登机）而非空中爆炸
        if (ctx && ctx.heliShouldLand && ctx.heliShouldLand()) {
          u.health = 0;
          u.landing = true;
          u.dead = false;
          if (ctx.sfx) ctx.sfx.playDeath();
          if (ctx.onHelicopterLanding) ctx.onHelicopterLanding();
          return false;
        }
        u.dead = true;
        u.deathTimer = 0;
        if (ctx && ctx.sfx) ctx.sfx.playDeath();
        if (ctx && ctx.onHelicopterKilled) ctx.onHelicopterKilled(inst.position.clone());
      }
      return false;
    },

    update: function (inst, dt, ctx) {
      const T = global.THREE;
      const u = inst.userData;
      const player = ctx.player;
      if (!player) return;

      // ---- 导弹/火箭弹更新 ----
      for (let i = u.projectiles.length - 1; i >= 0; i--) {
        const b = u.projectiles[i];
        b.life -= dt;
        b.mesh.position.addScaledVector(b.vel, dt);
        const dx = b.mesh.position.x - player.pos.x;
        const dz = b.mesh.position.z - player.pos.z;
        const dy = b.mesh.position.y - player.pos.y;
        if (dx * dx + dz * dz < 1.5 * 1.5 && dy > -0.5 && dy < 2.5) {
          if (ctx.explode) ctx.explode(b.mesh.position.clone(), 3.5, 600, { nuke: false });
          if (ctx.hitPlayer) ctx.hitPlayer(u.damage * 0.5);
          if (ctx.spawnSparks) ctx.spawnSparks(b.mesh.position.clone(), 0xff6633);
          ctx.scene.remove(b.mesh);
          u.projectiles.splice(i, 1);
          continue;
        }
        if (b.life <= 0 || b.mesh.position.y < 0.2) {
          if (ctx.spawnSparks) ctx.spawnSparks(b.mesh.position.clone(), 0xff6633);
          ctx.scene.remove(b.mesh);
          u.projectiles.splice(i, 1);
        }
      }

      // ---- v11.18 玩家驾驶中：AI 全权由主程序接管，这里只维持旋翼视觉旋转 ----
      // v11.21 驾驶时隐藏旋翼（螺旋桨严重遮挡第一人称视野）
      if (u.playerPiloting) {
        if (u.mainRotor) u.mainRotor.visible = false;
        if (u.tailRotor) u.tailRotor.visible = false;
        return;
      }

      // ---- v11.18 迫降：冒烟下坠、旋翼减速，触地后转为可登机的落地态 ----
      if (u.landing) {
        if (u.mainRotor) u.mainRotor.visible = true;
        if (u.tailRotor) u.tailRotor.visible = true;
        const gy = (ctx.groundY ? ctx.groundY(inst.position.x, inst.position.z) : 0) + 1.05;
        inst.position.y -= dt * 9;
        inst.rotation.z += dt * 1.4;
        u.mainRotor.rotation.y += dt * 10;
        u.tailRotor.rotation.x += dt * 6;
        if (ctx.spawnSmoke && Math.random() < 0.5) ctx.spawnSmoke(inst.position.clone(), 0x555555);
        if (inst.position.y <= gy) {
          inst.position.y = gy;
          inst.rotation.z = 0.06;   // 轻微侧倾停在地面
          u.landing = false;
          u.landed = true;
          u.health = 0;
          if (ctx.onHelicopterLanded) ctx.onHelicopterLanded(inst);
          if (ctx.sfx) ctx.sfx.playExplode();
        }
        return;
      }

      // ---- v11.18 落地待登机：静止、旋翼缓停、不攻击 ----
      if (u.landed) {
        if (u.mainRotor) u.mainRotor.visible = true;
        if (u.tailRotor) u.tailRotor.visible = true;
        u.mainRotor.rotation.y += dt * 2.5;
        u.tailRotor.rotation.x += dt * 3;
        return;
      }

      if (u.dead) {
        u.deathTimer += dt;
        inst.position.y -= dt * 7.5;
        inst.rotation.z += dt * 2.6;
        inst.rotation.x += dt * 1.3;
        u.mainRotor.rotation.y += dt * 3.5;
        if (u.deathTimer > 0.45 && !u.exploded) {
          u.exploded = true;
          if (ctx.explode) ctx.explode(inst.position.clone(), 6, 0, { nuke: false });
          if (ctx.spawnDebris) ctx.spawnDebris(inst.position, 22, 0.9, 0x3a4a3a);
        }
        if (u.deathTimer >= 2.4) u.respawnReady = true;
        return;
      }

      // ---- 悬停追踪：围绕玩家轨道低飞 ----
      u.orbitPhase += dt * 0.35;
      const tx = player.pos.x + Math.cos(u.orbitPhase) * 16;
      const tz = player.pos.z - 12 + Math.sin(u.orbitPhase) * 10;
      const ty = u.hoverBase + Math.sin(u.orbitPhase * 1.3) * 1.8;
      const target = new T.Vector3(tx, ty, tz);
      inst.position.lerp(target, Math.min(1, dt * 0.85));

      const fdx = tx - inst.position.x;
      const fdz = tz - inst.position.z;
      if (fdx * fdx + fdz * fdz > 0.01) inst.rotation.y = Math.atan2(fdx, fdz);

      // 旋翼：主旋翼绕竖直轴(Y)，尾桨绕侧向轴(X)
      u.mainRotor.rotation.y += dt * 26;
      u.tailRotor.rotation.x += dt * 34;

      // ---- 开火：机腹发射火箭弹 ----
      u.shootTimer -= dt;
      if (u.shootTimer <= 0 && !player.dead) {
        u.shootTimer = u.shootCooldown;
        if (ctx && ctx.sfx) ctx.sfx.playEnemyShot();

        const muzzle = new T.Vector3(0, -0.46, -1.2);
        inst.localToWorld(muzzle);

        const aim = new T.Vector3(
          player.pos.x - muzzle.x,
          (player.pos.y + 0.9) - muzzle.y,
          player.pos.z - muzzle.z
        );
        const dist = aim.length();
        aim.normalize();

        if (ctx.spawnTracer) {
          ctx.spawnTracer(muzzle, muzzle.clone().addScaledVector(aim, Math.min(dist, 18)), 0xff4422);
        }

        const body = new T.Mesh(
          new T.CylinderGeometry(0.11, 0.09, 0.55, 8),
          new T.MeshBasicMaterial({ color: 0xff5511 })
        );
        body.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), aim.clone());
        body.position.copy(muzzle);
        const flame = new T.Mesh(
          new T.ConeGeometry(0.1, 0.5, 8),
          new T.MeshBasicMaterial({ color: 0xffcc22 })
        );
        flame.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), aim.clone());
        flame.position.copy(muzzle).addScaledVector(aim, -0.45);
        body.add(flame);
        ctx.scene.add(body);
        u.projectiles.push({ mesh: body, vel: aim.multiplyScalar(22), life: 4.5 });
      }
    }
  };
})(window);
