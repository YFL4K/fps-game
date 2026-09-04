/**
 * container.js — 货运集装箱模型（程序化）
 * 注册: window.MODELS.container
 * 挂载点: 底部中心在原点
 * config: size '20ft' | '40ft'，color 颜色
 */
(function (global) {
  global.MODELS = global.MODELS || {};
  global.MODELS.container = {
    name: 'container',
    create: function (config) {
      const T = global.THREE;
      const cfg = config || {};
      const is40ft = cfg.size === '40ft';
      const w = is40ft ? 2.6 : 2.4;
      const d = is40ft ? 12.0 : 6.0;
      const h = 2.6;
      const color = cfg.color || 0x2e5a8c;

      const g = new T.Group();
      const containerMat = new T.MeshStandardMaterial({ color: color, roughness: 0.7, metalness: 0.3 });
      const corrugMat = new T.MeshStandardMaterial({ color: new T.Color(color).multiplyScalar(0.85).getHex(), roughness: 0.8, metalness: 0.2 });
      const doorMat = new T.MeshStandardMaterial({ color: new T.Color(color).lerp(new T.Color(0xffffff), 0.15).getHex(), roughness: 0.6, metalness: 0.3 });
      const cornerMat = new T.MeshStandardMaterial({ color: 0x222222, roughness: 0.5, metalness: 0.7 });
      const wheelMat = new T.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });

      // 主体（波纹板效果用分段Box模拟）
      const body = new T.Mesh(new T.BoxGeometry(w, h, d), containerMat);
      body.position.y = h / 2 + 0.3;
      body.castShadow = true;
      body.receiveShadow = true;
      g.add(body);

      // 波纹纹理（横向线条）
      for (let i = -d/2 + 0.3; i < d/2; i += 0.4) {
        const rib = new T.Mesh(new T.BoxGeometry(w + 0.02, h + 0.02, 0.03), corrugMat);
        rib.position.set(0, h / 2 + 0.3, i);
        g.add(rib);
      }

      // 四个角件
      const corners = [
        [-w/2, 0.35, -d/2], [w/2, 0.35, -d/2],
        [-w/2, h + 0.25, -d/2], [w/2, h + 0.25, -d/2],
        [-w/2, 0.35, d/2], [w/2, 0.35, d/2],
        [-w/2, h + 0.25, d/2], [w/2, h + 0.25, d/2]
      ];
      corners.forEach(function (p) {
        const c = new T.Mesh(new T.BoxGeometry(0.15, 0.15, 0.15), cornerMat);
        c.position.set(p[0], p[1], p[2]);
        g.add(c);
      });

      // 后门（有门把手细节）
      const doorL = new T.Mesh(new T.BoxGeometry(w/2 - 0.05, h - 0.1, 0.06), doorMat);
      doorL.position.set(-w/4 - 0.025, h/2 + 0.3, d/2 + 0.03);
      g.add(doorL);
      const doorR = new T.Mesh(new T.BoxGeometry(w/2 - 0.05, h - 0.1, 0.06), doorMat);
      doorR.position.set(w/4 + 0.025, h/2 + 0.3, d/2 + 0.03);
      g.add(doorR);
      // 门把手
      const handle = new T.Mesh(new T.BoxGeometry(0.04, 0.5, 0.04), cornerMat);
      handle.position.set(0, h/2 + 0.3, d/2 + 0.08);
      g.add(handle);

      // 底盘框架
      const chassis = new T.Mesh(new T.BoxGeometry(w + 0.1, 0.15, d + 0.2), cornerMat);
      chassis.position.y = 0.22;
      g.add(chassis);

      // 轮子
      const wheelGeo = new T.CylinderGeometry(0.25, 0.25, 0.2, 12);
      [[-w/2 - 0.1, 0.25, -d/2 + 1], [w/2 + 0.1, 0.25, -d/2 + 1],
       [-w/2 - 0.1, 0.25, d/2 - 1], [w/2 + 0.1, 0.25, d/2 - 1]].forEach(function (p) {
        const wheel = new T.Mesh(wheelGeo, wheelMat);
        wheel.rotation.x = Math.PI / 2;
        wheel.position.set(p[0], p[1], p[2]);
        g.add(wheel);
      });

      g.userData = { entityId: 'container-' + Date.now() };
      return g;
    }
  };
})(window);
