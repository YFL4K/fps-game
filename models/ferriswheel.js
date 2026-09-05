/**
 * ferriswheel.js — 摩天轮模型（v6.7 场景美化）
 * 注册: window.MODELS.ferriswheel
 * 大型摩天轮：A 型支腿 + 巨型轮盘 + 辐条 + 吊舱，轮盘缓慢旋转
 * 配置: scale 缩放；update 驱动轮盘自转
 */
(function (global) {
  global.MODELS = global.MODELS || {};
  global.MODELS.ferriswheel = {
    name: 'ferriswheel',
    create: function (config) {
      const T = global.THREE;
      const g = new T.Group();
      // v6.7 修复：config.scale 可能是数组 [x,y,z]，取第一个分量
      const sc = config && config.scale;
      const s = Array.isArray(sc) ? (sc[0] || 1) : (sc || 1);

      const steel = new T.MeshStandardMaterial({ color: 0x5a6a7d, roughness: 0.55, metalness: 0.75 });
      const accent = new T.MeshStandardMaterial({ color: 0xe0563a, roughness: 0.5, metalness: 0.4 });
      const cabinMat = new T.MeshStandardMaterial({ color: 0x2f80c4, roughness: 0.5, metalness: 0.35 });
      const R = 6.5 * s;   // 轮盘半径
      const HUB = 13.5 * s; // 轮心高度

      // A 型支腿 ×2
      for (let side = -1; side <= 1; side += 2) {
        const leg = new T.Mesh(new T.CylinderGeometry(0.22 * s, 0.3 * s, 9 * s, 8), steel);
        leg.position.set(side * 1.7 * s, 9 * s - 2.5 * s, 0);
        leg.rotation.z = -side * 0.32;
        leg.castShadow = true;
        g.add(leg);
        const leg2 = new T.Mesh(new T.CylinderGeometry(0.2 * s, 0.28 * s, 7.5 * s, 8), steel);
        leg2.position.set(side * 0.6 * s, 7.5 * s - 2 * s, 0.9 * s);
        leg2.rotation.z = -side * 0.12;
        leg2.castShadow = true;
        g.add(leg2);
      }

      // 轮盘组（自转）
      const wheel = new T.Group();
      wheel.position.set(0, HUB, 0);

      // 外轮缘（双环）
      const rimA = new T.Mesh(new T.TorusGeometry(R, 0.14 * s, 8, 36), steel);
      rimA.rotation.y = Math.PI / 2;
      wheel.add(rimA);
      const rimB = new T.Mesh(new T.TorusGeometry(R * 0.96, 0.1 * s, 8, 36), steel);
      rimB.rotation.y = Math.PI / 2;
      wheel.add(rimB);

      // 辐条 + 吊舱
      const spokes = 12;
      for (let i = 0; i < spokes; i++) {
        const ang = (i / spokes) * Math.PI * 2;
        const spoke = new T.Mesh(new T.CylinderGeometry(0.06 * s, 0.06 * s, R, 5), steel);
        spoke.rotation.z = Math.PI / 2;
        spoke.rotation.y = ang;
        spoke.position.set(Math.cos(ang) * R / 2, Math.sin(ang) * R / 2, 0);
        wheel.add(spoke);

        // 吊舱
        const cabin = new T.Group();
        const box = new T.Mesh(new T.BoxGeometry(0.9 * s, 0.7 * s, 0.8 * s), cabinMat);
        cabin.add(box);
        const roof = new T.Mesh(new T.BoxGeometry(1.0 * s, 0.12 * s, 0.9 * s), accent);
        roof.position.y = 0.4 * s;
        cabin.add(roof);
        cabin.position.set(Math.cos(ang) * R, Math.sin(ang) * R, 0);
        cabin.rotation.z = -ang; // 吊舱保持水平（旋转补偿）
        wheel.add(cabin);
      }

      // 轮心
      const hub = new T.Mesh(new T.CylinderGeometry(0.5 * s, 0.5 * s, 0.6 * s, 10), accent);
      hub.rotation.x = Math.PI / 2;
      wheel.add(hub);
      const hubcap = new T.Mesh(new T.SphereGeometry(0.55 * s, 10, 8), steel);
      wheel.add(hubcap);

      g.add(wheel);

      g.userData = { wheel: wheel, spin: (Math.random() - 0.5) * 0.15, phase: Math.random() * 6.28 };
      return g;
    },
    update: function (inst, dt, ctx) {
      const u = inst.userData;
      if (u.wheel) u.wheel.rotation.z += u.spin * dt * 0.6;
    }
  };
})(window);
