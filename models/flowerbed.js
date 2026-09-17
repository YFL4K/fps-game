/**
 * flowerbed.js — 长方形花池模型（v11.17，替代建筑旁装饰台阶）
 * 注册: window.MODELS.flowerbed
 * 造型: 砖石/木质长方形 Raised Bed（四壁 + 内填深色泥土）+ 池中多色花丛 + 绿叶。
 * 性能: 同材质零件在构建期用 ROUND.batcher 烘焙成单几何体（每池仅按材质数出网格），
 *      形状走全局缓存；静态实体进主程序 staticBatchMerge 进一步合批。
 * 配置: scale 整体缩放；可选 variant 指定框色；花色随机。
 */
(function (global) {
  global.MODELS = global.MODELS || {};
  global.MODELS.flowerbed = {
    name: 'flowerbed',
    create: function (config) {
      const T = global.THREE;
      const R = global.ROUND;
      const g = new T.Group();
      const cfg = config || {};
      const sc = cfg.scale;
      const s = Array.isArray(sc) ? (sc[0] || 1) : (sc || 1);

      // 尺寸（局部米制，随后按 s 缩放烘焙）
      const BL = 2.6, BW = 1.15, BH = 0.55, TH = 0.16;   // 长/宽/高/壁厚

      // 框色：砖红 / 灰石 / 木褐 三选一（随机），全部共享材质缓存
      const frameColors = [0xb5651d, 0x9a8b7a, 0x7a5230];
      const fc = (typeof cfg.variant === 'number') ? frameColors[cfg.variant % frameColors.length]
        : frameColors[Math.floor(Math.random() * frameColors.length)];
      const frameMat = new window.MARIO.matS({ color: fc });
      const soilMat = new window.MARIO.matS({ color: 0x3a2a1b });
      const leafMat = new window.MARIO.matS({ color: 0x4f8f3a });
      const stemMat = new window.MARIO.matS({ color: 0x5aa03f });
      // 多色花朵（无主之地/沙漠花圃感的暖色 + 点缀冷色）
      const flowerColors = [0xe8483f, 0xf4b52a, 0xe8792b, 0xd85aa0, 0x9b59b6, 0xf5f0e1, 0x5dade2];
      const flowerMats = flowerColors.map(function (c) { return new window.MARIO.matS({ color: c }); });
      const centerMat = new window.MARIO.basicS({ color: 0xffe9a8 });

      const B = R.batcher();
      const S = [s, s, s];

      // ---- 四壁（圆角长条），中间留空填土 ----
      const wallFB = R.rbox(BL, BH, TH, 0.05);   // 前后壁
      const wallLR = R.rbox(TH, BH, BW - 2 * TH, 0.05);   // 左右壁
      B.add(g, wallFB, frameMat, [0, BH / 2, (BW - TH) / 2], null, S);
      B.add(g, wallFB, frameMat, [0, BH / 2, -(BW - TH) / 2], null, S);
      B.add(g, wallLR, frameMat, [(BL - TH) / 2, BH / 2, 0], null, S);
      B.add(g, wallLR, frameMat, [-(BL - TH) / 2, BH / 2, 0], null, S);
      // 顶沿压条（比壁略宽一圈，做出立体轮廓）
      const lip = R.rbox(BL + 0.08, 0.08, BW + 0.08, 0.05);
      B.add(g, lip, frameMat, [0, BH + 0.02, 0], null, S);
      // 泥土面
      const soil = R.rbox(BL - 2 * TH - 0.02, 0.1, BW - 2 * TH - 0.02, 0.03);
      B.add(g, soil, soilMat, [0, BH - 0.04, 0], null, S);

      // ---- 花丛：网格排布多株，随机花色 + 高度抖动 ----
      const gStem = R.cyl(0.022, 0.022, 0.36, 5);
      const gPetal = R.cone(0.11, 0.14, 6);
      const gCenter = R.sph(0.05, 8, 6);
      const gLeaf = R.cone(0.06, 0.2, 4);
      const cols = 5, rows = 2;
      for (let cxi = 0; cxi < cols; cxi++) {
        for (let rzi = 0; rzi < rows; rzi++) {
          const fx = (cxi / (cols - 1) - 0.5) * (BL - 2 * TH - 0.4);
          const fz = (rzi / (rows - 1) - 0.5) * (BW - 2 * TH - 0.35);
          const jitter = 0.08;
          const x = fx + (Math.random() - 0.5) * jitter;
          const z = fz + (Math.random() - 0.5) * jitter;
          const h = 0.5 + Math.random() * 0.28;      // 花顶高度
          const topY = BH - 0.02;
          // 花茎
          B.add(g, gStem, stemMat, [x, topY + h * 0.5 - 0.18, z], null, S);
          // 两片叶
          B.add(g, gLeaf, leafMat, [x - 0.06, topY + h * 0.45, z], [0, 0, 0.9], S);
          B.add(g, gLeaf, leafMat, [x + 0.06, topY + h * 0.45, z], [0, 0, -0.9], S);
          // 花冠（倒锥花瓣）+ 花心
          const fm = flowerMats[Math.floor(Math.random() * flowerMats.length)];
          B.add(g, gPetal, fm, [x, topY + h, z], [Math.PI, 0, Math.random() * Math.PI], S);
          B.add(g, gCenter, centerMat, [x, topY + h + 0.03, z], null, S);
        }
      }
      B.flush();

      g.userData = {};
      return g;
    }
  };
})(window);
