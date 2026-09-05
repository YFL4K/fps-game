/**
 * boulder.js — 巨石/岩石模型（v6.7 场景美化）
 * 注册: window.MODELS.boulder
 * 不规则多边形巨石（顶点扰动），2~3 块堆叠，作低矮掩体
 * 配置: scale 随机缩放
 */
(function (global) {
  global.MODELS = global.MODELS || {};
  global.MODELS.boulder = {
    name: 'boulder',
    create: function (config) {
      const T = global.THREE;
      const g = new T.Group();
      // v6.7 修复：config.scale 可能是数组 [x,y,z]，取第一个分量
      const sc = config && config.scale;
      const s = Array.isArray(sc) ? (sc[0] || 1) : (sc || 1);

      const mat = new T.MeshStandardMaterial({ color: 0x7a7f88, roughness: 0.95, metalness: 0.05 });
      const mat2 = new T.MeshStandardMaterial({ color: 0x686d76, roughness: 0.95, metalness: 0.05 });

      function rockGeo(rad, detail) {
        const geo = new T.DodecahedronGeometry(rad * s, detail);
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const nx = pos.getX(i), ny = pos.getY(i), nz = pos.getZ(i);
          const j = 0.82 + Math.random() * 0.36;
          pos.setXYZ(i, nx * j, ny * j, nz * j);
        }
        geo.computeVertexNormals();
        return geo;
      }

      const main = new T.Mesh(rockGeo(0.95, 1), mat);
      main.position.y = 0.55 * s;
      main.rotation.y = Math.random() * Math.PI;
      main.castShadow = true;
      main.receiveShadow = true;
      g.add(main);

      // 副石
      const sub = new T.Mesh(rockGeo(0.5, 1), mat2);
      sub.position.set(0.75 * s, 0.32 * s, 0.25 * s);
      sub.rotation.y = Math.random() * Math.PI;
      sub.castShadow = true;
      g.add(sub);

      // 小碎石
      for (let i = 0; i < 3; i++) {
        const pebble = new T.Mesh(rockGeo(0.16, 0), mat2);
        pebble.position.set((Math.random() - 0.5) * 1.3 * s, 0.08 * s, (Math.random() - 0.5) * 1.3 * s);
        pebble.rotation.set(Math.random(), Math.random(), Math.random());
        g.add(pebble);
      }

      g.userData = {};
      return g;
    }
  };
})(window);
