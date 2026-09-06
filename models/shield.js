/**
 * shield.js — 金色盾牌防御道具（v6.9）
 * 注册: window.MODELS.shield
 * 击杀任何敌人 20% 掉落，拾取后 30 秒护盾：
 *   - 减少敌人对玩家 90% 伤害
 *   - 期间每击杀 1 名敌人 +2 秒（上限 60 秒）
 *   - 超时效果消失
 * 外观：金色圆盾（悬浮旋转 + 上下浮动）
 */
(function (global) {
  global.MODELS = global.MODELS || {};

  global.MODELS.shield = {
    name: 'shield',

    create: function (config) {
      const T = global.THREE;
      const g = new T.Group();

      const gold = new T.MeshStandardMaterial({
        color: 0xf5c518, roughness: 0.3, metalness: 0.75,
        emissive: 0x8a6d00, emissiveIntensity: 0.55
      });
      const goldDark = new T.MeshStandardMaterial({
        color: 0xb8860b, roughness: 0.35, metalness: 0.7,
        emissive: 0x5a4600, emissiveIntensity: 0.45
      });

      // 盾面（扁圆柱）
      const face = new T.Mesh(new T.CylinderGeometry(0.24, 0.26, 0.05, 20), gold);
      face.rotation.x = Math.PI / 2;
      face.position.y = 0.05;
      g.add(face);

      // 边缘环
      const rim = new T.Mesh(new T.TorusGeometry(0.25, 0.02, 8, 24), goldDark);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.05;
      g.add(rim);

      // 中心凸起（圆帽）
      const boss = new T.Mesh(new T.SphereGeometry(0.07, 10, 8), goldDark);
      boss.position.set(0, 0.11, 0);
      g.add(boss);

      // 十字浮雕（横竖两条）
      const barH = new T.Mesh(new T.BoxGeometry(0.28, 0.02, 0.016), goldDark);
      barH.position.set(0, 0.075, 0);
      g.add(barH);
      const barV = new T.Mesh(new T.BoxGeometry(0.02, 0.28, 0.016), goldDark);
      barV.position.set(0, 0.075, 0);
      g.add(barV);

      // 发光光晕（提示可拾取）
      const glow = new T.Mesh(new T.RingGeometry(0.22, 0.32, 24),
        new T.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.35, side: T.DoubleSide, depthWrite: false }));
      glow.rotation.x = -Math.PI / 2;
      glow.position.y = 0.02;
      g.add(glow);

      g.userData = {
        kind: 'shield',
        phase: Math.random() * 6.28,
        baseY: 0.5
      };
      return g;
    },

    update: function (inst, dt, ctx) {
      const u = inst.userData;
      if (!u) return;
      u.phase += dt;
      inst.rotation.y += dt * 2.4;
      inst.position.y = u.baseY + Math.sin(u.phase * 2.6) * 0.09;
    }
  };
})(window);
