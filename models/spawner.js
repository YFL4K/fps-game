/**
 * spawner.js — 刷怪点模型（程序化发光传送门）
 * 注册: window.MODELS.spawner
 * 默认: 直径 2 的发光环 + 光柱；update 做旋转/脉冲
 */
(function (global) {
  global.MODELS = global.MODELS || {};
  global.MODELS.spawner = {
    name: 'spawner',
    create: function () {
      const T = global.THREE;
      const g = new T.Group();

      const ringMat = new T.MeshBasicMaterial({ color: 0xaa55ff, transparent: true, opacity: 0.9 });
      const ring = new T.Mesh(new T.TorusGeometry(1.0, 0.08, 10, 32), ringMat);
      ring.rotation.x = Math.PI / 2;
      g.add(ring);

      const inner = new T.Mesh(
        new T.TorusGeometry(0.7, 0.04, 8, 24),
        new T.MeshBasicMaterial({ color: 0xff66cc, transparent: true, opacity: 0.8 })
      );
      inner.rotation.x = Math.PI / 2;
      g.add(inner);

      // 光柱
      const pillar = new T.Mesh(
        new T.CylinderGeometry(0.9, 0.9, 3, 16, 1, true),
        new T.MeshBasicMaterial({
          color: 0xaa55ff, transparent: true, opacity: 0.15,
          side: T.DoubleSide, depthWrite: false
        })
      );
      pillar.position.y = 1.5;
      g.add(pillar);

      g.userData = { ring: ring, inner: inner, pillar: pillar, phase: 0 };
      return g;
    },
    update: function (inst, dt) {
      const u = inst.userData;
      u.phase += dt * 2;
      u.inner.rotation.z += dt * 3;
      u.pillar.material.opacity = 0.12 + Math.sin(u.phase) * 0.06;
      u.ring.scale.setScalar(1 + Math.sin(u.phase * 1.3) * 0.05);
    }
  };
})(window);
