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

      // v11.9 更饱和的马里奥蓝天
      const c = document.createElement('canvas');
      c.width = 8; c.height = 512;
      const ctx = c.getContext('2d');
      const grad = ctx.createLinearGradient(0, 0, 0, 512);
      grad.addColorStop(0.0, '#1f7bff');   // 饱和湛蓝（天顶）
      grad.addColorStop(0.45, '#3f9dff');  // 亮蓝
      grad.addColorStop(0.75, '#8ecbff');  // 浅蓝
      grad.addColorStop(1.0, '#d6f0ff');   // 地平线近白
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 8, 512);

      const tex = new T.CanvasTexture(c);
      const sky = new T.Mesh(
        new T.SphereGeometry(300, 24, 18),
        new T.MeshBasicMaterial({ map: tex, side: T.BackSide, fog: false, depthWrite: false })
      );
      sky.renderOrder = -1000;
      g.add(sky);

      // 金黄太阳（不受光照，纯亮）+ 暖光晕
      const sun = new T.Mesh(new T.SphereGeometry(11, 20, 16), new T.MeshBasicMaterial({ color: 0xffcf33, fog: false }));
      sun.position.set(70, 85, -120);
      g.add(sun);
      const sunGlow = new T.Mesh(new T.SphereGeometry(17, 20, 16), new T.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.4, fog: false, depthWrite: false }));
      sunGlow.position.set(70, 85, -120);
      g.add(sunGlow);

      // 棉花糖白云（不受光照 → 纯白，不再发灰）
      function cloud(x, y, z, s) {
        const cg = new T.Group();
        const cm = new T.MeshBasicMaterial({ color: 0xffffff, fog: false });
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
