/**
 * chest.js — 宝箱模型（程序化，击杀敌人随机掉落）
 * 注册: window.MODELS.chest
 *
 * config.kind = 'chest'（主程序 checkPickups → applyChest 决定道具效果）
 * 打开后可随机获得 4 种道具之一：速度+ / 火力+200% / 生命+200% / 核弹
 * 更新：自转 + 轻微浮动 + 金色光柱
 */
(function (global) {
  global.MODELS = global.MODELS || {};

  global.MODELS.chest = {
    name: 'chest',

    create: function () {
      const T = global.THREE;
      const g = new T.Group();

      const woodMat = new T.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 0.72, metalness: 0.15 });
      const goldMat = new T.MeshStandardMaterial({
        color: 0xf1c40f, roughness: 0.25, metalness: 0.9,
        emissive: 0x7a5c00, emissiveIntensity: 0.5
      });
      const glowMat = new T.MeshBasicMaterial({
        color: 0xffe27a, transparent: true, opacity: 0.45,
        side: T.DoubleSide, depthWrite: false
      });

      // 箱底
      const base = new T.Mesh(new T.BoxGeometry(0.9, 0.55, 0.62), woodMat);
      base.position.y = 0.275;
      base.castShadow = true;
      base.receiveShadow = true;
      g.add(base);

      // 箱盖
      const lid = new T.Mesh(new T.BoxGeometry(0.9, 0.3, 0.62), woodMat);
      lid.position.y = 0.55 + 0.15;
      lid.castShadow = true;
      g.add(lid);

      // 金色包边（左右立柱 + 顶部横条）
      const postL = new T.Mesh(new T.BoxGeometry(0.07, 0.86, 0.64), goldMat);
      postL.position.set(-0.455, 0.43, 0);
      const postR = postL.clone();
      postR.position.x = 0.455;
      const postF = new T.Mesh(new T.BoxGeometry(0.92, 0.86, 0.07), goldMat);
      postF.position.set(0, 0.43, 0.305);
      const postB = postF.clone();
      postB.position.z = -0.305;
      g.add(postL, postR, postF, postB);

      // 金色锁扣
      const lock = new T.Mesh(new T.BoxGeometry(0.16, 0.18, 0.07), goldMat);
      lock.position.set(0, 0.5, 0.345);
      g.add(lock);

      // 内部金色光晕（从箱口溢出）
      const core = new T.Mesh(
        new T.BoxGeometry(0.7, 0.08, 0.46),
        new T.MeshBasicMaterial({ color: 0xffe680 })
      );
      core.position.y = 0.58;
      g.add(core);

      // 光柱
      const beam = new T.Mesh(new T.CylinderGeometry(0.26, 0.42, 3.4, 14, 1, true), glowMat);
      beam.position.y = 1.9;
      g.add(beam);

      g.userData = { kind: 'chest', phase: Math.random() * 6.28, baseY: 0 };
      return g;
    },

    update: function (inst, dt, ctx) {
      const u = inst.userData;
      if (u.baseY === 0 && ctx && ctx.spawnPos) u.baseY = ctx.spawnPos.y;
      u.phase += dt * 1.8;
      inst.rotation.y += dt * 1.1;
      inst.position.y = u.baseY + Math.sin(u.phase) * 0.07;
    }
  };
})(window);
