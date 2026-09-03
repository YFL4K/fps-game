/**
 * sky.js — 天空模型（程序化渐变天空球）
 * 注册: window.MODELS.sky
 * 默认: 半径 300 的球体，BackSide 渐变纹理；不参与雾
 */
(function (global) {
  global.MODELS = global.MODELS || {};
  global.MODELS.sky = {
    name: 'sky',
    create: function () {
      const T = global.THREE;

      // Canvas 渐变天空
      const c = document.createElement('canvas');
      c.width = 8; c.height = 512;
      const ctx = c.getContext('2d');
      const grad = ctx.createLinearGradient(0, 0, 0, 512);
      grad.addColorStop(0.0, '#0b1d3a');
      grad.addColorStop(0.35, '#2a4d7f');
      grad.addColorStop(0.6, '#6d8fb5');
      grad.addColorStop(0.75, '#b8c6d8');
      grad.addColorStop(0.9, '#e8e0cc');
      grad.addColorStop(1.0, '#f5d9a8');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 8, 512);

      const tex = new T.CanvasTexture(c);
      const sky = new T.Mesh(
        new T.SphereGeometry(300, 16, 16),
        new T.MeshBasicMaterial({ map: tex, side: T.BackSide, fog: false, depthWrite: false })
      );
      sky.renderOrder = -1000;
      return sky;
    }
  };
})(window);
