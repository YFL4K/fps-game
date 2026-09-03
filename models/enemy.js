/**
 * enemy.js — 敌人模型 + AI + 动画 + 子弹 + 爆头判定（全自包含）
 * 注册: window.MODELS.enemy
 *
 * 设计要点：
 * - 主程序完全不需要知道敌人内部逻辑，只需：
 *   1. create(config, ctx) 创建实例
 *   2. 每帧调用 update(inst, dt, ctx)（主程序通用实体循环）
 *   3. 射击命中时调用 onHit(inst, point, ctx)，返回 true 表示爆头
 *   4. 检测 inst.userData.respawnReady === true 后负责重建（respawn）
 * - 敌人会：双手持枪瞄准玩家、靠近后站定射击、受击闪红、爆头×3 伤害、死亡倒下
 * - 命中判定：圆柱体（水平距离 + 高度范围），修复旧版只比对脚底导致的“永远打不中”
 * - 子弹为发光长条 + 发射瞬间曳光，死亡时通过 ctx.onEnemyKilled 通知主程序计击杀/掉武器
 */
(function (global) {
  global.MODELS = global.MODELS || {};
  global.MODELS.enemy = {
    name: 'enemy',

    create: function (config) {
      const T = global.THREE;
      const cfg = config || {};
      const g = new T.Group();

      const matBody = new T.MeshStandardMaterial({ color: 0x3d5a80, roughness: 0.6, metalness: 0.3 });
      const matDark = new T.MeshStandardMaterial({ color: 0x293241, roughness: 0.7, metalness: 0.4 });
      const matEye = new T.MeshStandardMaterial({ color: 0xff3b3b, emissive: 0xff0000, emissiveIntensity: 1.5 });
      const matGun = new T.MeshStandardMaterial({ color: 0x1b1e23, roughness: 0.5, metalness: 0.6 });
      const matHand = new T.MeshStandardMaterial({ color: 0x2e3d52, roughness: 0.8, metalness: 0.1 });

      // 躯干
      const torso = new T.Mesh(new T.BoxGeometry(0.7, 0.9, 0.45), matBody);
      torso.position.y = 1.25;
      torso.castShadow = true;
      g.add(torso);

      // 头
      const head = new T.Mesh(new T.BoxGeometry(0.4, 0.4, 0.4), matDark);
      head.position.y = 1.9;
      head.castShadow = true;
      g.add(head);

      // 眼睛
      const eyeL = new T.Mesh(new T.BoxGeometry(0.09, 0.07, 0.03), matEye);
      eyeL.position.set(-0.11, 1.93, 0.21);
      const eyeR = new T.Mesh(new T.BoxGeometry(0.09, 0.07, 0.03), matEye);
      eyeR.position.set(0.11, 1.93, 0.21);
      g.add(eyeL, eyeR);

      // 双臂：前伸持枪（pivot 在肩膀，rotation 固定指向枪）
      const armPivotL = new T.Group();
      armPivotL.position.set(-0.42, 1.6, 0.05);
      armPivotL.rotation.x = -1.15;
      armPivotL.rotation.y = 0.18;
      const armL = new T.Mesh(new T.BoxGeometry(0.12, 0.62, 0.12), matDark);
      armL.position.y = -0.3;
      armL.castShadow = true;
      armPivotL.add(armL);
      g.add(armPivotL);

      const armPivotR = new T.Group();
      armPivotR.position.set(0.42, 1.6, 0.05);
      armPivotR.rotation.x = -1.15;
      armPivotR.rotation.y = -0.18;
      const armR = new T.Mesh(new T.BoxGeometry(0.12, 0.62, 0.12), matDark);
      armR.position.y = -0.3;
      armR.castShadow = true;
      armPivotR.add(armR);
      g.add(armPivotR);

      // 枪 pivot：双手之间的武器，射击时后坐
      const gunPivot = new T.Group();
      gunPivot.position.set(0, 1.42, 0.6);
      const gun = new T.Mesh(
        new T.BoxGeometry(0.1, 0.14, 0.7),
        matGun
      );
      gun.castShadow = true;
      gunPivot.add(gun);
      // 枪口（发光小圆点，视觉指示枪口位置）
      const tip = new T.Mesh(
        new T.SphereGeometry(0.05, 6, 6),
        new T.MeshBasicMaterial({ color: 0xff8844 })
      );
      tip.position.z = 0.36;
      gunPivot.add(tip);
      // 双手（放在枪上：左手托护木、右手握扳机）
      const handL = new T.Mesh(new T.BoxGeometry(0.14, 0.14, 0.16), matHand);
      handL.position.set(-0.12, -0.04, 0.06);
      gunPivot.add(handL);
      const handR = new T.Mesh(new T.BoxGeometry(0.14, 0.14, 0.16), matHand);
      handR.position.set(0.12, -0.04, -0.16);
      gunPivot.add(handR);
      g.add(gunPivot);

      // 腿（pivot 在髋部）
      const legPivotL = new T.Group();
      legPivotL.position.set(-0.2, 0.85, 0);
      const legL = new T.Mesh(new T.BoxGeometry(0.16, 0.85, 0.18), matDark);
      legL.position.y = -0.425;
      legL.castShadow = true;
      legPivotL.add(legL);
      g.add(legPivotL);

      const legPivotR = new T.Group();
      legPivotR.position.set(0.2, 0.85, 0);
      const legR = new T.Mesh(new T.BoxGeometry(0.16, 0.85, 0.18), matDark);
      legR.position.y = -0.425;
      legR.castShadow = true;
      legPivotR.add(legR);
      g.add(legPivotR);

      // 配置与运行时状态
      g.userData = {
        config: cfg,
        health: cfg.health || 100,
        maxHealth: cfg.health || 100,
        speed: cfg.speed || 1.5,
        damage: cfg.damage || 10,
        shootRange: cfg.shootRange || 20,
        shootCooldown: cfg.shootCooldown || 2,
        stopDist: 5,
        walkPhase: 0,
        hitFlash: 0,
        dead: false,
        deathTimer: 0,
        respawnReady: false,
        shootTimer: 0,
        bullets: [],
        bodyMat: torso.material,
        gunPivot: gunPivot,
        pivots: { armL: armPivotL, armR: armPivotR, legL: legPivotL, legR: legPivotR }
      };
      return g;
    },

    /** 主程序射击命中时调用；返回 true 表示爆头 */
    onHit: function (inst, point, ctx) {
      const u = inst.userData;
      if (u.dead) return false;
      // 爆头：命中点高于头部底部（头中心 y≈1.9，头半高 0.2）
      const headBottom = inst.position.y + 1.65;
      const head = !!(point && point.y > headBottom);
      const dmg = (ctx && ctx.currentDamage) || 15;
      const total = head ? dmg * 3 : dmg;
      u.health -= total;
      u.hitFlash = 0.15;
      if (ctx && ctx.sfx) {
        ctx.sfx.playHit();
        if (head) ctx.sfx.playHeadshot();
      }
      if (u.health <= 0) {
        u.dead = true;
        u.deathTimer = 0;
        if (ctx && ctx.sfx) ctx.sfx.playDeath();
        if (ctx && ctx.onEnemyKilled) ctx.onEnemyKilled(inst.position.clone());
      }
      return head;
    },

    /** 主程序每帧调用 */
    update: function (inst, dt, ctx) {
      const T = global.THREE;
      const u = inst.userData;
      const player = ctx.player;
      const pr = ctx.playerRadius || 0.5;
      const ph = ctx.playerHeight || 1.7;

      // ---- 子弹更新（圆柱体命中判定：水平距离 + 高度范围） ----
      for (let i = u.bullets.length - 1; i >= 0; i--) {
        const b = u.bullets[i];
        b.life -= dt;
        b.mesh.position.addScaledVector(b.vel, dt);
        const hdx = b.mesh.position.x - player.pos.x;
        const hdz = b.mesh.position.z - player.pos.z;
        const hd = Math.sqrt(hdx * hdx + hdz * hdz);
        const by = b.mesh.position.y;
        if (hd < pr + 0.15 && by > 0 && by < ph) {
          if (ctx.hitPlayer) ctx.hitPlayer(u.damage);
          ctx.scene.remove(b.mesh);
          u.bullets.splice(i, 1);
          continue;
        }
        if (b.life <= 0 || hd > u.shootRange * 2) {
          ctx.scene.remove(b.mesh);
          u.bullets.splice(i, 1);
        }
      }

      // ---- 死亡动画：倒下 + 下沉 ----
      if (u.dead) {
        u.deathTimer += dt;
        const k = Math.min(1, u.deathTimer / 1.2);
        inst.rotation.z = -k * Math.PI / 2;
        inst.position.y = -k * 0.4;
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

      // ---- 朝向玩家（只转 yaw） ----
      const dx = player.pos.x - inst.position.x;
      const dz = player.pos.z - inst.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      inst.rotation.y = Math.atan2(dx, dz);

      // ---- 移动：太远则靠近，够近则站定 ----
      let moving = false;
      if (dist > u.stopDist) {
        const move = u.speed * dt;
        inst.position.x += (dx / dist) * move;
        inst.position.z += (dz / dist) * move;
        moving = true;
      }

      // ---- 动画：持枪姿势（手臂固定前伸，枪口朝玩家），走路只摆腿 ----
      u.walkPhase += dt * (moving ? 8 : 2);
      const swing = Math.sin(u.walkPhase) * (moving ? 0.85 : 0.1);
      u.pivots.legL.rotation.x = -swing;
      u.pivots.legR.rotation.x = swing;
      // 持枪微晃（走路小幅，站定几乎静止）
      const aimK = moving ? 0.05 : 0.015;
      u.pivots.armL.rotation.x = -1.15 + Math.sin(u.walkPhase * 0.5) * aimK;
      u.pivots.armR.rotation.x = -1.15 - Math.sin(u.walkPhase * 0.5) * aimK;
      // 射击后坐恢复
      if (u.gunKick > 0) {
        u.gunKick -= dt * 8;
        u.gunPivot.position.z = 0.6 - Math.max(0, u.gunKick) * 0.12;
      } else {
        u.gunPivot.position.z = 0.6;
      }

      // ---- 射击：进入射程且冷却结束 ----
      u.shootTimer -= dt;
      if (dist < u.shootRange && u.shootTimer <= 0) {
        u.shootTimer = u.shootCooldown;
        if (ctx && ctx.sfx) ctx.sfx.playEnemyShot();
        u.gunKick = 1;

        // 枪口世界位置（枪 pivot 前方）
        const muzzle = new T.Vector3(0, 1.42, 0.98);
        inst.localToWorld(muzzle);

        // 朝玩家躯干（不是眼睛，命中判定是圆柱体）发射
        const aim = new T.Vector3(
          player.pos.x - muzzle.x,
          (player.pos.y + 0.9) - muzzle.y,
          player.pos.z - muzzle.z
        ).normalize();

        // 曳光弹（发射瞬间的亮线）
        if (ctx && ctx.spawnTracer) {
          const target = muzzle.clone().addScaledVector(aim, dist);
          ctx.spawnTracer(muzzle, target, 0xff6633);
        }

        // 发光长条子弹
        const bmesh = new T.Mesh(
          new T.CylinderGeometry(0.03, 0.03, 0.5, 6),
          new T.MeshBasicMaterial({ color: 0xffaa55 })
        );
        bmesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), aim.clone());
        bmesh.position.copy(muzzle);
        ctx.scene.add(bmesh);
        u.bullets.push({ mesh: bmesh, vel: aim.multiplyScalar(28), life: 3 });
      }
    }
  };
})(window);
