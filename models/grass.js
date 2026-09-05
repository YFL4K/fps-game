/**
 * grass.js — 草地/花丛模型（v6.7 场景美化）
 * 注册: window.MODELS.grass
 * 圆形草皮 + 草簇 + 彩色小花，贴地铺展，随机旋转
 * 配置: scale 随机缩放
 */
(function (global) {
  global.MODELS = global.MODELS || {};
  global.MODELS.grass = {
    name: 'grass',
    create: function (config) {
      const T = global.THREE;
      const g = new T.Group();
      // v6.7 修复：config.scale 可能是数组 [x,y,z]，取第一个分量
      const sc = config && config.scale;
      const s = (Array.isArray(sc) ? (sc[0] || 1) : (sc || 1)) * 1.6;

      const baseMat = new T.MeshStandardMaterial({ color: 0x4c8c3f, roughness: 1, metalness: 0 });
      const tuftMat = new T.MeshStandardMaterial({ color: 0x6aa84f, roughness: 1, metalness: 0 });
      const flowerColors = [0xf4c542, 0xe86b5e, 0x9b59b6, 0x5dade2];

      // 草皮基底（扁圆柱）
      const base = new T.Mesh(new T.CylinderGeometry(1.4 * s, 1.5 * s, 0.1 * s, 14), baseMat);
      base.position.y = 0.05 * s;
      base.receiveShadow = true;
      g.add(base);

      // 草簇
      for (let i = 0; i < 9; i++) {
        const ang = Math.random() * Math.PI * 2;
        const rad = Math.random() * 1.1 * s;
        const tuft = new T.Mesh(new T.ConeGeometry(0.16 * s, 0.55 * s, 5), tuftMat);
        tuft.position.set(Math.cos(ang) * rad, 0.28 * s, Math.sin(ang) * rad);
        tuft.rotation.z = (Math.random() - 0.5) * 0.25;
        tuft.rotation.x = (Math.random() - 0.5) * 0.25;
        tuft.castShadow = true;
        g.add(tuft);
      }

      // 小花（茎 + 花头）
      for (let i = 0; i < 6; i++) {
        const ang = Math.random() * Math.PI * 2;
        const rad = Math.random() * 1.1 * s;
        const stem = new T.Mesh(new T.CylinderGeometry(0.02 * s, 0.02 * s, 0.4 * s, 4), tuftMat);
        stem.position.set(Math.cos(ang) * rad, 0.2 * s, Math.sin(ang) * rad);
        g.add(stem);
        const head = new T.Mesh(new T.SphereGeometry(0.09 * s, 6, 5), new T.MeshStandardMaterial({ color: flowerColors[i % flowerColors.length], roughness: 0.7 }));
        head.position.set(Math.cos(ang) * rad, 0.42 * s, Math.sin(ang) * rad);
        g.add(head);
      }

      g.userData = {};
      return g;
    }
  };
})(window);
