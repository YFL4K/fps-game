/**
 * sky.js — 天空模型（超级马里奥3D世界风格：湛蓝天空 + 棉花糖白云 + 圆太阳）
 * 注册: window.MODELS.sky
 */
(function (global) {
  global.MODELS = global.MODELS || {};
  global.MODELS.sky = {
    name: 'sky',
    create: function () {
      const T = global.THREE;
      const g = new T.Group();

      // 湛蓝明亮渐变天空
      const c = document.createElement('canvas');
      c.width = 8; c.height = 512;
      const ctx = c.getContext('2d');
      const grad = ctx.createLinearGradient(0, 0, 0, 512);
      grad.addColorStop(0.0, '#1e90ff');   // 湛蓝
      grad.addColorStop(0.5, '#4db8ff');   // 明亮蓝
      grad.addColorStop(0.75, '#9fd8ff');  // 浅蓝
      grad.addColorStop(0.9, '#e0f2ff');   // 接近白
      grad.addColorStop(1.0, '#ffffff');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 8, 512);

      const tex = new T.CanvasTexture(c);
      const sky = new T.Mesh(
        new T.SphereGeometry(300, 24, 18),
        new window.MARIO.basic({ map: tex, side: T.BackSide, fog: false, depthWrite: false })
      );
      sky.renderOrder = -1000;
      g.add(sky);

      // 圆太阳（带光晕）
      const sun = new T.Mesh(new T.SphereGeometry(10, 20, 16), new window.MARIO.basic({ color: 0xffdd44 }));
      sun.position.set(70, 85, -120);
      g.add(sun);
      const sunGlow = new T.Mesh(new T.SphereGeometry(15, 20, 16), new window.MARIO.basic({ color: 0xffee88, transparent: true, opacity: 0.35 }));
      sunGlow.position.set(70, 85, -120);
      g.add(sunGlow);

      // 棉花糖白云（圆球拼接）
      function cloud(x, y, z, s) {
        const cg = new T.Group();
        const cm = new window.MARIO.mat({ color: 0xffffff });
        const puff = [
          [0, 0, 0, 1.0], [1.0, 0.1, 0, 0.75], [-1.0, 0.1, 0, 0.75],
          [0.4, 0.35, 0.2, 0.6], [-0.4, 0.35, 0.2, 0.6], [0, 0.5, 0, 0.55]
        ];
        for (let i = 0; i < puff.length; i++) {
          const p = puff[i];
          const b = new T.Mesh(new T.SphereGeometry(p[3] * s, 16, 12), cm);
          b.position.set(p[0] * s, p[1] * s, p[2] * s);
          cg.add(b);
        }
        cg.position.set(x, y, z);
        g.add(cg);
      }
      cloud(-80, 50, -140, 12);
      cloud(50, 60, -160, 15);
      cloud(-30, 70, -100, 9);
      cloud(90, 45, -90, 11);
      cloud(-100, 55, -60, 13);

      return g;
    }
  };
})(window);
