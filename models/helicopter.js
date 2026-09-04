/**
 * helicopter.js — 空中直升机（程序化，随机出现攻击玩家）
 * 注册: window.MODELS.helicopter
 *
 * 行为：
 *   - 高空悬停，围绕玩家做缓慢轨道飞行
 *   - 周期性从机腹炮向玩家发射导弹（伤害高、速度慢、轨迹明显）
 *   - 被玩家击中 → 坠毁爆炸 → ctx.onHelicopterKilled(pos)（主程序负责掉落火箭筒）
 *
 * config: health / damage / shootCooldown / speed / hoverY
 * 死亡通过 inst.userData.respawnReady 通知主程序移除（cfg.respawn = 0 → 不重生）
 */
(function (global) {
  global.MODELS = global.MODELS || {};

  global.MODELS.helicopter = {
    name: 'helicopter',

    create: function (config) {
      const T = global.THREE;
      const cfg = config || {};
      const g = new T.Group();

      const bodyMat = new T.MeshStandardMaterial({ color: 0x3a4a3a, roughness: 0.45, metalness: 0.6 });
      const glassMat = new T.MeshStandardMaterial({
        color: 0x1b2b3a, roughness: 0.2, metalness: 0.7,
        emissive: 0x081822, emissiveIntensity: 0.55
      });
      const darkMat = new T.MeshStandardMaterial({ color: 0x14161a, roughness: 0.6, metalness: 0.5 });
      const redMat = new T.MeshStandardMaterial({
        color: 0xc0392b, emissive: 0x6a1010, emissiveIntensity: 0.6,
        roughness: 0.5, metalness: 0.4
      });

      // 机身
      const fuselage = new T.Mesh(new T.BoxGeometry(1.0, 0.8, 2.6), bodyMat);
      fuselage.castShadow = true;
      g.add(fuselage);

      // 驾驶舱玻璃
      const cabin = new T.Mesh(new T.BoxGeometry(0.82, 0.5, 1.05), glassMat);
      cabin.position.set(0, 0.2, -0.68);
      g.add(cabin);

      // 尾梁
      const tail = new T.Mesh(new T.BoxGeometry(0.28, 0.3, 2.0), bodyMat);
      tail.position.set(0, 0.15, 1.9);
      g.add(tail);

      // 尾翼
      const fin = new T.Mesh(new T.BoxGeometry(0.1, 0.62, 0.52), redMat);
      fin.position.set(0, 0.52, 2.68);
      g.add(fin);

      // 尾桨（两片）
      const tailRotor = new T.Group();
      tailRotor.position.set(0, 0.46, 2.76);
      const tr1 = new T.Mesh(new T.BoxGeometry(0.92, 0.05, 0.05), darkMat);
      const tr2 = new T.Mesh(new T.BoxGeometry(0.05, 0.92, 0.05), darkMat);
      tailRotor.add(tr1, tr2);
      g.add(tailRotor);

      // 主旋翼（长条叶片，高速旋转）
      const mainRotor = new T.Group();
      mainRotor.position.set(0, 0.62, 0);
      const bladeMat = new T.MeshStandardMaterial({ color: 0x0d0d0f, roughness: 0.6, metalness: 0.4 });
      const b1 = new T.Mesh(new T.BoxGeometry(6.2, 0.04, 0.22), bladeMat);
      const b2 = new T.Mesh(new T.BoxGeometry(0.22, 0.04, 6.2), bladeMat);
      mainRotor.add(b1, b2);
      // 旋翼毂
      const hub = new T.Mesh(new T.CylinderGeometry(0.12, 0.14, 0.2, 10), darkMat);
      hub.position.y = -0.05;
      mainRotor.add(hub);
      g.add(mainRotor);

      // 机头灯
      const lamp = new T.Mesh(
        new T.SphereGeometry(0.11, 8, 8),
        new T.MeshBasicMaterial({ color: 0xffe9b0 })
      );
      lamp.position.set(0, -0.05, -1.36);
      g.add(lamp);

      // 机腹攻击炮
      const gun = new T.Mesh(new T.CylinderGeometry(0.07, 0.07, 0.75, 8), darkMat);
      gun.rotation.x = Math.PI / 2;
      gun.position.set(0, -0.44, -0.8);
      g.add(gun);
      const gunTip = new T.Mesh(
        new T.SphereGeometry(0.055, 6, 6),
        new T.MeshBasicMaterial({ color: 0xff5533 })
      );
      gunTip.position.set(0, -0.44, -1.2);
      g.add(gunTip);

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
        projectiles: []
      };
      return g;
    },

    /** 玩家子弹命中；返回 false（直升机没有爆头概念） */
    onHit: function (inst, point, ctx) {
      const u = inst.userData;
      if (u.dead) return false;
      const dmg = (ctx && ctx.currentDamage) || 15;
      u.health -= dmg;
      u.hitFlash = 0.12;
      if (ctx && ctx.sfx) ctx.sfx.playHit();
      if (ctx && ctx.spawnSparks && point) ctx.spawnSparks(point.clone(), 0xffaa44);
      if (u.health <= 0) {
        u.dead = true;
        u.deathTimer = 0;
        if (ctx && ctx.sfx) ctx.sfx.playDeath();
        if (ctx && ctx.onHelicopterKilled) ctx.onHelicopterKilled(inst.position.clone());
      }
      return false;
    },

    /** 主程序每帧调用 */
    update: function (inst, dt, ctx) {
      const T = global.THREE;
      const u = inst.userData;
      const player = ctx.player;
      if (!player) return;

      // ---- 导弹更新 ----
      for (let i = u.projectiles.length - 1; i >= 0; i--) {
        const b = u.projectiles[i];
        b.life -= dt;
        b.mesh.position.addScaledVector(b.vel, dt);
        const dx = b.mesh.position.x - player.pos.x;
        const dz = b.mesh.position.z - player.pos.z;
        const dy = b.mesh.position.y - player.pos.y;
        if (dx * dx + dz * dz < 0.75 * 0.75 && dy > -0.5 && dy < 2.2) {
          if (ctx.hitPlayer) ctx.hitPlayer(u.damage);
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

      // ---- 死亡：坠毁 + 爆炸 ----
      if (u.dead) {
        u.deathTimer += dt;
        inst.position.y -= dt * 7.5;
        inst.rotation.z += dt * 2.6;
        inst.rotation.x += dt * 1.3;
        u.mainRotor.rotation.z += dt * 3.5;
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

      // 朝向飞行方向
      const fdx = tx - inst.position.x;
      const fdz = tz - inst.position.z;
      if (fdx * fdx + fdz * fdz > 0.01) inst.rotation.y = Math.atan2(fdx, fdz);

      // 旋翼
      u.mainRotor.rotation.z += dt * 26;
      u.tailRotor.rotation.z += dt * 34;

      // ---- 开火：机腹炮发射导弹 ----
      u.shootTimer -= dt;
      if (u.shootTimer <= 0 && !player.dead) {
        u.shootTimer = u.shootCooldown;
        if (ctx.sfx) ctx.sfx.playEnemyShot();

        const muzzle = new T.Vector3(0, -0.46, -1.2);
        inst.localToWorld(muzzle);

        const aim = new T.Vector3(
          player.pos.x - muzzle.x,
          (player.pos.y + 0.9) - muzzle.y,
          player.pos.z - muzzle.z
        );
        const dist = aim.length();
        aim.normalize();

        // 曳光
        if (ctx.spawnTracer) {
          ctx.spawnTracer(muzzle, muzzle.clone().addScaledVector(aim, Math.min(dist, 18)), 0xff6633);
        }

        // 导弹（发光长条 + 尾焰）
        const body = new T.Mesh(
          new T.CylinderGeometry(0.09, 0.09, 0.72, 8),
          new T.MeshBasicMaterial({ color: 0xff4422 })
        );
        body.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), aim.clone());
        body.position.copy(muzzle);
        const flame = new T.Mesh(
          new T.ConeGeometry(0.08, 0.4, 8),
          new T.MeshBasicMaterial({ color: 0xffcc44 })
        );
        flame.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), aim.clone());
        flame.position.copy(muzzle).addScaledVector(aim, -0.5);
        body.add(flame);
        ctx.scene.add(body);
        u.projectiles.push({ mesh: body, vel: aim.multiplyScalar(16), life: 5 });
      }
    }
  };
})(window);
