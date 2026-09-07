/**
 * coconut.js — 巨大椰子树装饰模型（v8.5 新增，替代巨石 boulder）
 * 注册: window.MODELS.coconut
 *
 * 外观精美：微弯棕榈树干 + 放射状下垂棕榈叶（每叶多段）+ 挂果椰子。
 * 大/中/小三种尺寸由 config.variant（或 config.scale）控制。
 */
(function (global) {
  global.MODELS = global.MODELS || {};

  const SIZE = {
    large: 1.45,
    medium: 1.0,
    small: 0.62
  };

  global.MODELS.coconut = {
    name: 'coconut',

    create: function (config) {
      const T = global.THREE;
      const g = new T.Group();
      const cfg = config || {};
      const k = SIZE[cfg.variant] || SIZE.medium;

      const trunkMat = new T.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 0.85, metalness: 0, flatShading: true });
      const trunkDark = new T.MeshStandardMaterial({ color: 0x6e533a, roughness: 0.9, metalness: 0, flatShading: true });
      const leafMat = new T.MeshStandardMaterial({ color: 0x3a9d4a, roughness: 0.7, metalness: 0, flatShading: true });
      const leafLight = new T.MeshStandardMaterial({ color: 0x4cb55a, roughness: 0.7, metalness: 0, flatShading: true });
      const coconutMat = new T.MeshStandardMaterial({ color: 0x5a3d24, roughness: 0.7, metalness: 0, flatShading: true });

      const trunkH = 4.2 * k;

      // 微弯树干：3 段，逐段略偏（棕榈特征）
      const segCount = 3;
      let y = 0;
      for (let i = 0; i < segCount; i++) {
        const seg = new T.Mesh(
          new T.CylinderGeometry(0.16 * k * (1 - i * 0.12), 0.19 * k * (1 - i * 0.1), trunkH / segCount, 8),
          i % 2 === 0 ? trunkMat : trunkDark
        );
        seg.position.set(Math.sin(i * 0.35) * 0.5 * k, y + trunkH / segCount / 2, 0);
        seg.rotation.z = -Math.sin(i * 0.2) * 0.08;
        g.add(seg);
        y += trunkH / segCount;
      }

      // 树冠：放射状下垂棕榈叶（每叶 3 段 box 拼成弧线）
      const leafCount = 9;
      for (let i = 0; i < leafCount; i++) {
        const a = (i / leafCount) * Math.PI * 2;
        const leafGroup = new T.Group();
        const len = 1.7 * k;
        for (let s = 0; s < 3; s++) {
          const seg = new T.Mesh(
            new T.BoxGeometry(0.1 * k, 0.02 * k, len / 3),
            (i % 2 === 0 ? leafMat : leafLight)
          );
          // 每段向外伸展并下垂
          seg.position.set(0, -Math.sin(s * 0.5) * 0.25 * s, -(s + 0.5) * (len / 3));
          seg.rotation.x = 0.35 + s * 0.3;
          leafGroup.add(seg);
        }
        leafGroup.rotation.y = a;
        leafGroup.position.y = trunkH - 0.15 * k;
        g.add(leafGroup);
      }

      // 顶部嫩芽
      const bud = new T.Mesh(new T.SphereGeometry(0.12 * k, 6, 5), leafLight);
      bud.position.y = trunkH;
      g.add(bud);

      // 椰子（4 颗挂果）
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.4;
        const nut = new T.Mesh(new T.SphereGeometry(0.13 * k, 7, 6), coconutMat);
        nut.position.set(Math.cos(a) * 0.32 * k, trunkH - 0.35 * k, Math.sin(a) * 0.32 * k);
        g.add(nut);
      }

      g.userData = { kind: 'scenery' };
      return g;
    },

    update: function (inst, dt) {
      // 树冠轻微摆动（风）
      const u = inst.userData;
      u._t = (u._t || 0) + dt;
      inst.children.forEach(function (child, idx) {
        if (child.isGroup && child.children.length === 3) {
          child.rotation.z = Math.sin(u._t * 1.2 + idx) * 0.03;
        }
      });
    }
  };
})(window);
