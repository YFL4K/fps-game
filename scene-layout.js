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
    // v11.12：压平点改为「随布局输出的数据」，由主程序在重建地形前统一应用。
    // 旧版直接调 TERRAIN.flatten() → 6 份关卡布局在页面加载时把压平点全部累加进同一列表且
    // 从不 reset：地形被挖出大量与本关无关的坑洞，heightAt 遍历也随重开无限增长（卡顿来源之一）。
    var flattens = [];
    function pad(x, z, r) { flattens.push({ x: x, z: z, r: r }); }

    // v11.19 水面判定：某点（含半径余量）是否落在水线以下 → 用于禁止建筑/车辆/油桶等入水
    function inWater(x, z, margin) {
      if (!window.TERRAIN || window.TERRAIN.waterLevel == null || !window.TERRAIN.heightAt) return false;
      var wl = window.TERRAIN.waterLevel;
      margin = margin || 0;
      if (window.TERRAIN.heightAt(x, z) < wl + 0.15 + margin * 0.15) return true;
      // 采样四角，避免大件边缘压水
      if (margin > 0) {
        var pts = [[x - margin, z], [x + margin, z], [x, z - margin], [x, z + margin]];
        for (var i = 0; i < pts.length; i++) if (window.TERRAIN.heightAt(pts[i][0], pts[i][1]) < wl + 0.1) return true;
      }
      return false;
    }
    // 在 [lo,hi] 随机找一处不沾水的位置（最多 tries 次）；失败返回 null
    function dryRand(lo, hi, margin, tries) {
      for (var t = 0; t < (tries || 12); t++) {
        var x = rand(lo, hi), z = rand(lo, hi);
        if (!inWater(x, z, margin)) return [x, z];
      }
      return null;
    }

    // ---- 基础环境 ----
    entities.push({ id: nextId('sky'), model: 'sky', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], collision: false });
    entities.push({ id: nextId('floor'), model: 'floor', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], collision: false });
    // v11.12 出生点/刷怪点压平（改由 layout.flattens 输出，见上）
    pad(0, 14, 7);
    pad(-38, -38, 10);
    pad(38, -38, 10);
    // v11.12 边界围墙改为「每边 8 段 × 16m」：旧版一边一整条 128m 墙只按中心点高度落地，
    // 起伏地形上必然一头扎进地里、另一头悬空 —— 这就是"外围边界围墙不平齐、陷入地面以下"的根因。
    (function perimeterWalls() {
      var HB = 64, SEG = 16;                       // 地图 ±64，每段 16m（wall 默认宽 8 → scale[0]=2）
      for (var side = 0; side < 4; side++) {
        var horiz = side < 2;                      // 前两条沿 x 轴（北/南），后两条沿 z 轴（东/西）
        var fixed = (side === 0 ? -HB : (side === 1 ? HB : (side === 2 ? HB : -HB)));
        var rotY = horiz ? 0 : Math.PI / 2;
        var tag = ['n', 's', 'e', 'w'][side];
        for (var k = 0; k < 8; k++) {
          var c = -HB + SEG / 2 + k * SEG;         // 段中心 -56..56
          entities.push({
            id: nextId('wall-' + tag + (k + 1)), model: 'wall',
            position: [horiz ? c : fixed, 0, horiz ? fixed : c],
            rotation: [0, rotY, 0], scale: [SEG / 8, 1, 1], collision: true, destructible: false
          });
        }
      }
    })();

    // ---- 建筑（随机放置 6-10 栋）----
    var buildings = [];
    var numBuildings = randInt(6, 10);
    for (var i = 0; i < numBuildings; i++) {
      var bx = rand(-58, 58);
      var bz = rand(-58, 58);
      // 避免与出生点太近
      if (Math.sqrt(bx * bx + bz * bz) < 12) continue;
      if (inWater(bx, bz, 5)) continue;   // v11.19 房子不能建在水里
      var bw = rand(4, 8);
      var bd = rand(4, 8);
      var bh = rand(3, 4.5);
      var bcolor = randColor();
      var broof = randRoofColor();
      var brot = rand(0, Math.PI * 2);
      buildings.push({ x: bx, z: bz, w: bw, d: bd });
      // v11.12 建筑脚下的平整台地改由下方 autoPads() 统一登记（含半径自适应）

      entities.push({
        id: nextId('build'), model: 'building',
        position: [bx, 0, bz], rotation: [0, brot, 0], scale: [1, 1, 1],
        collision: true, w: bw, d: bd, h: bh,
        variant: randInt(0, 4)   // v11.17 多样造型：人字顶/两层/L形/圆塔/平房带门廊，配色在模型内随机鲜艳调色板
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

      // v11.17 建筑旁花池（替代旧「通往屋顶」装饰台阶）；v11.18 提高出现率让花池更常见
      if (Math.random() > 0.15) {
        var fbs = rand(0.85, 1.15);
        entities.push({
          id: nextId('flowerbed'), model: 'flowerbed',
          position: [ex, 0, ez], rotation: [0, side.rot, 0], scale: [fbs, 1, fbs],
          collision: false
        });
      }
    }

    // ---- v11.16 穿模修复：大物件（车/货车/集装箱/飞机）随机放置前做重叠检测 + 重试，
    // 避免镶嵌进建筑墙体或互相堆叠。----
    function insideBuilding(x, z, margin) {
      margin = margin || 1;
      for (var bi = 0; bi < buildings.length; bi++) {
        var b = buildings[bi];
        if (Math.abs(x - b.x) < b.w / 2 + margin && Math.abs(z - b.z) < b.d / 2 + margin) return true;
      }
      return false;
    }
    var largeProps = [];
    function largePropBlocked(x, z, r) {
      if (inWater(x, z, r)) return true;   // v11.19 车辆/货车/集装箱/飞机不入水
      if (insideBuilding(x, z, r)) return true;
      for (var i = 0; i < largeProps.length; i++) {
        var p = largeProps[i];
        var dx = x - p.x, dz = z - p.z;
        if (dx * dx + dz * dz < (p.r + r) * (p.r + r)) return true;
      }
      return false;
    }
    // r=占据半径，place=实际写入 entities 的回调（接收 x,z）
    function placeLargeProp(r, place) {
      for (var t = 0; t < 14; t++) {
        var x = rand(-50, 50), z = rand(-50, 50);
        if (!largePropBlocked(x, z, r)) { largeProps.push({ x: x, z: z, r: r }); place(x, z); return; }
      }
      var dry = dryRand(-50, 50, r, 1) || [rand(-50, 50), rand(-50, 50)];   // 兜底尽量找干地
      place(dry[0], dry[1]);
    }

    // ---- v10.1 墙体掩体结构：走廊/胡同/L形拐角/直墙（利用现有 wall 模型拼接）----
    // wall 默认 8x4x0.5，scale[0] 控制长度，rotation[1] 控制朝向；高度 4 米可作完整掩体
    function placeWallRow(cx, cz, rotY, segCount, segLen, gap) {
      var gp = gap || 0;
      var totalLen = segCount * segLen + (segCount - 1) * gp;
      for (var si = 0; si < segCount; si++) {
        var off = -totalLen / 2 + si * (segLen + gp) + segLen / 2;
        entities.push({
          id: nextId('wall'), model: 'wall',
          position: [cx + off * Math.cos(rotY), 0, cz + off * Math.sin(rotY)],
          rotation: [0, rotY, 0], scale: [segLen / 8, 1, 1], collision: true
        });
      }
    }
    // 检测候选位置是否被出生点/刷怪点/建筑占据（保证掩体不堵关键区域）
    function wallBlocked(cx, cz, margin) {
      margin = margin || 7;
      if (Math.sqrt(cx * cx + (cz - 14) * (cz - 14)) < margin + 6) return true;   // 出生点（额外 6 安全）
      if (cx > -52 - margin && cx < -25 + margin && cz > -52 - margin && cz < -25 + margin) return true;  // 刷怪点1
      if (cx > 25 - margin && cx < 52 + margin && cz > -52 - margin && cz < -25 + margin) return true;      // 刷怪点2
      for (var bi = 0; bi < buildings.length; bi++) {
        var b = buildings[bi];
        if (Math.abs(cx - b.x) < b.w / 2 + margin && Math.abs(cz - b.z) < b.d / 2 + margin) return true;    // 建筑
      }
      return false;
    }
    function tryPlaceWallStruct(maxTry, span, placeFn) {
      for (var t = 0; t < maxTry; t++) {
        var cx = rand(-58, 58), cz = rand(-58, 58);
        if (!wallBlocked(cx, cz, Math.max(span / 2, 6))) { placeFn(cx, cz); return; }
      }
    }

    // 结构1：走廊（两面平行长墙形成直通道掩体，中间 3.2~4.2 米宽可供玩家通过）
    for (var co = 0; co < randInt(2, 3); co++) {
      var ch = Math.random() < 0.5;
      var rotY = ch ? 0 : Math.PI / 2;
      var len = rand(12, 18);
      var seg = Math.max(1, Math.floor(len / 8));
      var width = rand(3.2, 4.2);
      var ox = ch ? 0 : width / 2, oz = ch ? width / 2 : 0;
      tryPlaceWallStruct(8, len, function (cx, cz) {
        placeWallRow(cx + ox, cz + oz, rotY, seg, len / seg, 0.3);
        placeWallRow(cx - ox, cz - oz, rotY, seg, len / seg, 0.3);
      });
    }
    // 结构2：胡同（短墙交错排列形成曲折通道，交替左右侧）
    for (var al = 0; al < randInt(2, 3); al++) {
      var ah = Math.random() < 0.5;
      var arot = ah ? 0 : Math.PI / 2;
      var segLen = rand(4, 6);
      var segCount = randInt(3, 5);
      var aw = rand(3, 3.8);
      var span = segCount * segLen;
      var ax = ah ? 0 : aw, az = ah ? aw : 0;
      tryPlaceWallStruct(8, span, function (cx, cz) {
        for (var s = 0; s < segCount; s++) {
          var side = s % 2 === 0 ? 1 : -1;
          var soff = -span / 2 + s * (span / segCount) + (span / segCount) / 2;
          entities.push({
            id: nextId('wall'), model: 'wall',
            position: [cx + ax * side + soff * Math.cos(arot), 0, cz + az * side + soff * Math.sin(arot)],
            rotation: [0, arot, 0], scale: [segLen / 8, 1, 1], collision: true
          });
        }
      });
    }
    // 结构3：L 形拐角墙（两段成 90 度，形成拐角掩体）
    for (var lc = 0; lc < randInt(3, 5); lc++) {
      var base = randChoice([0, Math.PI / 2, Math.PI, -Math.PI / 2]);
      var l1 = rand(6, 10), l2 = rand(6, 10);
      var bdx = l1 / 2 * Math.cos(base), bdz = l1 / 2 * Math.sin(base);
      tryPlaceWallStruct(6, 10, function (cx, cz) {
        placeWallRow(cx, cz, base, 1, l1, 0);
        placeWallRow(cx + bdx, cz + bdz, base + Math.PI / 2, 1, l2, 0);
      });
    }
    // 结构4：独立直墙段（1~2 段连续墙，含 45 度斜墙，简单掩体）
    for (var sc = 0; sc < randInt(4, 6); sc++) {
      var sr = randChoice([0, Math.PI / 2, Math.PI / 4, -Math.PI / 4]);
      var ss = randInt(1, 2);
      var sl = rand(5, 8);
      tryPlaceWallStruct(6, sl * ss, function (cx, cz) {
        placeWallRow(cx, cz, sr, ss, sl, 0.2);
      });
    }

    // ---- 新场景模型 ----
    // 大型货车（semi）
    if (Math.random() > 0.4) {
      placeLargeProp(8, function (x, z) {
        entities.push({
          id: nextId('truck'), model: 'truck',
          position: [x, 0, z], rotation: [0, rand(0, Math.PI * 2), 0], scale: [1, 1, 1],
          collision: true, variant: 'semi'
        });
      });
    }
    // 普通货车
    if (Math.random() > 0.5) {
      placeLargeProp(6, function (x, z) {
        entities.push({
          id: nextId('truck2'), model: 'truck',
          position: [x, 0, z], rotation: [0, rand(0, Math.PI * 2), 0], scale: [1, 1, 1],
          collision: true, variant: 'truck'
        });
      });
    }
    // 飞机
    if (Math.random() > 0.6) {
      placeLargeProp(10, function (x, z) {
        entities.push({
          id: nextId('plane'), model: 'plane',
          position: [x, 0, z], rotation: [0, rand(0, Math.PI * 2), 0], scale: [1, 1, 1],
          collision: true
        });
      });
    }
    // 集装箱（20ft 或 40ft）
    for (var ci = 0; ci < randInt(2, 4); ci++) {
      placeLargeProp(5, function (x, z) {
        entities.push({
          id: nextId('container'), model: 'container',
          position: [x, 0.3, z], rotation: [0, rand(0, Math.PI * 2), 0], scale: [1, 1, 1],
          collision: true, size: randChoice(['20ft', '40ft'])
        });
      });
    }
    // 花盆
    for (var pi = 0; pi < randInt(4, 8); pi++) {
      var pp = dryRand(-35, 35, 1); if (!pp) continue;
      entities.push({
        id: nextId('pot'), model: 'pot',
        position: [pp[0], 0, pp[1]], rotation: [0, 0, 0], scale: [1, 1, 1],
        collision: false, size: randChoice(['small', 'large'])
      });
    }

    // v11.17 散布花池美化：避开建筑/水面随机放若干长方形花池（出生点附近点缀）
    for (var fbi = 0; fbi < randInt(5, 9); fbi++) {
      var fbx = 0, fbz = 0, fbok = false;
      for (var ft = 0; ft < 10; ft++) {
        fbx = rand(-56, 56); fbz = rand(-56, 56);
        if (insideBuilding(fbx, fbz, 2.2)) continue;
        if (TERR && fbx * fbx + (fbz - 14) * (fbz - 14) < 100) continue;   // 别堵住生区
        if (window.TERRAIN && window.TERRAIN.heightAt && window.TERRAIN.heightAt(fbx, fbz) < window.TERRAIN.waterLevel) continue;  // 不放在水里
        fbok = true; break;
      }
      if (!fbok) continue;
      var fbs2 = rand(0.9, 1.3);
      entities.push({
        id: nextId('flowerbed'), model: 'flowerbed',
        position: [fbx, 0, fbz], rotation: [0, rand(0, Math.PI * 2), 0], scale: [fbs2, 1, fbs2],
        collision: false
      });
    }

    // ---- v6.7 场景美化：大树 / 高墙 / 摩天轮 / 草地 / 巨石（随机分布）----
    for (var bti = 0; bti < randInt(2, 4); bti++) {
      var btp = dryRand(-58, 58, 2); if (!btp) continue;
      entities.push({
        id: nextId('bigtree'), model: 'bigtree',
        position: [btp[0], 0, btp[1]], rotation: [0, rand(0, Math.PI * 2), 0], scale: [rand(0.9, 1.3), rand(0.9, 1.3), rand(0.9, 1.3)],
        collision: true
      });
    }
    for (var hwi = 0; hwi < randInt(2, 3); hwi++) {
      var hwp = dryRand(-58, 58, 2); if (!hwp) continue;
      entities.push({
        id: nextId('highwall'), model: 'highwall',
        position: [hwp[0], 0, hwp[1]], rotation: [0, rand(0, Math.PI * 2), 0], scale: [1, rand(0.85, 1.2), 1],
        collision: true
      });
    }
    // v11.19 摩天轮：每图固定 1 座（不再 1-2），尺寸翻倍(0.65~0.85 → 1.3~1.7)，
    //   经 placeLargeProp 避让建筑与其它大型道具（货车/飞机/集装箱/车辆），不再穿模重叠。
    var fs = rand(1.3, 1.7);
    placeLargeProp(13 * fs, function (x, z) {
      entities.push({
        id: nextId('ferris'), model: 'ferriswheel',
        position: [x, 0, z], rotation: [0, rand(0, Math.PI * 2), 0], scale: [fs, fs, fs],
        collision: false
      });
    });
    for (var gsi = 0; gsi < randInt(5, 9); gsi++) {
      var gsp = dryRand(-58, 58, 1); if (!gsp) continue;
      entities.push({
        id: nextId('grass'), model: 'grass',
        position: [gsp[0], 0, gsp[1]], rotation: [0, rand(0, Math.PI * 2), 0], scale: [rand(0.7, 1.4), rand(0.7, 1.4), rand(0.7, 1.4)],
        collision: false
      });
    }
    // v10.2 椰子树已删除
    // v8.0 蘑菇装饰：不同尺寸/颜色随机分布，提升画面美感（不参与碰撞）
    for (var msi = 0; msi < randInt(6, 12); msi++) {
      var msp = dryRand(-56, 56, 1); if (!msp) continue;
      var ms = rand(0.4, 1.6);
      entities.push({
        id: nextId('mushroom'), model: 'mushroom',
        position: [msp[0], 0, msp[1]], rotation: [0, rand(0, Math.PI * 2), 0], scale: [ms, ms, ms],
        collision: false,
        variant: randChoice(['red', 'flyagaric', 'brown', 'orange', 'purple', 'teal', 'yellow', 'pink', 'white'])
      });
    }
    // v6.7 空中飞鸟：2 种（白鸥/深灰猎鸟）随机 2~4 群绕地图上空盘旋
    for (var bri = 0; bri < randInt(2, 4); bri++) {
      var birc = rand(-35, 35), bircc = rand(-35, 35);
      entities.push({
        id: nextId('birds'), model: 'birds',
        position: [birc, rand(20, 28), bircc], rotation: [0, 0, 0], scale: [1, 1, 1],
        collision: false,
        variant: randChoice(['white', 'dark']),
        cx: birc, cz: bircc, radius: rand(28, 55), height: rand(20, 28), speed: rand(1.6, 3.0)
      });
    }

    // v6.8 加特林机枪碉堡：每关随机位置固定 1 座（站桩火力点），避开水面
    var gtp = dryRand(-54, 54, 3); if (gtp) {
      entities.push({
        id: nextId('gatling'), model: 'gatling',
        position: [gtp[0], 0, gtp[1]], rotation: [0, rand(0, Math.PI * 2), 0], scale: [1, 1, 1],
        collision: true,
        kind: 'gatling'
      });
    }

    // ---- v11.1 瞭望塔：每关 / 无尽随机 1 座，可攀爬（台阶碰撞体）+ 不可破坏 ----
    var towerPos = null;
    (function placeTower() {
      var tx = 0, tz = 0, ok = false;
      for (var t = 0; t < 40; t++) {
        tx = rand(-54, 54); tz = rand(-54, 54);
        if (Math.sqrt(tx * tx + (tz - 14) * (tz - 14)) < 12) continue;   // 远离出生点
        if (inWater(tx, tz, 6)) continue;   // v11.19 塔不能建在水里
        var clash = false;
        for (var bi = 0; bi < buildings.length; bi++) {
          var b = buildings[bi];
          if (Math.abs(tx - b.x) < b.w / 2 + 4 && Math.abs(tz - b.z) < b.d / 2 + 4) { clash = true; break; }
        }
        if (clash) continue;
        ok = true; break;
      }
      if (!ok) return;
      var PH = 13.44;   // 平台顶面高度（v11.5 再高 1 倍），需与 watchtower.js 一致
      towerPos = { x: tx, z: tz };
      // v11.12 瞭望塔脚下平整台地由下方 autoPads() 统一登记
      entities.push({ id: nextId('tower'), model: 'watchtower',
        position: [tx, 0, tz], rotation: [0, 0, 0], scale: [1, 1, 1], collision: false, destructible: false });
      // v11.19 塔基四周花池点缀
      for (var ts = 0; ts < 4; ts++) {
        var ta = ts * Math.PI / 2 + Math.PI / 4;
        entities.push({ id: nextId('towerbed'), model: 'flowerbed',
          position: [tx + Math.sin(ta) * 4.2, 0, tz + Math.cos(ta) * 4.2],
          rotation: [0, ta, 0], scale: [1, 1, 1], collision: false });
      }
      // v11.20 塔顶加特林：+z 入口侧平台边缘（面向外侧，登顶即可看到/使用）
      entities.push({ id: nextId('towergatling'), model: 'gatling',
        position: [tx, PH, tz + 0.6], rotation: [0, 0, 0], scale: [1, 1, 1], collision: true, kind: 'gatling' });
      // v11.20 隐形攀登碰撞体：螺旋楼梯 48 级（半径 1.0，在塔内；视觉在 watchtower.js 模型内部）
      var N = 48, SR = 1.0, stepRise = (PH - 0.14) / (N - 1), SD = 4 * Math.PI / (N - 1);
      for (var s = 0; s < N; s++) {
        var th = s * SD;
        entities.push({ id: nextId('towerstep'), model: 'step',
          position: [tx + SR * Math.sin(th), 0.14 + s * stepRise, tz + SR * Math.cos(th)],
          rotation: [0, th, 0], scale: [1.0, 1, 0.7],
          collision: true, destructible: false, climbOnly: true, hidden: true, color: 0x7a5230 });
      }
      // 塔顶平台碰撞体（登顶后可站立行走）
      entities.push({ id: nextId('towerplat'), model: 'step',
        position: [tx, PH - 0.14, tz], rotation: [0, 0, 0], scale: [3.2, 1, 3.2],
        collision: true, destructible: false, climbOnly: true, hidden: true, color: 0x6b4a2f });
    })();

    // ---- 车辆 ----
    for (var vi = 0; vi < randInt(3, 6); vi++) {
      placeLargeProp(4.5, function (x, z) {
        entities.push({
          id: nextId('vehicle'), model: 'vehicle',
          position: [x, 0, z], rotation: [0, rand(0, Math.PI * 2), 0], scale: [1, 1, 1],
          collision: true, variant: randChoice(['car', 'truck', 'jeep']), color: randColor()
        });
      });
    }

    // ---- 树木：聚集成“林地”，更符合森林样貌；林地内 5% 为 2 倍大树 ----
    var TERR = window.TERRAIN;
    function onWater(x, z) {
      if (!TERR) return false;
      var wl = (TERR.waterLevel != null) ? TERR.waterLevel : -0.55;
      return TERR.heightAt(x, z) < wl;   // 湖面以下不种树
    }
    function treeBlocked(x, z, m) {
      if (Math.sqrt(x * x + (z - 14) * (z - 14)) < (m + 8)) return true;        // 出生点
      if (x > -52 - m && x < -25 + m && z > -52 - m && z < -25 + m) return true; // 刷怪点1
      if (x > 25 - m && x < 52 + m && z > -52 - m && z < -25 + m) return true;   // 刷怪点2
      for (var bi = 0; bi < buildings.length; bi++) {
        var b = buildings[bi];
        if (Math.abs(x - b.x) < b.w / 2 + m && Math.abs(z - b.z) < b.d / 2 + m) return true;
      }
      if (towerPos && Math.sqrt((x - towerPos.x) * (x - towerPos.x) + (z - towerPos.z) * (z - towerPos.z)) < (m + 9)) return true;
      return false;
    }
    var placedTrees = [];
    function tryTree(x, z, giant) {
      if (onWater(x, z)) return false;
      if (treeBlocked(x, z, giant ? 3.5 : 1.8)) return false;
      for (var p = 0; p < placedTrees.length; p++) {
        var dx = x - placedTrees[p].x, dz = z - placedTrees[p].z;
        var minD = (giant ? 4.5 : 2.2) + (placedTrees[p].giant ? 2.5 : 0);
        if (dx * dx + dz * dz < minD * minD) return false;
      }
      placedTrees.push({ x: x, z: z, giant: giant });
      if (giant) {
        var gs = rand(1.8, 2.6);   // 比当前大树(0.9~1.3)大约 2 倍
        entities.push({
          id: nextId('bigtree'), model: 'bigtree',
          position: [x, 0, z], rotation: [0, rand(0, Math.PI * 2), 0], scale: [gs, gs, gs],
          collision: true
        });
      } else {
        entities.push({
          id: nextId('tree'), model: 'tree',
          position: [x, 0, z], rotation: [0, rand(0, Math.PI * 2), 0], scale: [rand(0.8, 1.4), rand(0.8, 1.4), rand(0.8, 1.4)],
          collision: true
        });
      }
      return true;
    }
    // 生成 3~4 片林地，林内树木按半径高斯散布（更集中）
    var numForests = randInt(3, 4);
    for (var fi = 0; fi < numForests; fi++) {
      var fx = rand(-54, 54), fz = rand(-54, 54);
      var fr = rand(9, 15);
      var fcount = randInt(10, 16);
      var total = 0, tries = 0;
      while (total < fcount && tries < fcount * 4) {
        tries++;
        var ang = rand(0, Math.PI * 2), rad = fr * Math.sqrt(rand(0, 1)) * 0.9;
        var tx = fx + Math.cos(ang) * rad, tz = fz + Math.sin(ang) * rad;
        if (tx < -60 || tx > 60 || tz < -60 || tz > 60) continue;
        var giant = (Math.random() < 0.05);   // 林地内 5% 巨树
        if (tryTree(tx, tz, giant)) total++;
      }
    }
    // 另保留少量零散树木点缀（不含巨树）
    for (var sti = 0; sti < randInt(4, 8); sti++) {
      tryTree(rand(-60, 60), rand(-60, 60), false);
    }

    // ---- 油桶 ----
    for (var bi = 0; bi < randInt(6, 12); bi++) {
      var bp = dryRand(-58, 58, 1); if (!bp) continue;
      entities.push({
        id: nextId('barrel'), model: 'barrel',
        position: [bp[0], 0, bp[1]], rotation: [0, 0, 0], scale: [1, 1, 1],
        collision: true
      });
    }

    // ---- TNT ----
    for (var tni = 0; tni < randInt(3, 6); tni++) {
      var tp = dryRand(-58, 58, 1); if (!tp) continue;
      entities.push({
        id: nextId('tnt'), model: 'tnt',
        position: [tp[0], 0, tp[1]], rotation: [0, rand(0, Math.PI), 0], scale: [1, 1, 1],
        collision: true
      });
    }

    // ---- 灯柱 ----
    for (var li = 0; li < randInt(6, 10); li++) {
      var lp = dryRand(-35, 35, 1); if (!lp) continue;
      entities.push({
        id: nextId('lamp'), model: 'lamp',
        position: [lp[0], 0, lp[1]], rotation: [0, 0, 0], scale: [1, 1, 1],
        collision: true
      });
    }

    // ---- 射击靶 ----
    for (var targi = 0; targi < randInt(2, 4); targi++) {
      var tg = dryRand(-45, 45, 1); if (!tg) continue;
      entities.push({
        id: nextId('target'), model: 'target',
        position: [tg[0], 0, tg[1]], rotation: [0, rand(0, Math.PI * 2), 0], scale: [1, 1, 1],
        collision: false, score: 50
      });
    }

    // ---- 拾取物 ----
    for (var hi = 0; hi < randInt(2, 4); hi++) {
      var hp = dryRand(-50, 50, 1); if (!hp) continue;
      entities.push({
        id: nextId('pickup-h'), model: 'pickup',
        position: [hp[0], 0.8, hp[1]], rotation: [0, 0, 0], scale: [1, 1, 1],
        collision: false, kind: 'health', respawn: 15
      });
    }
    for (var ai = 0; ai < randInt(3, 5); ai++) {
      var ap = dryRand(-50, 50, 1); if (!ap) continue;
      entities.push({
        id: nextId('pickup-a'), model: 'pickup',
        position: [ap[0], 0.8, ap[1]], rotation: [0, 0, 0], scale: [1, 1, 1],
        collision: false, kind: 'ammo', respawn: 15
      });
    }

    // ---- 武器掉落 ----
    var wpnSpots = [dryRand(-45, 45, 1), dryRand(-45, 45, 1), dryRand(-45, 45, 1)];
    var wpnTypes = ['rifle', 'flamethrower', 'sniper'];
    for (var wi = 0; wi < 3; wi++) {
      if (!wpnSpots[wi]) continue;
      entities.push({
        id: nextId('wpn-' + wi), model: 'weapon',
        position: [wpnSpots[wi][0], 0.8, wpnSpots[wi][1]], rotation: [0, 0, 0], scale: [1, 1, 1],
        collision: false, kind: 'weapon', type: wpnTypes[wi], respawn: 25
      });
    }

    // ---- 刷怪点 ----
    entities.push({
      id: nextId('spawn1'), model: 'spawner',
      position: [rand(-52, -25), 0, rand(-52, -25)], rotation: [0, 0, 0], scale: [1, 1, 1],
      collision: false
    });
    entities.push({
      id: nextId('spawn2'), model: 'spawner',
      position: [rand(25, 52), 0, rand(-52, -25)], rotation: [0, 0, 0], scale: [1, 1, 1],
      collision: false
    });

    // ---- v11.12：为大型落地物自动登记「平整台地」----
    // 刚性大体量模型（楼、摩天轮、飞机、高墙、集装箱…）只按中心点高度落地，在起伏地形上
    // 必然四脚悬空或单边陷地；给它一块"保持局部高度的平地"才是正解（小物件不用，浪费且显平）。
    (function autoPads() {
      for (var pi = 0; pi < entities.length; pi++) {
        var e = entities[pi], r = 0, sc = e.scale ? Math.abs(e.scale[0]) : 1;
        switch (e.model) {
          case 'building':    r = Math.max(e.w || 6, e.d || 6) / 2 + 6; break;
          case 'watchtower':  r = 10; break;      // 覆盖半径 2m 的螺旋台阶 + 平台
          case 'ferriswheel': r = 15 * sc; break;
          case 'highwall':    r = 7; break;
          case 'plane':       r = 10; break;
          case 'truck':       r = 6; break;
          case 'container':   r = 5; break;
          case 'vehicle':     r = 4.5; break;
          case 'gatling':     r = 3.5; break;
          default: break;
        }
        if (r > 0) pad(e.position[0], e.position[2], r);
      }
    })();

    return {
      version: 6,
      playerSpawn: { position: [0, 1.6, 14], yaw: 0 },
      flattens: flattens,                         // v11.12 由主程序在重建地形前应用
      world: {
        fogColor: 0xdcefff,
        fogNear: 90,
        fogFar: 340,
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
