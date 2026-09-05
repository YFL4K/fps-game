/**
 * weapon.js — 武器拾取物模型（程序化，旋转悬浮，掉落在地面）
 * 注册: window.MODELS.weapon
 * 类型: config.type = 'pistol' | 'rifle' | 'flamethrower' | 'sniper' | 'rocket'
 * v6.7: 掉落模型按真实枪型微缩（沙鹰/AK-47/喷火罐/狙击镜/火箭筒），颜色标识类型
 * 挂载点: 模型中心悬浮（layout position.y ≈ 0.8）
 * 拾取逻辑在主程序 applyPickup（kind === 'weapon'）
 */
(function (global) {
  global.MODELS = global.MODELS || {};

  var GUN_LOOK = {
    pistol:  { color: 0xd35400, len: 0.4 },
    rifle:   { color: 0x2e8b57, len: 0.62 },
    flamethrower: { color: 0xff6600, len: 0.58 },
    sniper:  { color: 0x1e90ff, len: 0.8 },
    rocket:  { color: 0xd4a017, len: 0.72 }
  };

  global.MODELS.weapon = {
    name: 'weapon',

    create: function (config) {
      const T = global.THREE;
      const type = (config && config.type) || 'rifle';
      const look = GUN_LOOK[type] || GUN_LOOK.rifle;
      const L = look.len;
      const g = new T.Group();

      const bodyMat = new T.MeshStandardMaterial({ color: 0x22252b, roughness: 0.45, metalness: 0.7 });
      const accentMat = new T.MeshStandardMaterial({
        color: look.color, roughness: 0.4, metalness: 0.6,
        emissive: look.color, emissiveIntensity: 0.5
      });
      const woodMat = new T.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.85, metalness: 0.05 });

      // 枪身
      const body = new T.Mesh(new T.BoxGeometry(0.07, 0.1, L), bodyMat);
      body.castShadow = true;
      g.add(body);

      if (type === 'pistol') {
        // 沙鹰：方正滑套 + 大型握把
        const slide = new T.Mesh(new T.BoxGeometry(0.08, 0.09, L * 0.5), bodyMat);
        slide.position.z = -L * 0.15;
        g.add(slide);
        const grip = new T.Mesh(new T.BoxGeometry(0.08, 0.2, 0.1), accentMat);
        grip.position.set(0, -0.14, L * 0.12);
        grip.rotation.x = 0.2;
        g.add(grip);
      } else if (type === 'rifle') {
        // AK-47 特征：弧形弹匣 + 木护木 + 木枪托
        const mag = new T.Mesh(new T.BoxGeometry(0.06, 0.16, 0.09), accentMat);
        mag.position.set(0, -0.13, -L * 0.05);
        mag.rotation.x = -0.5;
        g.add(mag);
        const hg = new T.Mesh(new T.BoxGeometry(0.075, 0.07, L * 0.2), woodMat);
        hg.position.set(0, 0, -L * 0.35);
        g.add(hg);
        const stock = new T.Mesh(new T.BoxGeometry(0.06, 0.09, L * 0.22), woodMat);
        stock.position.set(0, 0, L * 0.38);
        g.add(stock);
        const barrel = new T.Mesh(new T.CylinderGeometry(0.022, 0.022, L * 0.4, 8), bodyMat);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0, -L * 0.75);
        g.add(barrel);
      } else if (type === 'sniper') {
        // 狙击：长管 + 高倍镜
        const barrel = new T.Mesh(new T.CylinderGeometry(0.02, 0.02, L * 0.6, 8), bodyMat);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0, -L * 0.72);
        g.add(barrel);
        const scope = new T.Mesh(new T.CylinderGeometry(0.035, 0.035, 0.16, 10), accentMat);
        scope.rotation.x = Math.PI / 2;
        scope.position.set(0, 0.07, -L * 0.1);
        g.add(scope);
      } else if (type === 'rocket') {
        // 火箭筒：粗管 + 喇叭口 + 弹头
        const tube = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, L, 10), bodyMat);
        tube.rotation.x = Math.PI / 2;
        g.add(tube);
        const flare = new T.Mesh(new T.CylinderGeometry(0.085, 0.05, 0.1, 10), bodyMat);
        flare.rotation.x = Math.PI / 2;
        flare.position.z = -L * 0.55;
        g.add(flare);
        const warhead = new T.Mesh(new T.CylinderGeometry(0.045, 0.028, 0.24, 10), accentMat);
        warhead.rotation.x = Math.PI / 2;
        warhead.position.z = L * 0.42;
        g.add(warhead);
      } else if (type === 'flamethrower') {
        // 喷火器：粗喷嘴 + 燃料罐
        const nozzle = new T.Mesh(new T.CylinderGeometry(0.04, 0.03, L * 0.4, 8), bodyMat);
        nozzle.rotation.x = Math.PI / 2;
        nozzle.position.z = -L * 0.6;
        g.add(nozzle);
        const tank = new T.Mesh(new T.CylinderGeometry(0.11, 0.11, 0.2, 10), accentMat);
        tank.rotation.x = Math.PI / 2;
        tank.position.z = L * 0.3;
        g.add(tank);
      } else {
        // 通用：枪管 + 握把
        const barrel = new T.Mesh(new T.CylinderGeometry(0.022, 0.022, L * 0.55, 8), bodyMat);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0, -L * 0.75);
        g.add(barrel);
        const grip = new T.Mesh(new T.BoxGeometry(0.05, 0.14, 0.06), bodyMat);
        grip.position.set(0, -0.1, L * 0.15);
        grip.rotation.x = 0.2;
        g.add(grip);
      }

      // 发光光环（区分类型）
      const ring = new T.Mesh(
        new T.TorusGeometry(0.32, 0.02, 8, 24),
        new T.MeshBasicMaterial({ color: look.color, transparent: true, opacity: 0.7 })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = -0.1;
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
