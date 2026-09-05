/**
 * walkie.js — 对讲机道具模型（v6.7 空袭呼叫道具）
 * 注册: window.MODELS.walkie
 * 外形：黑色/军绿色对讲机机身 + 天线 + 扬声器格栅 + 屏幕 + 红色通话键 + 旋钮
 * 悬浮旋转（同拾取物），带蓝色光晕提示
 * 使用：按 T 呼叫空中支援（1 次有效，重复拾取不累积）
 */
(function (global) {
  global.MODELS = global.MODELS || {};
  global.MODELS.walkie = {
    name: 'walkie',
    create: function (config) {
      const T = global.THREE;
      const g = new T.Group();

      const bodyMat = new T.MeshStandardMaterial({ color: 0x2f3b2f, roughness: 0.6, metalness: 0.35 });
      const darkMat = new T.MeshStandardMaterial({ color: 0x1a1f1a, roughness: 0.55, metalness: 0.3 });
      const accentMat = new T.MeshStandardMaterial({ color: 0xd9412e, roughness: 0.45, metalness: 0.4, emissive: 0xd9412e, emissiveIntensity: 0.35 });
      const screenMat = new T.MeshStandardMaterial({ color: 0x9fe8c8, emissive: 0x52d9a2, emissiveIntensity: 0.9, roughness: 0.3 });

      // 机身
      const body = new T.Mesh(new T.BoxGeometry(0.34, 0.6, 0.14), bodyMat);
      body.castShadow = true;
      g.add(body);
      // 顶部斜面 + 天线座
      const top = new T.Mesh(new T.BoxGeometry(0.3, 0.06, 0.12), darkMat);
      top.position.y = 0.31;
      g.add(top);
      const antenna = new T.Mesh(new T.CylinderGeometry(0.02, 0.03, 0.34, 6), darkMat);
      antenna.position.set(-0.08, 0.5, 0);
      g.add(antenna);
      const antennaTip = new T.Mesh(new T.SphereGeometry(0.03, 6, 5), accentMat);
      antennaTip.position.set(-0.08, 0.68, 0);
      g.add(antennaTip);

      // 扬声器格栅（正面）
      const grillMat = darkMat;
      for (let i = 0; i < 4; i++) {
        const slot = new T.Mesh(new T.BoxGeometry(0.24, 0.02, 0.02), grillMat);
        slot.position.set(0, 0.22 - i * 0.05, 0.075);
        g.add(slot);
      }
      // 屏幕
      const screen = new T.Mesh(new T.BoxGeometry(0.2, 0.12, 0.02), screenMat);
      screen.position.set(0, 0.02, 0.075);
      g.add(screen);

      // 红色通话键（侧面）
      const ptt = new T.Mesh(new T.BoxGeometry(0.08, 0.1, 0.16), accentMat);
      ptt.position.set(0.18, -0.05, 0);
      g.add(ptt);
      // 旋钮（顶部）
      const knob = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 0.05, 8), darkMat);
      knob.position.set(0.08, 0.34, 0);
      g.add(knob);

      // 底部充电触点
      const plug = new T.Mesh(new T.BoxGeometry(0.16, 0.03, 0.06), accentMat);
      plug.position.set(0, -0.32, 0);
      g.add(plug);

      // 光晕（提示可拾取）
      const ring = new T.Mesh(
        new T.TorusGeometry(0.34, 0.03, 8, 24),
        new T.MeshBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0.85 })
      );
      ring.rotation.x = Math.PI / 2;
      g.add(ring);
      const glow = new T.Mesh(
        new T.SphereGeometry(0.42, 10, 8),
        new T.MeshBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0.16 })
      );
      g.add(glow);

      g.userData = { baseY: 0, phase: Math.random() * 6.28 };
      return g;
    },
    update: function (inst, dt, ctx) {
      const u = inst.userData;
      if (u.baseY === 0 && ctx && ctx.spawnPos) u.baseY = ctx.spawnPos.y;
      u.phase += dt * 2;
      inst.position.y = u.baseY + Math.sin(u.phase) * 0.14;
      inst.rotation.y += dt * 1.6;
    }
  };
})(window);
