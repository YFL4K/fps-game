/**
 * wall.js — 墙板模型（程序化，Canvas 砖块纹理）
 * 注册: window.MODELS.wall
 * 默认尺寸: 8 x 4 x 0.5（layout 可用 scale/rotation 拼接任意墙体）
 * 挂载点: 模型底部中心在原点（position.y 表示地面高度）
 */
(function (global) {
  global.MODELS = global.MODELS || {};
  global.MODELS.wall = {
    name: 'wall',
    create: function () {
      const T = global.THREE;
      const g = new T.Group();

      // Canvas 砖块纹理
      const c = document.createElement('canvas');
      c.width = 256; c.height = 128;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#6b5a48';
      ctx.fillRect(0, 0, 256, 128);
      ctx.strokeStyle = '#3d3328';
      ctx.lineWidth = 3;
      const bw = 64, bh = 32;
      for (let row = 0; row < 4; row++) {
        const off = (row % 2) * (bw / 2);
        for (let col = -1; col < 5; col++) {
          ctx.strokeRect(col * bw + off, row * bh, bw, bh);
        }
      }
      // 砖块明暗
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = '#000';
      for (let row = 0; row < 4; row++)
        for (let col = 0; col < 4; col++)
          if ((row + col) % 2 === 0) ctx.fillRect(col * 64 + 6, row * 32 + 6, 52, 20);
      ctx.globalAlpha = 1;

      const tex = new T.CanvasTexture(c);
      tex.wrapS = tex.wrapT = T.RepeatWrapping;
      tex.repeat.set(4, 2);

      const box = new T.Mesh(
        new T.BoxGeometry(8, 4, 0.5),
        new T.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0 })
      );
      box.position.y = 2; // 底部中心在原点
      box.castShadow = true;
      box.receiveShadow = true;
      g.add(box);
      return g;
    }
  };
})(window);
