/**
 * lamp.js — 灯柱模型（程序化，自带点光源）
 * 注册: window.MODELS.lamp
 * 默认尺寸: 柱高 3.0，底部在原点；灯头发光 + 点光源照明
 */
(function (global) {
  global.MODELS = global.MODELS || {};
  global.MODELS.lamp = {
    name: 'lamp',
    create: function () {
      const T = global.THREE;
      const g = new T.Group();

      // 柱子
      const pole = new T.Mesh(
        new T.BoxGeometry((2*Math.max(0.07, 0.1)), (3.0), (2*Math.max(0.07, 0.1))),
        new window.PIXEL.matCompat({ color: 0x4a4f58})
      );
      pole.position.y = 1.5;
      pole.castShadow = true;
      g.add(pole);

      // 底座
      const base = new T.Mesh(
        new T.BoxGeometry((2*Math.max(0.22, 0.28)), (0.1), (2*Math.max(0.22, 0.28))),
        new window.PIXEL.matCompat({ color: 0x33373f})
      );
      base.position.y = 0.05;
      g.add(base);

      // 灯头
      const lampMat = new window.PIXEL.matCompat({
        color: 0xfff2c8,
        emissive: 0xffdd88,
        emissiveIntensity: 1.2,
      });
      const bulb = new T.Mesh(new T.BoxGeometry((2*0.16), (2*0.16), (2*0.16)), lampMat);
      bulb.position.y = 3.05;
      g.add(bulb);

      // 灯罩
      const shade = new T.Mesh(
        new T.BoxGeometry((2*Math.max(0.26, 0.2)), (0.25), (2*Math.max(0.26, 0.2))),
        new window.PIXEL.matCompat({ color: 0x5a5f68, side: T.DoubleSide })
      );
      shade.position.y = 3.12;
      g.add(shade);

      // 点光源（光影效果）
      const light = new T.PointLight(0xffdd99, 1.2, 18, 2);
      light.position.y = 2.9;
      g.add(light);

      g.userData = { bulbMat: lampMat, phase: Math.random() * 6.28 };
      return g;
    },
    update: function (inst, dt) {
      // 灯光轻微呼吸
      const u = inst.userData;
      u.phase += dt * 1.2;
      u.bulbMat.emissiveIntensity = 1.0 + Math.sin(u.phase) * 0.25;
    }
  };
})(window);
