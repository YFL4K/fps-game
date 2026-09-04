/**
 * tnt.js — 可爆炸 TNT 炸药箱（程序化）
 * 注册: window.MODELS.tnt
 *
 * 被玩家击中后：
 *   1. ctx.explode(point, radius, damage) 大范围爆炸（比油桶更强）
 *   2. inst.userData.destroyed = true，主程序生成碎片并移除
 *
 * config: radius（默认 6.5）、damage（默认 100）
 * 注意：cfg 上不设置 kind，避免被当作拾取物
 */
(function (global) {
  global.MODELS = global.MODELS || {};

  global.MODELS.tnt = {
    name: 'tnt',

    create: function (config) {
      const T = global.THREE;
      const cfg = config || {};
      const g = new T.Group();

      const boxMat = new T.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.72, metalness: 0.15 });
      const bandMat = new T.MeshStandardMaterial({ color: 0x16181c, roughness: 0.85, metalness: 0.15 });
      const glowMat = new T.MeshStandardMaterial({
        color: 0xffcc44, emissive: 0xff8800, emissiveIntensity: 1.4,
        roughness: 0.4, metalness: 0.2
      });

      // 主体木箱
      const box = new T.Mesh(new T.BoxGeometry(1.1, 0.8, 1.1), boxMat);
      box.position.y = 0.4;
      box.castShadow = true;
      box.receiveShadow = true;
      g.add(box);

      // 上下黑色捆带
      const bandT = new T.Mesh(new T.BoxGeometry(1.12, 0.16, 1.12), bandMat);
      bandT.position.y = 0.76;
      const bandB = new T.Mesh(new T.BoxGeometry(1.12, 0.16, 1.12), bandMat);
      bandB.position.y = 0.06;
      g.add(bandT, bandB);

      // TNT 发光标识（两个面）
      const label1 = new T.Mesh(new T.BoxGeometry(0.5, 0.26, 0.03), glowMat);
      label1.position.set(0, 0.4, 0.565);
      const label2 = new T.Mesh(new T.BoxGeometry(0.03, 0.26, 0.5), glowMat);
      label2.position.set(0.565, 0.4, 0);
      g.add(label1, label2);

      // 引线 + 火花
      const fuse = new T.Mesh(new T.CylinderGeometry(0.035, 0.025, 0.34, 6), bandMat);
      fuse.position.set(0.34, 0.98, 0.34);
      fuse.rotation.z = 0.5;
      g.add(fuse);
      const spark = new T.Mesh(
        new T.SphereGeometry(0.07, 6, 6),
        new T.MeshBasicMaterial({ color: 0xffee66 })
      );
      spark.position.set(0.47, 1.12, 0.24);
      g.add(spark);

      g.userData = {
        kind: 'explosive',
        radius: cfg.radius || 6.5,
        damage: cfg.damage || 100
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
