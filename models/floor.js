/**
 * floor.js — 地板模型（程序化，Canvas 网格纹理）
 * 注册: window.MODELS.floor
 * 默认尺寸: 40x40 水平平面，纹理重复 20 次
 * 挂载点: 模型自身（平面已旋转为水平，layout rotation 通常为 [0,0,0]）
 */
(function (global) {
  global.MODELS = global.MODELS || {};
  global.MODELS.floor = {
    name: 'floor',
    create: function () {
      const T = global.THREE;
      const g = new T.Group();

      // Canvas 网格纹理
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#2b2e3a';
      ctx.fillRect(0, 0, 256, 256);
      ctx.strokeStyle = '#4a5060';
      ctx.lineWidth = 4;
      for (let i = 0; i <= 4; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 64, 0); ctx.lineTo(i * 64, 256); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * 64); ctx.lineTo(256, i * 64); ctx.stroke();
      }
      ctx.fillStyle = '#232634';
      for (let i = 0; i < 4; i++)
        for (let j = 0; j < 4; j++)
          if ((i + j) % 2 === 0) ctx.fillRect(i * 64 + 4, j * 64 + 4, 56, 56);

      const tex = new T.CanvasTexture(c);
      tex.wrapS = tex.wrapT = T.RepeatWrapping;
      tex.repeat.set(10, 10);

      const plane = new T.Mesh(
        new T.PlaneGeometry(40, 40),
        new T.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0.1 })
      );
      plane.rotation.x = -Math.PI / 2;
      plane.receiveShadow = true;
      g.add(plane);
      return g;
    }
  };
})(window);
