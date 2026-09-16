/**
 * sky.js — 天空模型（深空自然感：偏白柔蓝天空 + 立体云朵 + 3D 太阳）
 * 注册: window.MODELS.sky
 */
(function (global) {
  global.MODELS = global.MODELS || {};
  global.MODELS.sky = {
    name: 'sky',
    create: function () {
      const T = global.THREE;
      const g = new T.Group();

      // v11.11 深空自然感天空：顶部柔蓝、地平线近白，整体降低饱和度 → 自然不刺眼
      const c = document.createElement('canvas');
      c.width = 8; c.height = 512;
      const ctx = c.getContext('2d');
      const grad = ctx.createLinearGradient(0, 0, 0, 512);
      grad.addColorStop(0.0, '#a9cdf2');   // 天顶：柔蓝（深空自然）
      grad.addColorStop(0.40, '#cfe6fb');  // 亮柔蓝
      grad.addColorStop(0.72, '#e8f4ff');  // 浅蓝白
      grad.addColorStop(1.0, '#f6fbff');   // 地平线近白
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 8, 512);

      const tex = new T.CanvasTexture(c);
      const sky = new T.Mesh(
        new T.SphereGeometry(300, 24, 18),
        new T.MeshBasicMaterial({ map: tex, side: T.BackSide, fog: false, depthWrite: false })
      );
      sky.renderOrder = -1000;
      g.add(sky);

      // v11.11 立体太阳：受光的球体（带明暗交界 → 3D 体积感）+ 加色光晕
      const sunCore = new T.Mesh(
        new T.SphereGeometry(9, 28, 20),
        new T.MeshStandardMaterial({ color: 0xfff3b0, emissive: 0xffd66b, emissiveIntensity: 0.85, roughness: 0.55, metalness: 0.0, fog: false })
      );
      sunCore.position.set(70, 88, -120);
      g.add(sunCore);
      const sunGlow = new T.Mesh(
        new T.SphereGeometry(16, 24, 18),
        new T.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.28, fog: false, depthWrite: false, blending: T.AdditiveBlending })
      );
      sunGlow.position.set(70, 88, -120);
      g.add(sunGlow);

      // v11.11 立体云朵：多团蓬松球簇（受光 → 有明暗体积感，非平面色块），散布于天穹
      function cloud(x, y, z, s) {
        const cg = new T.Group();
        const cm = new T.MeshStandardMaterial({ color: 0xffffff, emissive: 0xc4d4ea, emissiveIntensity: 0.45, roughness: 1.0, metalness: 0.0, fog: false });
        // 不规则蓬松球簇：不同大小/位置的球体组合 → 3D 体积感
        const puff = [
          [0.0, 0.0, 0.0, 1.6], [1.6, 0.2, 0.2, 1.1], [-1.5, 0.25, -0.2, 1.15],
          [0.7, 0.7, 0.3, 0.95], [-0.7, 0.7, 0.1, 0.95], [0.1, 1.15, 0.0, 0.8],
          [2.4, -0.1, -0.3, 0.8], [-2.3, 0.0, 0.1, 0.85], [1.0, -0.4, 0.3, 0.7],
          [-1.0, -0.5, -0.2, 0.75]
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
      cloud(-90, 55, -150, 11);
      cloud(60, 68, -170, 14);
      cloud(-30, 80, -120, 9);
      cloud(100, 50, -100, 10);
      cloud(-115, 62, -70, 12);
      cloud(20, 92, -140, 8);
      cloud(135, 75, -130, 11);

      return g;
    }
  };
})(window);
