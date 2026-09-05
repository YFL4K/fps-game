/**
 * pickup.js — 拾取物模型（程序化，旋转悬浮）
 * 注册: window.MODELS.pickup
 * 类型: config.kind = 'health' | 'ammo'（由 scene-layout 传入）
 * 默认尺寸: 0.5 x 0.5 x 0.5 中心悬浮在 origin；update 做旋转 + 上下浮动
 */
(function (global) {
  global.MODELS = global.MODELS || {};
  global.MODELS.pickup = {
    name: 'pickup',
    create: function (config) {
      const T = global.THREE;
      const kind = (config && config.kind) || 'health';
      const isFlame = !!(config && config.type === 'flame');
      const g = new T.Group();

      const baseMat = new T.MeshStandardMaterial({
        color: isFlame ? 0xe74c3c : (kind === 'health' ? 0x27ae60 : 0xf39c12),
        emissive: isFlame ? 0xc0392b : (kind === 'health' ? 0x1e8449 : 0xb9770e),
        emissiveIntensity: 0.6,
        roughness: 0.4,
        metalness: 0.3
      });

      // 立方体核心
      const core = new T.Mesh(new T.BoxGeometry(0.32, 0.32, 0.32), baseMat);
      core.castShadow = true;
      g.add(core);

      // 十字标记
      const markMat = new T.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.8 });
      const m1 = new T.Mesh(new T.BoxGeometry(0.38, 0.1, 0.1), markMat);
      const m2 = new T.Mesh(new T.BoxGeometry(0.1, 0.38, 0.1), markMat);
      const m3 = new T.Mesh(new T.BoxGeometry(0.1, 0.1, 0.38), markMat);
      g.add(m1, m2, m3);

      // 光环
      const ring = new T.Mesh(
        new T.TorusGeometry(0.28, 0.025, 8, 24),
        new T.MeshBasicMaterial({ color: isFlame ? 0xff8844 : (kind === 'health' ? 0x7dffc0 : 0xffe08a) })
      );
      ring.rotation.x = Math.PI / 2;
      g.add(ring);

      g.userData = { baseY: 0, phase: Math.random() * 6.28 };
      return g;
    },
    update: function (inst, dt, ctx) {
      const u = inst.userData;
      if (u.baseY === 0 && ctx && ctx.spawnPos) u.baseY = ctx.spawnPos.y;
      u.phase += dt * 2;
      inst.position.y = u.baseY + Math.sin(u.phase) * 0.12;
      inst.rotation.y += dt * 1.5;
      inst.rotation.x = Math.sin(u.phase * 0.5) * 0.1;
    }
  };
})(window);
