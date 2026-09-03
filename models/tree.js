/**
 * tree.js — 程序化树木（树干 + 多层树冠）
 * 注册: window.MODELS.tree
 * 挂载点: 树干底部中心在原点（position.y 表示地面高度）
 * config: scale 控制整体大小，color 树冠色
 */
(function (global) {
  global.MODELS = global.MODELS || {};
  global.MODELS.tree = {
    name: 'tree',
    create: function (config) {
      const T = global.THREE;
      const cfg = config || {};

      const trunkMat = new T.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.95, metalness: 0 });
      const leafMat = new T.MeshStandardMaterial({
        color: cfg.color || 0x2d6a3f,
        roughness: 0.85,
        metalness: 0
      });

      const g = new T.Group();

      // 树干
      const trunk = new T.Mesh(new T.CylinderGeometry(0.14, 0.22, 1.6, 7), trunkMat);
      trunk.position.y = 0.8;
      trunk.castShadow = true;
      g.add(trunk);

      // 树冠（三层锥体叠加）
      const sizes = [
        { r: 1.15, hgt: 1.5, y: 2.0 },
        { r: 0.85, hgt: 1.2, y: 2.9 },
        { r: 0.55, hgt: 0.9, y: 3.7 }
      ];
      sizes.forEach(function (s) {
        const cone = new T.Mesh(new T.ConeGeometry(s.r, s.hgt, 8), leafMat);
        cone.position.y = s.y;
        cone.castShadow = true;
        g.add(cone);
      });

      g.userData = {};
      return g;
    }
  };
})(window);
