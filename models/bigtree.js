/**
 * bigtree.js — 大型树木模型（v6.7 场景美化）
 * 注册: window.MODELS.bigtree
 * 高大粗壮的老树：粗树干 + 虬曲根部 + 多层树冠（球形树冠）
 * 配置: scale 随机缩放
 */
(function (global) {
  global.MODELS = global.MODELS || {};
  global.MODELS.bigtree = {
    name: 'bigtree',
    create: function (config) {
      const T = global.THREE;
      const g = new T.Group();
      const s = (config && config.scaleX) || 1;

      const trunkMat = new T.MeshStandardMaterial({ color: 0x5d4030, roughness: 0.95, metalness: 0 });
      const branchMat = new T.MeshStandardMaterial({ color: 0x4e342e, roughness: 0.95, metalness: 0 });
      const leafMat = new T.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.9, metalness: 0 });
      const leafMat2 = new T.MeshStandardMaterial({ color: 0x388e3c, roughness: 0.9, metalness: 0 });

      // 粗树干（锥形）
      const trunk = new T.Mesh(new T.CylinderGeometry(0.55 * s, 0.85 * s, 5.4 * s, 9), trunkMat);
      trunk.position.y = 2.7 * s;
      trunk.castShadow = true;
      g.add(trunk);

      // 根部隆起
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * Math.PI * 2;
        const root = new T.Mesh(new T.CylinderGeometry(0.22 * s, 0.4 * s, 1.2 * s, 6), trunkMat);
        root.position.set(Math.cos(ang) * 0.75 * s, 0.5 * s, Math.sin(ang) * 0.75 * s);
        root.rotation.z = Math.cos(ang) * 0.5;
        root.rotation.x = -Math.sin(ang) * 0.5;
        g.add(root);
      }

      // 主干分叉
      const b1 = new T.Mesh(new T.CylinderGeometry(0.32 * s, 0.45 * s, 3.0 * s, 8), branchMat);
      b1.position.set(0.25 * s, 6.2 * s, 0.1 * s);
      b1.rotation.z = -0.35;
      b1.castShadow = true;
      g.add(b1);
      const b2 = new T.Mesh(new T.CylinderGeometry(0.26 * s, 0.38 * s, 2.6 * s, 8), branchMat);
      b2.position.set(-0.3 * s, 6.0 * s, -0.15 * s);
      b2.rotation.z = 0.4;
      b2.rotation.x = 0.1;
      b2.castShadow = true;
      g.add(b2);

      // 多层球形树冠
      const canopies = [
        { p: [0, 8.6, 0], r: 2.2, m: leafMat },
        { p: [0.9, 7.9, 0.5], r: 1.7, m: leafMat2 },
        { p: [-0.8, 8.1, -0.4], r: 1.6, m: leafMat },
        { p: [0.1, 9.7, 0], r: 1.4, m: leafMat2 },
        { p: [0.5, 7.6, -0.8], r: 1.2, m: leafMat }
      ];
      for (let i = 0; i < canopies.length; i++) {
        const c = canopies[i];
        const ball = new T.Mesh(new T.SphereGeometry(c.r * s, 10, 8), c.m);
        ball.position.set(c.p[0] * s, c.p[1] * s, c.p[2] * s);
        ball.castShadow = true;
        g.add(ball);
      }

      g.userData = {};
      return g;
    }
  };
})(window);
