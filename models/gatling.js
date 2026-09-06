/**
 * gatling.js — 加特林机枪碉堡模型（v6.8 站桩火力点）
 * 注册: window.MODELS.gatling
 * 固定机位：混凝土底座 + 沙袋掩体 + 弹药箱 + 6 管转管加特林炮塔
 * 玩家按 E 进入站桩射击（30 秒无限子弹）→ 超温冷却 30 秒
 * update: 转管组旋转（开火时加速）+ 炮塔朝向可被主程序设置
 */
(function (global) {
  global.MODELS = global.MODELS || {};
  global.MODELS.gatling = {
    name: 'gatling',
    create: function (config) {
      const T = global.THREE;
      const g = new T.Group();

      const conMat = new T.MeshStandardMaterial({ color: 0x7d7a70, roughness: 0.9, metalness: 0.08 });
      const sandMat = new T.MeshStandardMaterial({ color: 0x8a7a52, roughness: 1, metalness: 0 });
      const steelMat = new T.MeshStandardMaterial({ color: 0x3a3f47, roughness: 0.45, metalness: 0.75 });
      const darkMat = new T.MeshStandardMaterial({ color: 0x22262c, roughness: 0.5, metalness: 0.6 });
      const ammoMat = new T.MeshStandardMaterial({ color: 0x5d5a50, roughness: 0.8, metalness: 0.15 });
      const accentMat = new T.MeshStandardMaterial({ color: 0xd4a017, roughness: 0.4, metalness: 0.6, emissive: 0xd4a017, emissiveIntensity: 0.25 });

      // 底座（混凝土圆台）
      const base = new T.Mesh(new T.CylinderGeometry(1.35, 1.55, 0.55, 14), conMat);
      base.position.y = 0.27;
      base.castShadow = true;
      base.receiveShadow = true;
      g.add(base);

      // 沙袋掩体围一圈
      const bagCount = 10;
      for (let i = 0; i < bagCount; i++) {
        const ang = (i / bagCount) * Math.PI * 2;
        const bag = new T.Mesh(new T.BoxGeometry(0.5, 0.34, 0.34), sandMat);
        bag.position.set(Math.cos(ang) * 1.5, 0.55, Math.sin(ang) * 1.5);
        bag.rotation.y = -ang;
        g.add(bag);
      }
      // 沙袋第二层（前方部分留出射击口）
      for (let i = 3; i < 7; i++) {
        const ang = (i / bagCount) * Math.PI * 2;
        const bag = new T.Mesh(new T.BoxGeometry(0.5, 0.32, 0.32), sandMat);
        bag.position.set(Math.cos(ang) * 1.52, 0.88, Math.sin(ang) * 1.52);
        bag.rotation.y = -ang;
        g.add(bag);
      }

      // 炮塔组（可水平旋转）
      const turret = new T.Group();
      turret.position.y = 1.05;

      // 炮座立柱
      const post = new T.Mesh(new T.CylinderGeometry(0.16, 0.22, 0.7, 10), steelMat);
      post.position.y = 0.35;
      turret.add(post);

      // 6 管转管组
      const barrelGroup = new T.Group();
      const B = 6;
      for (let i = 0; i < B; i++) {
        const ang = (i / B) * Math.PI * 2;
        const barrel = new T.Mesh(new T.CylinderGeometry(0.045, 0.055, 1.25, 8), darkMat);
        // 枪管沿 Z 轴水平朝前，围绕 Z 轴均匀排列（平行组）
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(Math.cos(ang) * 0.16, 0.72, Math.sin(ang) * 0.16);
        barrelGroup.add(barrel);
      }
      // 前锁环 + 后锁环
      const frontRing = new T.Mesh(new T.CylinderGeometry(0.28, 0.28, 0.14, 10), steelMat);
      frontRing.rotation.x = Math.PI / 2;
      frontRing.position.set(0, 0.72, 0.62);
      barrelGroup.add(frontRing);
      const rearRing = new T.Mesh(new T.CylinderGeometry(0.26, 0.26, 0.12, 10), steelMat);
      rearRing.rotation.x = Math.PI / 2;
      rearRing.position.set(0, 0.72, -0.5);
      barrelGroup.add(rearRing);
      turret.add(barrelGroup);

      // 枪口锥
      const muzzle = new T.Mesh(new T.CylinderGeometry(0.1, 0.05, 0.18, 10), darkMat);
      muzzle.rotation.x = Math.PI / 2;
      muzzle.position.set(0, 0.72, 0.74);
      turret.add(muzzle);

      // 顶部电机罩
      const motor = new T.Mesh(new T.CylinderGeometry(0.16, 0.2, 0.3, 10), steelMat);
      motor.position.y = 1.02;
      turret.add(motor);
      const motorCap = new T.Mesh(new T.SphereGeometry(0.14, 8, 6), accentMat);
      motorCap.position.y = 1.2;
      turret.add(motorCap);

      // 弹药箱（侧面）
      const ammo = new T.Mesh(new T.BoxGeometry(0.6, 0.45, 0.5), ammoMat);
      ammo.position.set(1.05, 0.35, -0.4);
      g.add(ammo);
      const ammoBelt = new T.Mesh(new T.BoxGeometry(0.1, 0.06, 1.2), darkMat);
      ammoBelt.position.set(0.5, 0.62, 0.1);
      ammoBelt.rotation.y = 0.3;
      g.add(ammoBelt);

      // 枪口提示灯（青色 = 就绪）
      const light = new T.Mesh(new T.SphereGeometry(0.06, 8, 6), new T.MeshBasicMaterial({ color: 0x66ccff }));
      light.position.set(0, 1.5, 0.95);
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
      u.spin += dt * (active ? 55 : 2);
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
