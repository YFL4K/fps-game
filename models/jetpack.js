/**
 * jetpack.js — 喷气飞行器道具模型（蓝色飞机标志）
 * 注册: window.MODELS.jetpack
 * v8.4 新增：击杀普通敌人 5% 掉落 / 每 5000 分自动获得，拾取后按空格向上飞行 15 秒。
 * 外观：蓝色喷气背包 + 两侧喷口 + 双翼飞机标志 + 顶部蓝色发光信标。
 */
(function (global) {
  global.MODELS = global.MODELS || {};

  global.MODELS.jetpack = {
    name: 'jetpack',

    create: function (config) {
      const T = global.THREE;
      const g = new T.Group();

      // 蓝色主体背包
      const body = new T.Mesh(
        new T.BoxGeometry(0.26, 0.36, 0.16),
        new window.MARIO.mat({ color: 0x2a7fff, emissive: 0x001a44, emissiveIntensity: 0.45 })
      );
      g.add(body);

      // 两侧喷口
      for (let i = 0; i < 2; i++) {
        const nozzle = new T.Mesh(
          new T.CylinderGeometry(0.06, 0.06, 0.14, 8),
          new window.MARIO.mat({ color: 0x1a4fbb})
        );
        nozzle.rotation.x = Math.PI / 2;
        nozzle.position.set((i === 0 ? -1 : 1) * 0.13, -0.22, 0);
        g.add(nozzle);
      }

      // 双翼飞机标志（蓝色）
      for (let i = 0; i < 2; i++) {
        const wing = new T.Mesh(
          new T.BoxGeometry(0.34, 0.03, 0.13),
          new window.MARIO.mat({ color: 0x66aaff, emissive: 0x003366, emissiveIntensity: 0.55 })
        );
        wing.position.set((i === 0 ? -1 : 1) * 0.18, 0.04, 0);
        g.add(wing);
      }

      // 顶部蓝色发光信标
      const beacon = new T.Mesh(new T.SphereGeometry(0.05, 8, 6), new window.MARIO.basic({ color: 0x55ccff }));
      beacon.position.set(0, 0.22, 0);
      g.add(beacon);

      g.userData = { kind: 'pickup', spin: 0 };
      return g;
    },

    update: function (inst, dt) {
      // 缓慢旋转展示
      inst.rotation.y += dt * 1.8;
    }
  };
})(window);
