/**
 * vehicle.js — 车辆模型（程序化）
 * 注册: window.MODELS.vehicle
 * config.variant: 'car' | 'truck' | 'jeep'（决定尺寸/颜色/造型）
 * config.color: 车身颜色覆盖
 * 默认: 车体中心在地面（position.y = 0），含车身/驾驶舱/保险杠/车灯/4 车轮
 */
(function (global) {
  global.MODELS = global.MODELS || {};

  var VARIANTS = {
    car:   { bodyColor: 0x2b6cb0, bodyLen: 4.2, bodyH: 0.7, bodyW: 1.8, cabinLen: 1.8, cabinH: 0.6, wheelY: 0.42 },
    truck: { bodyColor: 0x8b6f47, bodyLen: 5.4, bodyH: 0.85, bodyW: 2.15, cabinLen: 1.5, cabinH: 0.72, wheelY: 0.5 },
    jeep:  { bodyColor: 0x4a5d3a, bodyLen: 3.4, bodyH: 0.62, bodyW: 1.7, cabinLen: 1.1, cabinH: 0.52, wheelY: 0.38 }
  };

  global.MODELS.vehicle = {
    name: 'vehicle',

    create: function (config) {
      const T = global.THREE;
      const cfg = config || {};
      const v = VARIANTS[cfg.variant] || VARIANTS.car;
      const g = new T.Group();

      const bodyColor = cfg.color || v.bodyColor;
      const bodyMat = new T.MeshStandardMaterial({ color: bodyColor, roughness: 0.45, metalness: 0.5 });
      const darkMat = new T.MeshStandardMaterial({ color: 0x14161a, roughness: 0.7, metalness: 0.4 });
      const glassMat = new T.MeshStandardMaterial({
        color: 0x1b2b3a, roughness: 0.15, metalness: 0.8,
        emissive: 0x0a1a26, emissiveIntensity: 0.5
      });
      const wheelMat = new T.MeshStandardMaterial({ color: 0x0d0d0f, roughness: 0.9, metalness: 0.2 });

      const L = v.bodyLen, H = v.bodyH, W = v.bodyW;

      // 底盘
      const chassis = new T.Mesh(new T.BoxGeometry(W, 0.18, L), darkMat);
      chassis.position.y = v.wheelY + 0.16;
      g.add(chassis);

      // 车身
      const body = new T.Mesh(new T.BoxGeometry(W, H, L), bodyMat);
      body.position.y = v.wheelY + 0.27 + H / 2;
      body.castShadow = true;
      body.receiveShadow = true;
      g.add(body);

      // 驾驶舱（玻璃）
      const cab = new T.Mesh(new T.BoxGeometry(W * 0.94, v.cabinH, v.cabinLen), glassMat);
      cab.position.set(0, v.wheelY + 0.27 + H + v.cabinH / 2, L * 0.08);
      cab.castShadow = true;
      g.add(cab);

      // 前后保险杠
      const bumperF = new T.Mesh(new T.BoxGeometry(W * 1.02, 0.22, 0.22), darkMat);
      bumperF.position.set(0, v.wheelY + 0.34, -L / 2 - 0.06);
      const bumperR = new T.Mesh(new T.BoxGeometry(W * 1.02, 0.22, 0.22), darkMat);
      bumperR.position.set(0, v.wheelY + 0.34, L / 2 + 0.06);
      g.add(bumperF, bumperR);

      // 车灯（前白后红）
      const headMat = new T.MeshBasicMaterial({ color: 0xfff2c0 });
      const lampF1 = new T.Mesh(new T.BoxGeometry(0.22, 0.11, 0.06), headMat);
      lampF1.position.set(-W * 0.32, v.wheelY + 0.52, -L / 2 - 0.02);
      const lampF2 = lampF1.clone();
      lampF2.position.x = W * 0.32;
      const tailMat = new T.MeshBasicMaterial({ color: 0xff3b3b });
      const lampR1 = new T.Mesh(new T.BoxGeometry(0.22, 0.11, 0.06), tailMat);
      lampR1.position.set(-W * 0.32, v.wheelY + 0.52, L / 2 + 0.02);
      const lampR2 = lampR1.clone();
      lampR2.position.x = W * 0.32;
      g.add(lampF1, lampF2, lampR1, lampR2);

      // 车轮
      const wheelGeo = new T.CylinderGeometry(0.4, 0.4, 0.3, 14);
      const hubMat = new T.MeshStandardMaterial({ color: 0x6a6f76, roughness: 0.4, metalness: 0.8 });
      const hubGeo = new T.CylinderGeometry(0.18, 0.18, 0.32, 8);
      const wp = [
        [-W / 2 - 0.12, v.wheelY, -L * 0.34], [W / 2 + 0.12, v.wheelY, -L * 0.34],
        [-W / 2 - 0.12, v.wheelY, L * 0.34], [W / 2 + 0.12, v.wheelY, L * 0.34]
      ];
      wp.forEach(function (p) {
        const w = new T.Mesh(wheelGeo, wheelMat);
        w.rotation.z = Math.PI / 2;
        w.position.set(p[0], p[1], p[2]);
        w.castShadow = true;
        g.add(w);
        const hub = new T.Mesh(hubGeo, hubMat);
        hub.rotation.z = Math.PI / 2;
        hub.position.set(p[0], p[1], p[2]);
        g.add(hub);
      });

      return g;
    }
  };
})(window);
