/**
 * step.js — 台阶/台阶平台模型（程序化）
 * 注册: window.MODELS.step
 * 默认尺寸: 1 x 0.28 x 1.6（低台阶，主程序碰撞系统可逐级踩踏）
 * layout 用 position.y = 台阶顶面高度 - 0.14 放置，scale 控制每级台阶尺寸
 */
(function (global) {
  global.MODELS = global.MODELS || {};
  global.MODELS.step = {
    name: 'step',
    create: function () {
      const T = global.THREE;
      const g = new T.Group();

      const mat = new T.MeshStandardMaterial({ color: 0x8d949e, roughness: 0.92, metalness: 0.05 });
      const box = new T.Mesh(new T.BoxGeometry(1, 0.28, 1.6), mat);
      box.castShadow = true;
      box.receiveShadow = true;
      g.add(box);

      // 混凝土边框
      const edges = new T.LineSegments(
        new T.EdgesGeometry(box.geometry),
        new T.LineBasicMaterial({ color: 0x62686f })
      );
      g.add(edges);

      // 侧面防滑警示条
      const stripe = new T.Mesh(
        new T.BoxGeometry(0.98, 0.025, 0.2),
        new T.MeshBasicMaterial({ color: 0xd9b23a })
      );
      stripe.position.set(0, 0.155, -0.68);
      g.add(stripe);

      return g;
    }
  };
})(window);
