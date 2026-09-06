/**
 * scene-layout.js — 程序化随机地图生成（v6）
 * 每关随机生成不同的场景布局
 * 支持建筑、树木、车辆、集装箱、飞机、花盆、油桶、TNT、箱子、灯柱、台阶、靶子、拾取物等
 */
(function () {
  var rand = function (min, max) { return min + Math.random() * (max - min); };
  var randInt = function (min, max) { return Math.floor(rand(min, max + 1)); };
  // 暴露全局，供主脚本（index.html 内联 IIFE）及后续扩展脚本使用
  window.randInt = function (min, max) { return Math.floor(rand(min, max + 1)); };
  var randChoice = function (arr) { return arr[randInt(0, arr.length - 1)]; };
  var randColor = function () { return randInt(0x223344, 0x8899aa); };
  var randRoofColor = function () { return randChoice([0x5d4a3a, 0x6b4a2f, 0x4a5568, 0x3d3d3d, 0x8b4513]); };

  function generateLayout(seed) {
    var entities = [];
    var idCounter = 0;
    var nextId = function (prefix) { return prefix + '-' + (++idCounter); };

    // ---- 基础环境 ----
    entities.push({ id: nextId('sky'), model: 'sky', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], collision: false });
    entities.push({ id: nextId('floor'), model: 'floor', position: [0, 0, 0], rotation: [0, 0, 0], scale: [2.5, 1, 2.5], collision: false });
    entities.push({ id: nextId('wall-n'), model: 'wall', position: [0, 0, -45], rotation: [0, 0, 0], scale: [11.5, 1, 1], collision: true });
    entities.push({ id: nextId('wall-s'), model: 'wall', position: [0, 0, 45], rotation: [0, 0, 0], scale: [11.5, 1, 1], collision: true });
    entities.push({ id: nextId('wall-e'), model: 'wall', position: [45, 0, 0], rotation: [0, Math.PI / 2, 0], scale: [11.5, 1, 1], collision: true });
    entities.push({ id: nextId('wall-w'), model: 'wall', position: [-45, 0, 0], rotation: [0, -Math.PI / 2, 0], scale: [11.5, 1, 1], collision: true });

    // ---- 建筑（随机放置 6-10 栋）----
    var buildings = [];
    var numBuildings = randInt(6, 10);
    for (var i = 0; i < numBuildings; i++) {
      var bx = rand(-38, 38);
      var bz = rand(-38, 38);
      // 避免与出生点太近
      if (Math.sqrt(bx * bx + bz * bz) < 12) continue;
      var bw = rand(4, 8);
      var bd = rand(4, 8);
      var bh = rand(3, 4.5);
      var bcolor = randColor();
      var broof = randRoofColor();
      var brot = rand(0, Math.PI * 2);
      buildings.push({ x: bx, z: bz, w: bw, d: bd });

      entities.push({
        id: nextId('build'), model: 'building',
        position: [bx, 0, bz], rotation: [0, brot, 0], scale: [1, 1, 1],
        collision: true, w: bw, d: bd, h: bh, color: bcolor, roofColor: broof
      });

      // 问题7：建筑物旁自动添加箱子或台阶
      var sides = [
        { dx: bw / 2 + 1.5, dz: 0, rot: 0 },
        { dx: -bw / 2 - 1.5, dz: 0, rot: Math.PI },
        { dx: 0, dz: bd / 2 + 1.5, rot: Math.PI / 2 },
        { dx: 0, dz: -bd / 2 - 1.5, rot: -Math.PI / 2 }
      ];
      var side = randChoice(sides);
      var ex = bx + side.dx;
      var ez = bz + side.dz;

      // 放置箱子掩体
      if (Math.random() > 0.3) {
        entities.push({
          id: nextId('crate'), model: 'crate',
          position: [ex, 0.5, ez], rotation: [0, rand(0, Math.PI), 0], scale: [1, 1, 1],
          collision: true
        });
        if (Math.random() > 0.5) {
          entities.push({
            id: nextId('crate2'), model: 'crate',
            position: [ex + 1.2, 0.5, ez], rotation: [0, rand(0, Math.PI), 0], scale: [1, 1, 1],
            collision: true
          });
        }
      }

      // 放置台阶（通往屋顶）
      if (Math.random() > 0.4) {
        var stepCount = randInt(2, 4);
        var stepDirX = side.rot === 0 ? 0 : (side.rot === Math.PI ? 0 : -0.8);
        var stepDirZ = side.rot === 0 ? -0.8 : (side.rot === Math.PI ? 0.8 : 0);
        for (var s = 0; s < stepCount; s++) {
          entities.push({
            id: nextId('step'), model: 'step',
            position: [ex + stepDirX * s, 0.14 + s * 0.28, ez + stepDirZ * s],
            rotation: [0, side.rot, 0], scale: [2, 1, 1], collision: true
          });
        }
      }
    }

    // ---- 新场景模型 ----
    // 大型货车（semi）
    if (Math.random() > 0.4) {
      entities.push({
        id: nextId('truck'), model: 'truck',
        position: [rand(-35, 35), 0, rand(-35, 35)], rotation: [0, rand(0, Math.PI * 2), 0], scale: [1, 1, 1],
        collision: true, variant: 'semi'
      });
    }
    // 普通货车
    if (Math.random() > 0.5) {
      entities.push({
        id: nextId('truck2'), model: 'truck',
        position: [rand(-35, 35), 0, rand(-35, 35)], rotation: [0, rand(0, Math.PI * 2), 0], scale: [1, 1, 1],
        collision: true, variant: 'truck'
      });
    }
    // 飞机
    if (Math.random() > 0.6) {
      entities.push({
        id: nextId('plane'), model: 'plane',
        position: [rand(-30, 30), 0, rand(-30, 30)], rotation: [0, rand(0, Math.PI * 2), 0], scale: [1, 1, 1],
        collision: true
      });
    }
    // 集装箱（20ft 或 40ft）
    for (var ci = 0; ci < randInt(2, 4); ci++) {
      entities.push({
        id: nextId('container'), model: 'container',
        position: [rand(-35, 35), 0.3, rand(-35, 35)], rotation: [0, rand(0, Math.PI * 2), 0], scale: [1, 1, 1],
        collision: true, size: randChoice(['20ft', '40ft'])
      });
    }
    // 花盆
    for (var pi = 0; pi < randInt(4, 8); pi++) {
      entities.push({
        id: nextId('pot'), model: 'pot',
        position: [rand(-35, 35), 0, rand(-35, 35)], rotation: [0, 0, 0], scale: [1, 1, 1],
        collision: false, size: randChoice(['small', 'large'])
      });
    }

    // ---- v6.7 场景美化：大树 / 高墙 / 摩天轮 / 草地 / 巨石（随机分布）----
    for (var bti = 0; bti < randInt(2, 4); bti++) {
      entities.push({
        id: nextId('bigtree'), model: 'bigtree',
        position: [rand(-38, 38), 0, rand(-38, 38)], rotation: [0, rand(0, Math.PI * 2), 0], scale: [rand(0.9, 1.3), rand(0.9, 1.3), rand(0.9, 1.3)],
        collision: true
      });
    }
    for (var hwi = 0; hwi < randInt(2, 3); hwi++) {
      entities.push({
        id: nextId('highwall'), model: 'highwall',
        position: [rand(-38, 38), 0, rand(-38, 38)], rotation: [0, rand(0, Math.PI * 2), 0], scale: [1, rand(0.85, 1.2), 1],
        collision: true
      });
    }
    for (var fwi = 0; fwi < randInt(1, 2); fwi++) {
      // 摩天轮：体型大，放地图边缘避免挡路；不参与碰撞
      entities.push({
        id: nextId('ferris'), model: 'ferriswheel',
        position: [randChoice([-1, 1]) * rand(32, 40), 0, randChoice([-1, 1]) * rand(32, 40)], rotation: [0, rand(0, Math.PI * 2), 0], scale: [rand(0.65, 0.85), rand(0.65, 0.85), rand(0.65, 0.85)],
        collision: false
      });
    }
    for (var gsi = 0; gsi < randInt(5, 9); gsi++) {
      entities.push({
        id: nextId('grass'), model: 'grass',
        position: [rand(-38, 38), 0, rand(-38, 38)], rotation: [0, rand(0, Math.PI * 2), 0], scale: [rand(0.7, 1.4), rand(0.7, 1.4), rand(0.7, 1.4)],
        collision: false
      });
    }
    for (var bdi = 0; bdi < randInt(3, 6); bdi++) {
      entities.push({
        id: nextId('boulder'), model: 'boulder',
        position: [rand(-38, 38), 0, rand(-38, 38)], rotation: [0, rand(0, Math.PI * 2), 0], scale: [rand(0.8, 1.5), rand(0.8, 1.5), rand(0.8, 1.5)],
        collision: true
      });
    }
    // v6.7 空中飞鸟：2 种（白鸥/深灰猎鸟）随机 2~4 群绕地图上空盘旋
    for (var bri = 0; bri < randInt(2, 4); bri++) {
      var birc = rand(-20, 20), bircc = rand(-20, 20);
      entities.push({
        id: nextId('birds'), model: 'birds',
        position: [birc, rand(20, 28), bircc], rotation: [0, 0, 0], scale: [1, 1, 1],
        collision: false,
        variant: randChoice(['white', 'dark']),
        cx: birc, cz: bircc, radius: rand(28, 55), height: rand(20, 28), speed: rand(1.6, 3.0)
      });
    }

    // v6.8 加特林机枪碉堡：每关随机位置固定 1 座（站桩火力点）
    entities.push({
      id: nextId('gatling'), model: 'gatling',
      position: [rand(-34, 34), 0, rand(-34, 34)], rotation: [0, rand(0, Math.PI * 2), 0], scale: [1, 1, 1],
      collision: true,
      kind: 'gatling'
    });

    // ---- 车辆 ----
    for (var vi = 0; vi < randInt(3, 6); vi++) {
      entities.push({
        id: nextId('vehicle'), model: 'vehicle',
        position: [rand(-35, 35), 0, rand(-35, 35)], rotation: [0, rand(0, Math.PI * 2), 0], scale: [1, 1, 1],
        collision: true, variant: randChoice(['car', 'truck', 'jeep']), color: randColor()
      });
    }

    // ---- 树木 ----
    for (var ti = 0; ti < randInt(10, 18); ti++) {
      entities.push({
        id: nextId('tree'), model: 'tree',
        position: [rand(-40, 40), 0, rand(-40, 40)], rotation: [0, 0, 0], scale: [rand(0.8, 1.4), rand(0.8, 1.4), rand(0.8, 1.4)],
        collision: true
      });
    }

    // ---- 油桶 ----
    for (var bi = 0; bi < randInt(6, 12); bi++) {
      entities.push({
        id: nextId('barrel'), model: 'barrel',
        position: [rand(-38, 38), 0, rand(-38, 38)], rotation: [0, 0, 0], scale: [1, 1, 1],
        collision: true
      });
    }

    // ---- TNT ----
    for (var tni = 0; tni < randInt(3, 6); tni++) {
      entities.push({
        id: nextId('tnt'), model: 'tnt',
        position: [rand(-38, 38), 0, rand(-38, 38)], rotation: [0, rand(0, Math.PI), 0], scale: [1, 1, 1],
        collision: true
      });
    }

    // ---- 灯柱 ----
    for (var li = 0; li < randInt(6, 10); li++) {
      entities.push({
        id: nextId('lamp'), model: 'lamp',
        position: [rand(-35, 35), 0, rand(-35, 35)], rotation: [0, 0, 0], scale: [1, 1, 1],
        collision: true
      });
    }

    // ---- 射击靶 ----
    for (var targi = 0; targi < randInt(2, 4); targi++) {
      entities.push({
        id: nextId('target'), model: 'target',
        position: [rand(-25, 25), 0, rand(-25, 25)], rotation: [0, rand(0, Math.PI * 2), 0], scale: [1, 1, 1],
        collision: false, score: 50
      });
    }

    // ---- 拾取物 ----
    for (var hi = 0; hi < randInt(2, 4); hi++) {
      entities.push({
        id: nextId('pickup-h'), model: 'pickup',
        position: [rand(-30, 30), 0.8, rand(-30, 30)], rotation: [0, 0, 0], scale: [1, 1, 1],
        collision: false, kind: 'health', respawn: 15
      });
    }
    for (var ai = 0; ai < randInt(3, 5); ai++) {
      entities.push({
        id: nextId('pickup-a'), model: 'pickup',
        position: [rand(-30, 30), 0.8, rand(-30, 30)], rotation: [0, 0, 0], scale: [1, 1, 1],
        collision: false, kind: 'ammo', respawn: 15
      });
    }

    // ---- 武器掉落 ----
    entities.push({
      id: nextId('wpn-r'), model: 'weapon',
      position: [rand(-25, 25), 0.8, rand(-25, 25)], rotation: [0, 0, 0], scale: [1, 1, 1],
      collision: false, kind: 'weapon', type: 'rifle', respawn: 25
    });
    entities.push({
      id: nextId('wpn-f'), model: 'weapon',
      position: [rand(-25, 25), 0.8, rand(-25, 25)], rotation: [0, 0, 0], scale: [1, 1, 1],
      collision: false, kind: 'weapon', type: 'flamethrower', respawn: 25
    });
    entities.push({
      id: nextId('wpn-s'), model: 'weapon',
      position: [rand(-25, 25), 0.8, rand(-25, 25)], rotation: [0, 0, 0], scale: [1, 1, 1],
      collision: false, kind: 'weapon', type: 'sniper', respawn: 25
    });

    // ---- 刷怪点 ----
    entities.push({
      id: nextId('spawn1'), model: 'spawner',
      position: [rand(-30, -15), 0, rand(-30, -15)], rotation: [0, 0, 0], scale: [1, 1, 1],
      collision: false
    });
    entities.push({
      id: nextId('spawn2'), model: 'spawner',
      position: [rand(15, 30), 0, rand(-30, -15)], rotation: [0, 0, 0], scale: [1, 1, 1],
      collision: false
    });

    return {
      version: 6,
      playerSpawn: { position: [0, 1.6, 14], yaw: 0 },
      world: {
        fogColor: 0x9db4cc,
        fogNear: 35,
        fogFar: 150,
        gravity: -22,
        playerSpeed: 6,
        sprintSpeed: 9,
        jumpSpeed: 8,
        eyeHeight: 1.6,
        playerRadius: 0.4,
        playerHeight: 1.7,
        maxHealth: 100
      },
      lights: [
        { type: 'ambient', color: 0x8899bb, intensity: 0.55 },
        { type: 'directional', color: 0xfff0dd, intensity: 1.15, position: [25, 40, 15], shadow: true }
      ],
      entities: entities
    };
  }

  // 为每个关卡生成独立布局
  window.SCENE_LAYOUT = generateLayout(1);
  window.SCENE_LAYOUT_LEVEL2 = generateLayout(2);
  // 关3-5 使用相同种子但可通过重新调用生成不同布局
  window.SCENE_LAYOUT_LEVEL3 = generateLayout(3);
  window.SCENE_LAYOUT_LEVEL4 = generateLayout(4);
  window.SCENE_LAYOUT_LEVEL5 = generateLayout(5);
  // v6.5 无尽模式：暴露生成器，每次进入以随机种子生成全新地图
  window.generateLayout = generateLayout;

})();
