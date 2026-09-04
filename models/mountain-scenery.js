/**
 * mountain-scenery.js — 远景山脉 + 云彩（程序化生成）
 * 注册: window.MODELS.mountain_scenery
 */
(function (global) {
  global.MODELS = global.MODELS || {};

  global.MODELS.mountain_scenery = {
    name: 'mountain_scenery',

    create: function (config) {
      const T = global.THREE;
      const g = new T.Group();
      const cfg = config || {};

      // ---- 山脉（远处山峰轮廓）----
      const mountainColors = [0x6b7b8d, 0x7d8d9f, 0x8d9dad, 0x9daebf];
      
      for (let i = 0; i < 8; i++) {
        const height = 15 + Math.random() * 25;
        const radius = 12 + Math.random() * 18;
        const x = (Math.random() - 0.5) * 160;
        const z = -60 - Math.random() * 40;
        
        const geo = new T.ConeGeometry(radius, height, 6 + Math.floor(Math.random() * 4), 2);
        // 随机扰动顶点，让山形更自然
        const posAttr = geo.attributes.position;
        for (let j = 0; j < posAttr.count; j++) {
          const px = posAttr.getX(j);
          const py = posAttr.getY(j);
          const pz = posAttr.getZ(j);
          if (py < height * 0.45) {
            posAttr.setX(j, px + (Math.random() - 0.5) * radius * 0.3);
            posAttr.setZ(j, pz + (Math.random() - 0.5) * radius * 0.3);
          }
        }
        geo.computeVertexNormals();
        
        const mat = new T.MeshStandardMaterial({
          color: mountainColors[i % mountainColors.length],
          roughness: 0.85,
          metalness: 0.1,
          flatShading: true
        });
        const mesh = new T.Mesh(geo, mat);
        mesh.position.set(x, height * 0.5, z);
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        g.add(mesh);
      }

      // ---- 云彩（白色 fluffy 群）----
      const cloudMat = new T.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 1,
        metalness: 0,
        transparent: true,
        opacity: 0.85
      });

      for (let i = 0; i < 20; i++) {
        const cloudGroup = new T.Group();
        const cloudX = (Math.random() - 0.5) * 140;
        const cloudY = 35 + Math.random() * 25;
        const cloudZ = -50 - Math.random() * 60;
        
        // 每片云由多个球体组成
        const puffCount = 3 + Math.floor(Math.random() * 5);
        for (let j = 0; j < puffCount; j++) {
          const puffRadius = 2 + Math.random() * 4;
          const puffGeo = new T.SphereGeometry(puffRadius, 8, 6);
          const puff = new T.Mesh(puffGeo, cloudMat.clone());
          puff.position.set(
            (Math.random() - 0.5) * 6,
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 4
          );
          puff.castShadow = false;
          cloudGroup.add(puff);
        }
        
        cloudGroup.position.set(cloudX, cloudY, cloudZ);
        g.add(cloudGroup);
      }

      g.userData = { kind: 'scenery', phase: Math.random() * 6.28 };
      return g;
    },

    update: function (inst, dt, ctx) {
      // 云彩缓慢飘动
      const u = inst.userData;
      u.phase += dt * 0.15;
      
      inst.children.forEach((child, idx) => {
        if (idx >= 8) { // 山脉后面是云彩
          child.position.x += dt * 0.3;
          // 超出边界后重置
          if (child.position.x > 80) child.position.x = -80;
        }
      });
    }
  };
})(window);
