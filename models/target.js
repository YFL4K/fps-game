/**
 * target.js — 射击靶模型（程序化同心圆靶面）
 * 注册: window.MODELS.target
 * 默认尺寸: 靶面半径 0.9，支柱高 1.4，底部在原点
 * 接口: onHit(inst, point, ctx) — 命中反馈（变色 + 重置）
 */
(function (global) {
  global.MODELS = global.MODELS || {};
  global.MODELS.target = {
    name: 'target',
    create: function () {
      const T = global.THREE;
      const g = new T.Group();

      // 支柱
      const pole = new T.Mesh(
        new T.CylinderGeometry(0.05, 0.08, 1.4, 10),
        new T.MeshStandardMaterial({ color: 0x555a66, roughness: 0.6, metalness: 0.5 })
      );
      pole.position.y = 0.7;
      g.add(pole);

      // 底座
      const base = new T.Mesh(
        new T.CylinderGeometry(0.28, 0.34, 0.08, 12),
        new T.MeshStandardMaterial({ color: 0x33373f, roughness: 0.7, metalness: 0.4 })
      );
      base.position.y = 0.04;
      g.add(base);

      // 靶面：同心圆（从外到内）
      const rings = [
        { r: 0.9, c: 0xffffff },
        { r: 0.7, c: 0xd62828 },
        { r: 0.5, c: 0xffffff },
        { r: 0.3, c: 0xd62828 },
        { r: 0.14, c: 0x111111 }
      ];
      const face = new T.Group();
      rings.forEach(ring => {
        const m = new T.Mesh(
          new T.CircleGeometry(ring.r, 24),
          new T.MeshStandardMaterial({ color: ring.c, roughness: 0.7, metalness: 0.1, side: T.DoubleSide })
        );
        m.position.z = 0.02;
        face.add(m);
      });
      face.position.set(0, 1.4, 0);
      face.rotation.x = 0; // 靶面默认朝 +Z
      g.add(face);

      // 受击反馈：整组闪白
      g.userData = { face: face, hitFlash: 0, materials: [] };
      face.traverse(o => { if (o.isMesh) g.userData.materials.push(o.material); });
      return g;
    },
    onHit: function (inst, point, ctx) {
      const u = inst.userData;
      u.hitFlash = 0.15;
      if (ctx && ctx.sfx) ctx.sfx.playHit();
    },
    update: function (inst, dt) {
      const u = inst.userData;
      if (u.hitFlash > 0) {
        u.hitFlash -= dt;
        const k = u.hitFlash / 0.15;
        u.materials.forEach(m => { m.emissive.setHex(0xffffff); m.emissiveIntensity = k * 2; });
      } else {
        u.materials.forEach(m => { m.emissive.setHex(0x000000); m.emissiveIntensity = 0; });
      }
    }
  };
})(window);
