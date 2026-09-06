/**
 * gatling.js — 加特林机枪碉堡模型（v7.4 重做）
 * 注册: window.MODELS.gatling
 * 固定机位：混凝土底座 + 三脚枪架 + 粗电机枪身 + 6 管裸露转管 + 供弹机构 + 弹药箱弹链
 * 玩家按 E 进入站桩射击（30 秒无限子弹）→ 超温冷却 30 秒
 * update: 转管组绕枪轴旋转（开火时加速）+ 状态灯（就绪青/使用黄/冷却红）
 *
 * v7.4 造型设计（不再像"圆台+沙袋"的路障，突出真实加特林机枪特征）：
 *  - 低矮混凝土定位底座（不挡枪线）
 *  - 重型三脚架：前二后一钢支腿（明显枪架）
 *  - 主枪身：横置粗圆筒电机外壳 + 后置矩形机匣（供弹口在上方）
 *  - 枪管束：6 根细长钢管环形排列 + 前后锁环 + 枪口收束环
 *  - 金色弹链：从侧面弹药箱引出，绕进供弹口
 *  - 顶部提把 + 瞄准镜座 + 枪口状态灯
 * 各部件垂直分层/前后错开，避免穿模。
 */
(function (global) {
  global.MODELS = global.MODELS || {};
  global.MODELS.gatling = {
    name: 'gatling',
    create: function (config) {
      const T = global.THREE;
      const g = new T.Group();

      const conMat = new T.MeshStandardMaterial({ color: 0x6e6b61, roughness: 0.92, metalness: 0.06 });
      const steelMat = new T.MeshStandardMaterial({ color: 0x41474f, roughness: 0.4, metalness: 0.82 });
      const gunMat = new T.MeshStandardMaterial({ color: 0x2c3138, roughness: 0.5, metalness: 0.6 });
      const darkMat = new T.MeshStandardMaterial({ color: 0x1c2024, roughness: 0.55, metalness: 0.55 });
      const brassMat = new T.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.35, metalness: 0.75 });
      const boxMat = new T.MeshStandardMaterial({ color: 0x55603a, roughness: 0.8, metalness: 0.12 });
      const accentMat = new T.MeshStandardMaterial({ color: 0xe06a1f, roughness: 0.5, metalness: 0.3 });

      // ========== 底座（低矮定位圆台，不遮挡枪口） ==========
      const base = new T.Mesh(new T.CylinderGeometry(0.95, 1.15, 0.2, 12), conMat);
      base.position.y = 0.1;
      base.castShadow = true;
      base.receiveShadow = true;
      g.add(base);

      // ========== 重型三脚架：前二后一 ==========
      const legMat = steelMat;
      const legFrontL = new T.Mesh(new T.CylinderGeometry(0.05, 0.06, 0.8, 8), legMat);
      legFrontL.rotation.z = 0.42;
      legFrontL.position.set(-0.42, 0.42, 0.35);
      g.add(legFrontL);
      const legFrontR = new T.Mesh(new T.CylinderGeometry(0.05, 0.06, 0.8, 8), legMat);
      legFrontR.rotation.z = -0.42;
      legFrontR.position.set(0.42, 0.42, 0.35);
      g.add(legFrontR);
      const legRear = new T.Mesh(new T.CylinderGeometry(0.05, 0.06, 0.85, 8), legMat);
      legRear.rotation.z = Math.PI - 0.5;
      legRear.position.set(0, 0.44, -0.45);
      g.add(legRear);

      // ========== 炮塔组（可水平旋转 + 枪管组绕枪轴旋转） ==========
      const turret = new T.Group();
      turret.position.y = 0.86;

      // 主枪身：横置粗圆筒电机外壳（Z 轴朝前）
      const housing = new T.Mesh(new T.CylinderGeometry(0.2, 0.2, 1.25, 14), gunMat);
      housing.rotation.x = Math.PI / 2;          // 横躺
      housing.position.set(0, 0.02, 0.1);
      turret.add(housing);
      // 散热环（电机外壳上的凸环，枪身特征）
      for (let ri = 0; ri < 4; ri++) {
        const ring = new T.Mesh(new T.CylinderGeometry(0.235, 0.235, 0.05, 12), darkMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(0, 0.02, -0.35 + ri * 0.32);
        turret.add(ring);
      }
      // 后置机匣（矩形枪身块：供弹口、保险盖等）
      const receiver = new T.Mesh(new T.BoxGeometry(0.42, 0.34, 0.5), gunMat);
      receiver.position.set(0, 0.1, -0.62);
      turret.add(receiver);
      const feedTop = new T.Mesh(new T.BoxGeometry(0.16, 0.14, 0.3), darkMat);
      feedTop.position.set(0, 0.34, -0.62);
      turret.add(feedTop);
      const sidePlate = new T.Mesh(new T.BoxGeometry(0.05, 0.22, 0.3), accentMat);
      sidePlate.position.set(0.24, 0.08, -0.62);
      turret.add(sidePlate);

      // 枪管束：6 管（沿 Z 轴朝前，环形排列）
      const barrelGroup = new T.Group();
      const B = 6;
      for (let i = 0; i < B; i++) {
        const ang = (i / B) * Math.PI * 2;
        const barrel = new T.Mesh(new T.CylinderGeometry(0.042, 0.05, 1.55, 8), darkMat);
        barrel.rotation.x = Math.PI / 2;          // 沿 Z
        barrel.position.set(Math.sin(ang) * 0.165, 0.02 + Math.cos(ang) * 0.165, 0.62);
        barrelGroup.add(barrel);
      }
      // 前锁环（靠近枪口）+ 后锁环（根部）+ 枪口收束环
      const frontRing = new T.Mesh(new T.CylinderGeometry(0.27, 0.27, 0.12, 10), steelMat);
      frontRing.rotation.x = Math.PI / 2;
      frontRing.position.set(0, 0.02, 1.28);
      barrelGroup.add(frontRing);
      const rearRing = new T.Mesh(new T.CylinderGeometry(0.25, 0.25, 0.1, 10), steelMat);
      rearRing.rotation.x = Math.PI / 2;
      rearRing.position.set(0, 0.02, 0.02);
      barrelGroup.add(rearRing);
      const muzzle = new T.Mesh(new T.CylinderGeometry(0.17, 0.09, 0.16, 10), accentMat);
      muzzle.rotation.x = Math.PI / 2;
      muzzle.position.set(0, 0.02, 1.5);
      barrelGroup.add(muzzle);
      turret.add(barrelGroup);

      // 顶部提把 + 瞄准镜座
      const handle = new T.Mesh(new T.BoxGeometry(0.05, 0.14, 0.34), darkMat);
      handle.position.set(0, 0.38, 0.1);
      handle.rotation.z = 0;
      turret.add(handle);
      const handleTop = new T.Mesh(new T.BoxGeometry(0.1, 0.05, 0.3), darkMat);
      handleTop.position.set(0, 0.46, 0.1);
      turret.add(handleTop);
      const sight = new T.Mesh(new T.BoxGeometry(0.05, 0.07, 0.18), steelMat);
      sight.position.set(0, 0.44, 0.55);
      turret.add(sight);

      // ========== 弹药箱 + 金色弹链（地面侧面） ==========
      const ammo = new T.Mesh(new T.BoxGeometry(0.62, 0.4, 0.44), boxMat);
      ammo.position.set(0.85, 0.2, -0.7);
      ammo.rotation.y = 0.35;
      g.add(ammo);
      const ammoLid = new T.Mesh(new T.BoxGeometry(0.66, 0.06, 0.48), darkMat);
      ammoLid.position.set(0.85, 0.42, -0.7);
      ammoLid.rotation.y = 0.35;
      g.add(ammoLid);
      // 弹链：小段椭圆链节，从弹箱到供弹口（3 段）
      for (let li = 0; li < 3; li++) {
        const belt = new T.Mesh(new T.SphereGeometry(0.055, 8, 6), brassMat);
        belt.scale.set(1, 0.7, 1.6);
        const t = li / 2;
        belt.position.set(0.6 - t * 0.28, 0.3 + t * 0.55, -0.32 + t * (-0.32));
        g.add(belt);
      }

      // 枪口状态灯（青色 = 就绪）
      const light = new T.Mesh(new T.SphereGeometry(0.07, 8, 6), new T.MeshBasicMaterial({ color: 0x66ccff }));
      light.position.set(0, 0.18, 1.68);
      turret.add(light);

      g.add(turret);

      g.userData = {
        kind: 'gatling',
        turret: turret,
        barrels: barrelGroup,
        light: light,
        spin: 0,
        phase: Math.random() * 6.28
      };
      return g;
    },
    update: function (inst, dt, ctx) {
      const u = inst.userData;
      if (!u || !u.turret) return;
      u.phase += dt;
      // 开火时转管加速旋转
      const active = !!(ctx && ctx.gatlingActive);
      u.spin += dt * (active ? 60 : 2.5);
      if (u.barrels) u.barrels.rotation.z = u.spin;   // 绕枪轴（Z）旋转
      // 炮塔朝向由主程序在 enterGatling 时设置（rotation.y）
      // 灯：使用中黄色、冷却红色、就绪青色
      if (u.light) {
        if (ctx && ctx.gatlingCooldown) u.light.material.color.setHex(0xff5544);
        else if (active) u.light.material.color.setHex(0xffcc44);
        else u.light.material.color.setHex(0x66ccff);
      }
    }
  };
})(window);