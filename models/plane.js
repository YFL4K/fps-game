/**
 * plane.js — 停机坪飞机模型（程序化）
 * 注册: window.MODELS.plane
 * 挂载点: 机身底部中心在原点
 * config: color 机身颜色，scale 控制大小
 */
(function (global) {
  global.MODELS = global.MODELS || {};
  global.MODELS.plane = {
    name: 'plane',
    create: function (config) {
      const T = global.THREE;
      const cfg = config || {};
      const color = cfg.color || 0xe8e8e8;
      const stripeColor = cfg.color ? new T.Color(cfg.color).lerp(new T.Color(0x2244aa), 0.5).getHex() : 0x2244aa;

      const g = new T.Group();
      const bodyMat = new T.MeshStandardMaterial({ color: color, roughness: 0.35, metalness: 0.5 });
      const darkMat = new T.MeshStandardMaterial({ color: 0x222222, roughness: 0.6, metalness: 0.4 });
      const glassMat = new T.MeshStandardMaterial({ color: 0x3366aa, roughness: 0.1, metalness: 0.8, transparent: true, opacity: 0.65 });
      const wheelMat = new T.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });

      // 机身（圆柱体横放）
      const fuselage = new T.Mesh(new T.CylinderGeometry(0.75, 0.65, 8.0, 12), bodyMat);
      fuselage.rotation.z = Math.PI / 2;
      fuselage.position.set(0, 1.5, 0);
      fuselage.castShadow = true;
      g.add(fuselage);

      // 机头锥
      const nose = new T.Mesh(new T.ConeGeometry(0.65, 2.0, 12), bodyMat);
      nose.rotation.z = -Math.PI / 2;
      nose.position.set(5.0, 1.5, 0);
      g.add(nose);

      // 驾驶舱玻璃
      const cockpit = new T.Mesh(new T.SphereGeometry(0.6, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), glassMat);
      cockpit.position.set(3.5, 1.8, 0);
      g.add(cockpit);

      // 主翼
      const wing = new T.Mesh(new T.BoxGeometry(1.2, 0.12, 10.0), bodyMat);
      wing.position.set(0.5, 1.3, 0);
      wing.castShadow = true;
      g.add(wing);
      // 翼尖
      const wingTipL = new T.Mesh(new T.BoxGeometry(0.4, 0.8, 0.8), darkMat);
      wingTipL.position.set(0.3, 1.4, 5.2);
      const wingTipR = wingTipL.clone();
      wingTipR.position.z = -5.2;
      g.add(wingTipL, wingTipR);

      // 尾翼（水平）
      const tailWing = new T.Mesh(new T.BoxGeometry(0.6, 0.08, 3.0), bodyMat);
      tailWing.position.set(-3.5, 1.5, 0);
      g.add(tailWing);
      // 尾翼（垂直）
      const tailFin = new T.Mesh(new T.BoxGeometry(0.08, 1.2, 1.4), bodyMat);
      tailFin.position.set(-3.5, 2.2, 0);
      tailFin.castShadow = true;
      g.add(tailFin);

      // 引擎（左右各一）
      [-1.8, 1.8].forEach(function (z) {
        const engine = new T.Mesh(new T.CylinderGeometry(0.28, 0.25, 1.0, 10), darkMat);
        engine.rotation.z = Math.PI / 2;
        engine.position.set(-0.3, 1.0, z);
        g.add(engine);
      });

      // 起落架轮子
      const wheelGeo = new T.CylinderGeometry(0.28, 0.28, 0.2, 12);
      [[2.5, 0.28, 0], [-1.5, 0.28, 1.0], [-1.5, 0.28, -1.0], [3.0, 0.28, 0]].forEach(function (p) {
        const w = new T.Mesh(wheelGeo, wheelMat);
        w.rotation.x = Math.PI / 2;
        w.position.set(p[0], p[1], p[2]);
        g.add(w);
      });
      // 起落架支柱
      const strutMat = new T.MeshStandardMaterial({ color: 0x444444, metalness: 0.8 });
      [[2.5, 0.6, 0], [-1.5, 0.6, 1.0], [-1.5, 0.6, -1.0]].forEach(function (p) {
        const s = new T.Mesh(new T.CylinderGeometry(0.04, 0.04, 0.5, 6), strutMat);
        s.position.set(p[0], p[1], p[2]);
        g.add(s);
      });

      // 条纹装饰
      const stripe = new T.Mesh(new T.CylinderGeometry(0.77, 0.67, 7.8, 12, 1, true), 
        new T.MeshStandardMaterial({ color: stripeColor, roughness: 0.5, metalness: 0.3, side: T.DoubleSide }));
      stripe.rotation.z = Math.PI / 2;
      stripe.position.set(0, 1.6, 0);
      g.add(stripe);

      g.userData = { entityId: 'plane-' + Date.now() };
      return g;
    }
  };
})(window);
