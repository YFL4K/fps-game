/**
 * barrel.js — 可爆炸油桶（程序化）
 * 注册: window.MODELS.barrel
 *
 * 被玩家击中后：
 *   1. 通过 ctx.explode(point, radius, damage) 触发大范围爆炸（伤害敌人/玩家/连环引爆）
 *   2. 设置 inst.userData.destroyed = true，主程序负责生成碎片并移除
 *
 * config: radius（爆炸半径，默认 5）、damage（爆炸伤害，默认 70）
 * 注意：cfg 上不设置 kind，避免被主程序当作拾取物处理
 */
(function (global) {
  global.MODELS = global.MODELS || {};

  global.MODELS.barrel = {
    name: 'barrel',

    create: function (config) {
      const T = global.THREE;
      const cfg = config || {};
      const g = new T.Group();

      const bodyMat = new T.MeshStandardMaterial({ color: cfg.color || 0xc0392b, roughness: 0.45, metalness: 0.5 });
      const ringMat = new T.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.4, metalness: 0.7 });
      const stripeMat = new T.MeshStandardMaterial({
        color: 0xf1c40f, roughness: 0.55, metalness: 0.3,
        emissive: 0x8a6d00, emissiveIntensity: 0.45
      });

      // 桶身
      const body = new T.Mesh(new T.CylinderGeometry(0.5, 0.5, 1.25, 20), bodyMat);
      body.position.y = 0.625;
      body.castShadow = true;
      body.receiveShadow = true;
      g.add(body);

      // 顶盖 + 上下环箍
      const top = new T.Mesh(new T.CylinderGeometry(0.36, 0.36, 0.12, 20), ringMat);
      top.position.y = 1.25;
      const rim = new T.Mesh(new T.CylinderGeometry(0.53, 0.53, 0.07, 20), ringMat);
      rim.position.y = 0.07;
      const rim2 = new T.Mesh(new T.CylinderGeometry(0.53, 0.53, 0.07, 20), ringMat);
      rim2.position.y = 1.18;
      g.add(top, rim, rim2);

      // 黄色危险条纹（环绕桶身）
      const stripe = new T.Mesh(new T.CylinderGeometry(0.515, 0.515, 0.36, 20), stripeMat);
      stripe.position.y = 0.68;
      g.add(stripe);

      // 黑色危险标签
      const warn = new T.Mesh(new T.BoxGeometry(0.46, 0.2, 0.02), new T.MeshBasicMaterial({ color: 0x141414 }));
      warn.position.set(0, 0.68, 0.522);
      const warn2 = new T.Mesh(new T.BoxGeometry(0.02, 0.2, 0.46), new T.MeshBasicMaterial({ color: 0x141414 }));
      warn2.position.set(0.522, 0.68, 0);
      g.add(warn, warn2);

      g.userData = {
        kind: 'explosive',
        radius: cfg.radius || 5,
        damage: cfg.damage || 70
      };
      return g;
    },

    onHit: function (inst, point, ctx) {
      const u = inst.userData;
      if (u.exploded) return false;
      u.exploded = true;
      u.destroyed = true;
      if (ctx && ctx.explode) {
        ctx.explode(point || inst.position.clone(), u.radius, u.damage, { chain: true });
      }
      return false;
    }
  };
})(window);
