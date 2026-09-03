/**
 * scene-layout.js — 场景布局文件（v2：大地图 + 建筑/植被 + 武器掉落）
 * 记录场景中所有元素的坐标/位置/旋转/缩放/碰撞等信息。
 * 主程序通过 window.SCENE_LAYOUT 加载模型并确定模型位置。
 *
 * 约定：
 * - position: [x, y, z]  模型中心（或底部，见各模型注释）坐标
 * - rotation: [x, y, z]  弧度（默认 [0,0,0]）
 * - scale:    [x, y, z]  缩放（默认 [1,1,1]）
 * - collision: true 参与玩家碰撞（主程序用 AABB 推挤）
 * - model 对应的文件: models/<model>.js，注册在 window.MODELS
 * - 实体可带自定义属性（kind/health/speed/damage/shootRange/shootCooldown/respawn/score），
 *   传给模型 create(config) 与主程序逻辑
 */
window.SCENE_LAYOUT = {
  version: 2,

  playerSpawn: {
    position: [0, 1.6, 14],
    yaw: 0        // 初始朝向：朝 -Z（面向北方敌人区）
  },

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

  entities: [
    // ---- 天空 & 地板（floor 默认 40x40，scale 2.5 → 100x100） ----
    { id: 'sky-1', model: 'sky', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], collision: false },
    { id: 'floor-1', model: 'floor', position: [0, 0, 0], rotation: [0, 0, 0], scale: [2.5, 1, 2.5], collision: false },

    // ---- 四面围墙（wall 默认 8x4x0.5，scale.x=11.5 → 92 宽，围出 90x90 场地） ----
    { id: 'wall-n', model: 'wall', position: [0, 0, -45], rotation: [0, 0, 0], scale: [11.5, 1, 1], collision: true },
    { id: 'wall-s', model: 'wall', position: [0, 0, 45], rotation: [0, 0, 0], scale: [11.5, 1, 1], collision: true },
    { id: 'wall-e', model: 'wall', position: [45, 0, 0], rotation: [0, Math.PI / 2, 0], scale: [11.5, 1, 1], collision: true },
    { id: 'wall-w', model: 'wall', position: [-45, 0, 0], rotation: [0, -Math.PI / 2, 0], scale: [11.5, 1, 1], collision: true },

    // ---- 建筑（小屋，w/d/h 控制尺寸） ----
    { id: 'build-1', model: 'building', position: [18, 0, -14], rotation: [0, 0.3, 0], scale: [1, 1, 1], collision: true, w: 6, d: 6, h: 3.6, color: 0x9aa7b8, roofColor: 0x5d4a3a },
    { id: 'build-2', model: 'building', position: [-20, 0, -10], rotation: [0, -0.4, 0], scale: [1, 1, 1], collision: true, w: 8, d: 6, h: 4.0, color: 0xa89070, roofColor: 0x6b4a2f },
    { id: 'build-3', model: 'building', position: [24, 0, 12], rotation: [0, 0.8, 0], scale: [1, 1, 1], collision: true, w: 7, d: 5, h: 3.8, color: 0x8d9bb0, roofColor: 0x4a5568 },
    { id: 'build-4', model: 'building', position: [-26, 0, 16], rotation: [0, -0.9, 0], scale: [1, 1, 1], collision: true, w: 6, d: 7, h: 3.4, color: 0xb0a48a, roofColor: 0x5d4a3a },
    { id: 'build-5', model: 'building', position: [10, 0, 28], rotation: [0, 0.2, 0], scale: [1, 1, 1], collision: true, w: 5, d: 5, h: 3.2, color: 0x7c8a9e, roofColor: 0x4a5568 },
    { id: 'build-6', model: 'building', position: [-14, 0, 30], rotation: [0, -0.15, 0], scale: [1, 1, 1], collision: true, w: 7, d: 5, h: 3.6, color: 0xa58a68, roofColor: 0x6b4a2f },
    { id: 'build-7', model: 'building', position: [34, 0, -26], rotation: [0, 0.5, 0], scale: [1, 1, 1], collision: true, w: 8, d: 6, h: 4.2, color: 0x93a3b8, roofColor: 0x5d4a3a },
    { id: 'build-8', model: 'building', position: [-36, 0, -28], rotation: [0, -0.6, 0], scale: [1, 1, 1], collision: true, w: 6, d: 8, h: 3.8, color: 0xb2a088, roofColor: 0x4a5568 },

    // ---- 树木（点缀场地） ----
    { id: 'tree-1', model: 'tree', position: [6, 0, 8], rotation: [0, 0, 0], scale: [1, 1, 1], collision: true },
    { id: 'tree-2', model: 'tree', position: [-7, 0, 5], rotation: [0, 0, 0], scale: [1.2, 1.2, 1.2], collision: true },
    { id: 'tree-3', model: 'tree', position: [9, 0, -6], rotation: [0, 0, 0], scale: [1, 1, 1], collision: true },
    { id: 'tree-4', model: 'tree', position: [-9, 0, -8], rotation: [0, 0, 0], scale: [0.9, 0.9, 0.9], collision: true },
    { id: 'tree-5', model: 'tree', position: [12, 0, 18], rotation: [0, 0, 0], scale: [1.1, 1.1, 1.1], collision: true },
    { id: 'tree-6', model: 'tree', position: [-13, 0, 20], rotation: [0, 0, 0], scale: [1, 1, 1], collision: true },
    { id: 'tree-7', model: 'tree', position: [16, 0, -20], rotation: [0, 0, 0], scale: [1.3, 1.3, 1.3], collision: true },
    { id: 'tree-8', model: 'tree', position: [-18, 0, -22], rotation: [0, 0, 0], scale: [1, 1, 1], collision: true },
    { id: 'tree-9', model: 'tree', position: [28, 0, 4], rotation: [0, 0, 0], scale: [1.1, 1.1, 1.1], collision: true },
    { id: 'tree-10', model: 'tree', position: [-28, 0, 2], rotation: [0, 0, 0], scale: [0.9, 0.9, 0.9], collision: true },
    { id: 'tree-11', model: 'tree', position: [4, 0, 34], rotation: [0, 0, 0], scale: [1.2, 1.2, 1.2], collision: true },
    { id: 'tree-12', model: 'tree', position: [-6, 0, -30], rotation: [0, 0, 0], scale: [1, 1, 1], collision: true },
    { id: 'tree-13', model: 'tree', position: [30, 0, 24], rotation: [0, 0, 0], scale: [1, 1, 1], collision: true },
    { id: 'tree-14', model: 'tree', position: [-32, 0, -6], rotation: [0, 0, 0], scale: [1.1, 1.1, 1.1], collision: true },
    { id: 'tree-15', model: 'tree', position: [22, 0, -32], rotation: [0, 0, 0], scale: [0.8, 0.8, 0.8], collision: true },

    // ---- 箱子掩体（crate 1x1x1，position.y=0.5 放地面） ----
    { id: 'crate-1', model: 'crate', position: [3, 0.5, -2], rotation: [0, 0.5, 0], scale: [1, 1, 1], collision: true },
    { id: 'crate-2', model: 'crate', position: [4.6, 0.5, -1.5], rotation: [0, -0.3, 0], scale: [1, 1, 1], collision: true },
    { id: 'crate-3', model: 'crate', position: [-3, 0.5, -3], rotation: [0, 0.8, 0], scale: [1, 1, 1], collision: true },
    { id: 'crate-4', model: 'crate', position: [0, 0.5, -5], rotation: [0, 0, 0], scale: [1, 1, 1], collision: true },
    { id: 'crate-5', model: 'crate', position: [1.5, 1.5, -4.5], rotation: [0, 0.4, 0], scale: [1, 1, 1], collision: true },
    { id: 'crate-6', model: 'crate', position: [3, 1.5, -3.2], rotation: [0, -0.2, 0], scale: [1, 1, 1], collision: true },
    { id: 'crate-7', model: 'crate', position: [8, 0.5, 4], rotation: [0, 0.6, 0], scale: [1, 1, 1], collision: true },
    { id: 'crate-8', model: 'crate', position: [-8, 0.5, 3], rotation: [0, -0.4, 0], scale: [1, 1, 1], collision: true },
    { id: 'crate-9', model: 'crate', position: [11, 0.5, -10], rotation: [0, 0.3, 0], scale: [1, 1, 1], collision: true },
    { id: 'crate-10', model: 'crate', position: [-12, 0.5, -9], rotation: [0, -0.7, 0], scale: [1, 1, 1], collision: true },
    { id: 'crate-11', model: 'crate', position: [6, 0.5, -14], rotation: [0, 0.2, 0], scale: [1, 1, 1], collision: true },
    { id: 'crate-12', model: 'crate', position: [-5, 0.5, -16], rotation: [0, -0.5, 0], scale: [1, 1, 1], collision: true },

    // ---- 油桶障碍 ----
    { id: 'obstacle-1', model: 'obstacle', position: [6, 0, -4], rotation: [0, 0, 0], scale: [1, 1, 1], collision: true },
    { id: 'obstacle-2', model: 'obstacle', position: [-6, 0, -6], rotation: [0, 0, 0], scale: [1, 1, 1], collision: true },
    { id: 'obstacle-3', model: 'obstacle', position: [2, 0, -8], rotation: [0, 0, 0], scale: [1, 1, 1], collision: true },
    { id: 'obstacle-4', model: 'obstacle', position: [10, 0, 6], rotation: [0, 0, 0], scale: [1, 1, 1], collision: true },
    { id: 'obstacle-5', model: 'obstacle', position: [-10, 0, 8], rotation: [0, 0, 0], scale: [1, 1, 1], collision: true },
    { id: 'obstacle-6', model: 'obstacle', position: [15, 0, -4], rotation: [0, 0, 0], scale: [1, 1, 1], collision: true },
    { id: 'obstacle-7', model: 'obstacle', position: [-15, 0, 4], rotation: [0, 0, 0], scale: [1, 1, 1], collision: true },

    // ---- 灯柱（自带点光源） ----
    { id: 'lamp-1', model: 'lamp', position: [8, 0, 8], rotation: [0, 0, 0], scale: [1, 1, 1], collision: true },
    { id: 'lamp-2', model: 'lamp', position: [-8, 0, 7], rotation: [0, 0, 0], scale: [1, 1, 1], collision: true },
    { id: 'lamp-3', model: 'lamp', position: [5, 0, -9], rotation: [0, 0, 0], scale: [1, 1, 1], collision: true },
    { id: 'lamp-4', model: 'lamp', position: [-5, 0, -10], rotation: [0, 0, 0], scale: [1, 1, 1], collision: true },
    { id: 'lamp-5', model: 'lamp', position: [16, 0, 10], rotation: [0, 0, 0], scale: [1, 1, 1], collision: true },
    { id: 'lamp-6', model: 'lamp', position: [-16, 0, 12], rotation: [0, 0, 0], scale: [1, 1, 1], collision: true },
    { id: 'lamp-7', model: 'lamp', position: [12, 0, -16], rotation: [0, 0, 0], scale: [1, 1, 1], collision: true },
    { id: 'lamp-8', model: 'lamp', position: [-12, 0, -18], rotation: [0, 0, 0], scale: [1, 1, 1], collision: true },

    // ---- 射击靶 ----
    { id: 'target-1', model: 'target', position: [0, 0, -10], rotation: [0, 0, 0], scale: [1, 1, 1], collision: false, score: 50 },
    { id: 'target-2', model: 'target', position: [-8, 0, -12], rotation: [0, 0.3, 0], scale: [1, 1, 1], collision: false, score: 50 },
    { id: 'target-3', model: 'target', position: [10, 0, -12], rotation: [0, -0.3, 0], scale: [1, 1, 1], collision: false, score: 50 },

    // ---- 敌人（AI/动画/子弹全部在 models/enemy.js；每关还会动态生成更多） ----
    { id: 'enemy-1', model: 'enemy', position: [4, 0, -10], rotation: [0, 0, 0], scale: [1, 1, 1], collision: false,
      health: 100, speed: 1.6, damage: 8, shootRange: 20, shootCooldown: 2.0, respawn: 8, score: 100 },
    { id: 'enemy-2', model: 'enemy', position: [-6, 0, -12], rotation: [0, 0, 0], scale: [1, 1, 1], collision: false,
      health: 120, speed: 1.4, damage: 10, shootRange: 22, shootCooldown: 2.4, respawn: 10, score: 120 },
    { id: 'enemy-3', model: 'enemy', position: [10, 0, -14], rotation: [0, 0, 0], scale: [1, 1, 1], collision: false,
      health: 90, speed: 1.8, damage: 7, shootRange: 18, shootCooldown: 1.8, respawn: 8, score: 90 },

    // ---- 拾取物（kind: health/ammo/weapon；拾取后按 respawn 秒重生） ----
    { id: 'pickup-health-1', model: 'pickup', position: [1, 0.8, -3], rotation: [0, 0, 0], scale: [1, 1, 1], collision: false, kind: 'health', respawn: 15 },
    { id: 'pickup-ammo-1', model: 'pickup', position: [-2, 0.8, -4], rotation: [0, 0, 0], scale: [1, 1, 1], collision: false, kind: 'ammo', respawn: 15 },
    { id: 'pickup-health-2', model: 'pickup', position: [6, 0.8, 2], rotation: [0, 0, 0], scale: [1, 1, 1], collision: false, kind: 'health', respawn: 15 },
    { id: 'pickup-ammo-2', model: 'pickup', position: [-6, 0.8, 0], rotation: [0, 0, 0], scale: [1, 1, 1], collision: false, kind: 'ammo', respawn: 15 },
    { id: 'pickup-ammo-3', model: 'pickup', position: [0, 0.8, -8], rotation: [0, 0, 0], scale: [1, 1, 1], collision: false, kind: 'ammo', respawn: 15 },

    // ---- 武器掉落（可直接拾取新枪） ----
    { id: 'weapon-drop-1', model: 'weapon', position: [14, 0.8, 2], rotation: [0, 0, 0], scale: [1, 1, 1], collision: false, kind: 'weapon', type: 'rifle', respawn: 25 },
    { id: 'weapon-drop-2', model: 'weapon', position: [-14, 0.8, -2], rotation: [0, 0, 0], scale: [1, 1, 1], collision: false, kind: 'weapon', type: 'shotgun', respawn: 25 },
    { id: 'weapon-drop-3', model: 'weapon', position: [0, 0.8, -20], rotation: [0, 0, 0], scale: [1, 1, 1], collision: false, kind: 'weapon', type: 'sniper', respawn: 25 },

    // ---- 刷怪点（装饰性发光传送门） ----
    { id: 'spawner-1', model: 'spawner', position: [-18, 0, -22], rotation: [0, 0, 0], scale: [1, 1, 1], collision: false },
    { id: 'spawner-2', model: 'spawner', position: [18, 0, -24], rotation: [0, 0, 0], scale: [1, 1, 1], collision: false }
  ]
};
