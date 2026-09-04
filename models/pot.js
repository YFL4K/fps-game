/**
 * pot.js — 花盆模型（程序化）
 * 注册: window.MODELS.pot
 * 挂载点: 底部中心在原点
 * config: size 'small' | 'large'，color 花盆颜色
 */
(function (global) {
  global.MODELS = {};
  global.MODELS.pot = {
    name: 'pot',
    create: function (config) {
      const T = global.THREE;
      const cfg = config || {};
      const isLarge = cfg.size === 'large';
      const scale = isLarge ? 1.5 : 1.0;
      const potColor = cfg.color || 0x8b4513;

      const g = new T.Group();
      const potMat = new T.MeshStandardMaterial({ color: potColor, roughness: 0.85, metalness: 0.05 });
      const soilMat = new T.MeshStandardMaterial({ color: 0x3d2817, roughness: 0.95 });
      const plantMat = new T.MeshStandardMaterial({ color: 0x228b22, roughness: 0.8 });

      // 花盆主体（截锥体）
      const potBody = new T.Mesh(
        new T.CylinderGeometry(0.35 * scale, 0.25 * scale, 0.5 * scale, 12),
        potMat
      );
      potBody.position.y = 0.25 * scale;
      potBody.castShadow = true;
      g.add(potBody);

      // 盆口边缘
      const rim = new T.Mesh(
        new T.TorusGeometry(0.35 * scale, 0.04 * scale, 8, 16),
        potMat
      );
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.5 * scale;
      g.add(rim);

      // 土壤
      const soil = new T.Mesh(
        new T.CylinderGeometry(0.32 * scale, 0.32 * scale, 0.05 * scale, 12),
        soilMat
      );
      soil.position.y = 0.47 * scale;
      g.add(soil);

      // 植物（根据大小选择）
      if (isLarge) {
        // 大型：多片叶子
        for (let i = 0; i < 5; i++) {
          const leaf = new T.Mesh(
            new T.SphereGeometry(0.18 * scale, 8, 6),
            plantMat
          );
          leaf.scale.set(1, 0.5, 1.4);
          const angle = (i / 5) * Math.PI * 2;
          leaf.position.set(
            Math.sin(angle) * 0.15 * scale,
            0.7 * scale + Math.random() * 0.15 * scale,
            Math.cos(angle) * 0.15 * scale
          );
          leaf.rotation.z = Math.sin(angle) * 0.3;
          leaf.rotation.x = Math.cos(angle) * 0.3;
          leaf.castShadow = true;
          g.add(leaf);
        }
        // 中心花
        const flower = new T.Mesh(
          new T.SphereGeometry(0.12 * scale, 8, 8),
          new T.MeshStandardMaterial({ color: 0xff6b9d, roughness: 0.6 })
        );
        flower.position.y = 0.85 * scale;
        g.add(flower);
      } else {
        // 小型：单株小植物
        const stem = new T.Mesh(
          new T.CylinderGeometry(0.02 * scale, 0.02 * scale, 0.35 * scale, 6),
          plantMat
        );
        stem.position.y = 0.65 * scale;
        g.add(stem);
        const leaf = new T.Mesh(
          new T.SphereGeometry(0.1 * scale, 6, 6),
          plantMat
        );
        leaf.scale.set(1, 0.6, 1);
        leaf.position.y = 0.8 * scale;
        g.add(leaf);
      }

      g.userData = { entityId: 'pot-' + Date.now() };
      return g;
    }
  };
})(window);
