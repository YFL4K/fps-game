/**
 * grass.js — 草地/花丛模型（v6.7 场景美化；v11.13 合批降 draw call）
 * 注册: window.MODELS.grass
 * 圆形草皮 + 草簇 + 彩色小花，贴地铺展，随机旋转
 * 配置: scale 随机缩放
 *
 * v11.13：旧版一丛草 = 22 个网格（9 草簇 + 6 茎 + 6 花头 + 1 草皮），
 * 基线实测 5 丛草吃掉 110 次 draw call。现在同一材质内的零件在构建期烘焙成一个
 * 几何体（ROUND.batcher），随机布局照旧，每丛只按材质数出网格（约 7 个）。
 * 形状本身走全局缓存，缩放/位置在烘焙时固化。
 */
(function (global) {
  global.MODELS = global.MODELS || {};
  global.MODELS.grass = {
    name: 'grass',
    create: function (config) {
      const T = global.THREE;
      const R = global.ROUND;
      const g = new T.Group();
      const sc = config && config.scale;
      const s = (Array.isArray(sc) ? (sc[0] || 1) : (sc || 1)) * 1.6;

      const baseMat = new window.MARIO.matS({ color: 0x4c8c3f });
      const tuftMat = new window.MARIO.matS({ color: 0x6aa84f });
      const flowerColors = [0xf4c542, 0xe86b5e, 0x9b59b6, 0x5dade2];
      const flowerMats = flowerColors.map(function (c) { return new window.MARIO.matS({ color: c }); });

      // 复用形状（全局缓存，缩放烘焙时施加）
      const gBase = R.cyl(1.4, 1.5, 0.1, 14);
      const gTuft = R.cone(0.16, 0.55, 5);
      const gStem = R.cyl(0.02, 0.02, 0.4, 4);
      const gHead = R.sph(0.09, 6, 5);
      const S = [s, s, s];

      const B = R.batcher();
      B.add(g, gBase, baseMat, [0, 0.05 * s, 0], null, S);

      for (let i = 0; i < 9; i++) {
        const ang = Math.random() * Math.PI * 2;
        const rad = Math.random() * 1.1 * s;
        B.add(g, gTuft, tuftMat,
          [Math.cos(ang) * rad, 0.28 * s, Math.sin(ang) * rad],
          [(Math.random() - 0.5) * 0.25, 0, (Math.random() - 0.5) * 0.25], S);
      }
      for (let i = 0; i < 6; i++) {
        const ang = Math.random() * Math.PI * 2;
        const rad = Math.random() * 1.1 * s;
        const x = Math.cos(ang) * rad, z = Math.sin(ang) * rad;
        B.add(g, gStem, tuftMat, [x, 0.2 * s, z], null, S);
        B.add(g, gHead, flowerMats[i % flowerMats.length], [x, 0.42 * s, z], null, S);
      }
      B.flush();

      g.userData = {};
      return g;
    }
  };
})(window);
