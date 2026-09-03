/**
 * obstacle.js — 油桶/障碍物模型（程序化）
 * 注册: window.MODELS.obstacle
 * 默认尺寸: 半径 0.5，高 1.2，底部在原点
 */
(function (global) {
  global.MODELS = global.MODELS || {};
  global.MODELS.obstacle = {
    name: 'obstacle',
    create: function () {
      const T = global.THREE;
      const g = new T.Group();

      const body = new T.Mesh(
        new T.CylinderGeometry(0.5, 0.5, 1.2, 20),
        new T.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.5, metalness: 0.4 })
      );
      body.position.y = 0.6;
      body.castShadow = true;
      body.receiveShadow = true;
      g.add(body);

      // 顶部/底部环箍
      const ringMat = new T.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.4, metalness: 0.7 });
      const top = new T.Mesh(new T.CylinderGeometry(0.36, 0.36, 0.12, 20), ringMat);
      top.position.y = 1.2;
      g.add(top);
      const rim = new T.Mesh(new T.CylinderGeometry(0.52, 0.52, 0.06, 20), ringMat);
      rim.position.y = 0.06;
      g.add(rim);

      // 危险条纹（斜贴片）
      const stripe = new T.Mesh(
        new T.BoxGeometry(0.55, 0.3, 0.02),
        new T.MeshStandardMaterial({ color: 0xf1c40f, roughness: 0.6, metalness: 0.3 })
      );
      stripe.position.set(0, 0.7, 0.5);
      stripe.rotation.z = 0.4;
      g.add(stripe);
      return g;
    }
  };
})(window);
