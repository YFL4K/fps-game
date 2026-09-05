/**
 * highwall.js — 高墙 / 废墟城墙模型（v6.7 场景美化）
 * 注册: window.MODELS.highwall
 * 混凝土高墙 + 顶部垛口 + 表面裂纹装饰，用作大型掩体
 * 配置: scale 随机缩放（布局中控制宽度）
 */
(function (global) {
  global.MODELS = global.MODELS || {};
  global.MODELS.highwall = {
    name: 'highwall',
    create: function (config) {
      const T = global.THREE;
      const g = new T.Group();
      const s = (config && config.scaleY) || 1;

      const wallMat = new T.MeshStandardMaterial({ color: 0x8a8578, roughness: 0.92, metalness: 0.05 });
      const darkMat = new T.MeshStandardMaterial({ color: 0x6e6a5f, roughness: 0.95, metalness: 0.02 });

      // 主体墙体（宽 7.2 高 3.6 厚 0.8，居中在 origin）
      const body = new T.Mesh(new T.BoxGeometry(7.2, 3.6 * s, 0.8), wallMat);
      body.position.y = 1.8 * s;
      body.castShadow = true;
      body.receiveShadow = true;
      g.add(body);

      // 顶部垛口（交替排列）
      const merlonMat = darkMat;
      const mw = 0.9;
      const gap = 1.0;
      const n = 5;
      for (let i = 0; i < n; i++) {
        const x = (i - (n - 1) / 2) * (mw + gap);
        const merlon = new T.Mesh(new T.BoxGeometry(mw, 0.85 * s, 0.75), merlonMat);
        merlon.position.set(x, 3.6 * s + 0.42 * s, 0);
        merlon.castShadow = true;
        g.add(merlon);
      }

      // 底部勒脚 + 裂缝装饰
      const base = new T.Mesh(new T.BoxGeometry(7.5, 0.35, 0.95), darkMat);
      base.position.y = 0.17;
      g.add(base);
      for (let i = 0; i < 3; i++) {
        const crack = new T.Mesh(new T.BoxGeometry(0.06, (0.8 + Math.random() * 1.4) * s, 0.05), darkMat);
        crack.position.set(-2.6 + i * 2.6, (1.2 + Math.random() * 1.2) * s, 0.41);
        crack.rotation.z = (Math.random() - 0.5) * 0.2;
        g.add(crack);
      }

      g.userData = {};
      return g;
    }
  };
})(window);
