/**
 * truck.js — 大型货车/卡车模型（程序化）
 * 注册: window.MODELS.truck
 * 挂载点: 车体底部中心在原点（position.y 表示地面高度）
 * config: color 车身颜色，variant 可选 'semi'（半挂车）或 'truck'（普通货车）
 */
(function (global) {
  global.MODELS = {};
  global.MODELS.truck = {
    name: 'truck',
    create: function (config) {
      const T = global.THREE;
      const cfg = config || {};
      const isSemi = cfg.variant === 'semi';
      const cabColor = cfg.color || 0x1a3a5c;
      const trailerColor = cfg.color ? T.ColorUtils ? new T.Color(cfg.color).lerp(new T.Color(0x666666), 0.3).getHex() : 0x666666 : 0x666666;

      const g = new T.Group();

      const cabMat = new T.MeshStandardMaterial({ color: cabColor, roughness: 0.4, metalness: 0.6 });
      const trailerMat = new T.MeshStandardMaterial({ color: trailerColor, roughness: 0.6, metalness: 0.2 });
      const darkMat = new T.MeshStandardMaterial({ color: 0x111111, roughness: 0.8, metalness: 0.3 });
      const glassMat = new T.MeshStandardMaterial({ color: 0x1b2b3a, roughness: 0.1, metalness: 0.9, transparent: true, opacity: 0.6 });
      const wheelMat = new T.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9, metalness: 0.1 });
      const hubMat = new T.MeshStandardMaterial({ color: 0x555555, roughness: 0.4, metalness: 0.8 });
      const lightMat = new T.MeshBasicMaterial({ color: 0xffffcc });
      const tailMat = new T.MeshBasicMaterial({ color: 0xff2222 });

      if (isSemi) {
        // 驾驶室
        const cab = new T.Mesh(new T.BoxGeometry(2.4, 1.4, 2.2), cabMat);
        cab.position.set(0, 1.2, 2.0);
        cab.castShadow = true;
        g.add(cab);
        // 挡风玻璃
        const windshield = new T.Mesh(new T.BoxGeometry(2.2, 0.7, 0.05), glassMat);
        windshield.position.set(0, 1.5, 3.12);
        g.add(windshield);
        // 车头
        const nose = new T.Mesh(new T.BoxGeometry(2.2, 0.5, 0.6), cabMat);
        nose.position.set(0, 0.85, 3.35);
        g.add(nose);
        // 半挂车厢
        const trailer = new T.Mesh(new T.BoxGeometry(2.6, 2.8, 13.0), trailerMat);
        trailer.position.set(0, 2.0, -4.0);
        trailer.castShadow = true;
        g.add(trailer);
        // 车轮
        const wheelGeo = new T.CylinderGeometry(0.55, 0.55, 0.4, 16);
        const hubs = new T.CylinderGeometry(0.25, 0.25, 0.42, 8);
        const wheelPos = [
          [-1.3, 0.55, 2.0], [1.3, 0.55, 2.0],
          [-1.3, 0.55, -1.5], [1.3, 0.55, -1.5],
          [-1.3, 0.55, -5.5], [1.3, 0.55, -5.5],
          [-1.3, 0.55, -8.0], [1.3, 0.55, -8.0]
        ];
        wheelPos.forEach(function (p) {
          const w = new T.Mesh(wheelGeo, wheelMat);
          w.rotation.z = Math.PI / 2;
          w.position.set(p[0], p[1], p[2]);
          g.add(w);
          const h = new T.Mesh(hubs, hubMat);
          h.rotation.z = Math.PI / 2;
          h.position.set(p[0], p[1], p[2]);
          g.add(h);
        });
        // 车灯
        const lampF1 = new T.Mesh(new T.BoxGeometry(0.3, 0.15, 0.06), lightMat);
        lampF1.position.set(-0.8, 0.7, 3.4);
        const lampF2 = lampF1.clone();
        lampF2.position.x = 0.8;
        const lampR1 = new T.Mesh(new T.BoxGeometry(0.25, 0.15, 0.06), tailMat);
        lampR1.position.set(-1.0, 1.0, -10.4);
        const lampR2 = lampR1.clone();
        lampR2.position.x = 1.0;
        g.add(lampF1, lampF2, lampR1, lampR2);
      } else {
        // 普通货车
        const cab = new T.Mesh(new T.BoxGeometry(2.2, 1.2, 2.0), cabMat);
        cab.position.set(0, 1.1, 2.2);
        cab.castShadow = true;
        g.add(cab);
        const bed = new T.Mesh(new T.BoxGeometry(2.4, 0.8, 4.0), trailerMat);
        bed.position.set(0, 0.8, -1.5);
        bed.castShadow = true;
        g.add(bed);
        const wheelGeo = new T.CylinderGeometry(0.45, 0.45, 0.35, 14);
        [[-1.25, 0.45, 2.0], [1.25, 0.45, 2.0], [-1.25, 0.45, -3.5], [1.25, 0.45, -3.5]].forEach(function (p) {
          const w = new T.Mesh(wheelGeo, wheelMat);
          w.rotation.z = Math.PI / 2;
          w.position.set(p[0], p[1], p[2]);
          g.add(w);
        });
      }
      g.userData = { entityId: 'truck-' + Date.now() };
      return g;
    }
  };
})(window);
