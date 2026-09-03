/**
 * weapon.js — 武器拾取物模型（程序化，旋转悬浮，掉落在地面）
 * 注册: window.MODELS.weapon
 * 类型: config.type = 'pistol' | 'rifle' | 'shotgun' | 'sniper'（决定外观/颜色）
 * 挂载点: 模型中心悬浮（layout position.y ≈ 0.8）
 * 拾取逻辑在主程序 applyPickup（kind === 'weapon'）
 */
(function (global) {
  global.MODELS = global.MODELS || {};

  var GUN_LOOK = {
    pistol:  { color: 0xd35400, len: 0.4 },
    rifle:   { color: 0x2e8b57, len: 0.62 },
    shotgun: { color: 0x8b4513, len: 0.55 },
    sniper:  { color: 0x1e90ff, len: 0.8 }
  };

  global.MODELS.weapon = {
    name: 'weapon',

    create: function (config) {
      const T = global.THREE;
      const type = (config && config.type) || 'rifle';
      const look = GUN_LOOK[type] || GUN_LOOK.rifle;
      const L = look.len;
      const g = new T.Group();

      const bodyMat = new T.MeshStandardMaterial({
        color: 0x22252b,
        roughness: 0.45,
        metalness: 0.7,
        emissive: 0x000000
      });
      const accentMat = new T.MeshStandardMaterial({
        color: look.color,
        roughness: 0.4,
        metalness: 0.6,
        emissive: look.color,
        emissiveIntensity: 0.5
      });

      // 枪身（水平放置，悬浮）
      const body = new T.Mesh(new T.BoxGeometry(0.07, 0.1, L), bodyMat);
      body.castShadow = true;
      g.add(body);

      // 枪管
      const barrel = new T.Mesh(new T.CylinderGeometry(0.022, 0.022, L * 0.55, 8), bodyMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0, -L * 0.75);
      g.add(barrel);

      // 握把
      const grip = new T.Mesh(new T.BoxGeometry(0.05, 0.14, 0.06), bodyMat);
      grip.position.set(0, -0.1, L * 0.15);
      grip.rotation.x = 0.2;
      g.add(grip);

      // 弹匣（彩色标识）
      const mag = new T.Mesh(new T.BoxGeometry(0.045, 0.13, 0.07), accentMat);
      mag.position.set(0, -0.15, 0);
      mag.rotation.x = -0.1;
      g.add(mag);

      // 准星
      const sight = new T.Mesh(new T.BoxGeometry(0.015, 0.035, 0.015), accentMat);
      sight.position.set(0, 0.06, -L * 0.3);
      g.add(sight);

      // 发光光环（区分类型）
      const ringMat = new T.MeshBasicMaterial({
        color: look.color,
        transparent: true,
        opacity: 0.7
      });
      const ring = new T.Mesh(new T.TorusGeometry(0.3, 0.02, 8, 24), ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = -0.15;
      g.add(ring);

      g.userData = { baseY: 0, phase: Math.random() * 6.28, type: type };
      return g;
    },

    update: function (inst, dt, ctx) {
      const u = inst.userData;
      if (u.baseY === 0 && ctx && ctx.spawnPos) u.baseY = ctx.spawnPos.y;
      u.phase += dt * 2;
      inst.position.y = u.baseY + Math.sin(u.phase) * 0.14;
      inst.rotation.y += dt * 1.6;
      inst.rotation.x = Math.sin(u.phase * 0.5) * 0.12;
    }
  };
})(window);
