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
      const isLaser = (kind === 'laserblock');
      const g = new T.Group();

      // v11.49 激光能量块：紫蓝色六面能量晶体
      const baseMat = new window.MARIO.matS({
        color: isFlame ? 0xe74c3c : (kind === 'health' ? 0x27ae60 : (isLaser ? 0xcc44ff : 0xf39c12)),
        emissive: isFlame ? 0xc0392b : (kind === 'health' ? 0x1e8449 : (isLaser ? 0x6622cc : 0xb9770e)),
        emissiveIntensity: isLaser ? 1.2 : 0.6,
      });

      // 立方体核心
      const core = new T.Mesh(new T.BoxGeometry(0.32, 0.32, 0.32), baseMat);
      core.castShadow = true;
      g.add(core);

      // 十字标记（激光能量块换成闪电十字）
      const markMat = new window.MARIO.matS({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: isLaser ? 1.4 : 0.8 });
      const m1 = new T.Mesh(new T.BoxGeometry(0.38, 0.1, 0.1), markMat);
      const m2 = new T.Mesh(new T.BoxGeometry(0.1, 0.38, 0.1), markMat);
      const m3 = new T.Mesh(new T.BoxGeometry(0.1, 0.1, 0.38), markMat);
      g.add(m1, m2, m3);
      if (isLaser) {
        // 激光块：闪电倾斜 + 内层发光球
        m1.rotation.z = 0.4;
        m2.rotation.z = -0.4;
        const inner = new T.Mesh(
          new T.SphereGeometry(0.16, 12, 10),
          new window.MARIO.basicS({ color: 0xffffff, transparent: true, opacity: 0.7 })
        );
        g.add(inner);
      }

      // 光环（激光能量块用双环）
      const ringMat = new window.MARIO.basicS({
        color: isFlame ? 0xff8844 : (kind === 'health' ? 0x7dffc0 : (isLaser ? 0xee88ff : 0xffe08a))
      });
      const ring = new T.Mesh(
        new T.TorusGeometry(0.28, isLaser ? 0.04 : 0.025, isLaser ? 12 : 8, 24),
        ringMat
      );
      ring.rotation.x = Math.PI / 2;
      g.add(ring);
      if (isLaser) {
        const ring2 = new T.Mesh(
          new T.TorusGeometry(0.42, 0.015, 8, 24),
          new window.MARIO.basicS({ color: 0x66ddff, transparent: true, opacity: 0.6 })
        );
        ring2.rotation.x = Math.PI / 2;
        ring2.rotation.z = 0.3;
        g.add(ring2);
      }

      g.userData = { baseY: 0, phase: Math.random() * 6.28, isLaser: isLaser };
      return g;
    },
    update: function (inst, dt, ctx) {
      const u = inst.userData;
      if (u.baseY === 0) {
              // v11.12 以主程序贴地后写回的 groundBase 为准（ctx.spawnPos 是共享暂存位，懒抓会抓到别的实体）
              if (inst.userData && inst.userData.groundBase != null) u.baseY = inst.userData.groundBase;
              else if (ctx && ctx.spawnPos) u.baseY = ctx.spawnPos.y;
            }
      u.phase += dt * (u.isLaser ? 3 : 2);
      inst.position.y = u.baseY + Math.sin(u.phase) * 0.12;
      inst.rotation.y += dt * (u.isLaser ? 2.5 : 1.5);
      inst.rotation.x = Math.sin(u.phase * 0.5) * 0.1;
    }
  };
})(window);
