/**
 * scene-layout-level2.js — 第 2 关：火车站场景
 * 包含：火车站台、铁轨、火车车厢、远山、云彩、站台建筑、灯柱等
 * 
 * 参考图像：动漫风格的山脉风景，有火车站元素
 */
window.SCENE_LAYOUT_LEVEL2 = {
  version: 2,

  playerSpawn: {
    position: [0, 1.6, 0],
    yaw: 0
  },

  world: {
    fogColor: 0x8fa3bf,
    fogNear: 40,
    fogFar: 180,
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
    { type: 'ambient', color: 0x8899bb, intensity: 0.6 },
    { type: 'directional', color: 0xfff0dd, intensity: 1.15, position: [30, 50, 20], shadow: true }
  ],

  entities: [
    // ---- 天空 & 地板 ----
    { id: 'sky-2', model: 'sky', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], collision: false },
    
    // 火车站地面（混凝土站台）
    { id: 'floor-2a', model: 'floor', position: [0, 0, 0], rotation: [0, 0, 0], scale: [2.8, 1, 1.2], collision: false },
    // 铁轨区域地面
    { id: 'floor-2b', model: 'floor', position: [0, 0, 40], rotation: [0, 0, 0], scale: [2.5, 1, 2.0], collision: false },

    // ---- 四面围墙 ----
    { id: 'wall-n', model: 'wall', position: [0, 0, -48], rotation: [0, 0, 0], scale: [12, 1, 1], collision: true },
    { id: 'wall-s', model: 'wall', position: [0, 0, 68], rotation: [0, 0, 0], scale: [12, 1, 1], collision: true },
    { id: 'wall-e', model: 'wall', position: [50, 0, 10], rotation: [0, Math.PI / 2, 0], scale: [12, 1, 1], collision: true },
    { id: 'wall-w', model: 'wall', position: [-50, 0, 10], rotation: [0, -Math.PI / 2, 0], scale: [12, 1, 1], collision: true },

    // ---- 铁轨（两条平行轨道）----
    // 轨道枕木（横向）
    { id: 'rail-sleep-1', model: 'step', position: [0, 0.08, 35], rotation: [0, 0, 0], scale: [1.8, 1, 0.15], collision: true },
    { id: 'rail-sleep-2', model: 'step', position: [0, 0.08, 37], rotation: [0, 0, 0], scale: [1.8, 1, 0.15], collision: true },
    { id: 'rail-sleep-3', model: 'step', position: [0, 0.08, 39], rotation: [0, 0, 0], scale: [1.8, 1, 0.15], collision: true },
    { id: 'rail-sleep-4', model: 'step', position: [0, 0.08, 41], rotation: [0, 0, 0], scale: [1.8, 1, 0.15], collision: true },
    { id: 'rail-sleep-5', model: 'step', position: [0, 0.08, 43], rotation: [0, 0, 0], scale: [1.8, 1, 0.15], collision: true },
    // 铁轨（纵向金属条）
    { id: 'rail-track-l', model: 'step', position: [-0.5, 0.12, 39], rotation: [0, 0, 0], scale: [0.06, 1, 5.0], collision: true },
    { id: 'rail-track-r', model: 'step', position: [0.5, 0.12, 39], rotation: [0, 0, 0], scale: [0.06, 1, 5.0], collision: true },

    // ---- 火车车厢（程序化，停靠在站台旁）----
    // 车厢主体（灰色客车厢）
    { id: 'train-body-1', model: 'building', position: [0, 1.2, 40], rotation: [0, 0, 0], scale: [1, 1, 1], collision: true, w: 3.2, d: 12, h: 2.4, color: 0x4a5d6e, roofColor: 0x2d3748 },
    // 车厢窗户（深色玻璃）
    { id: 'train-window-1', model: 'building', position: [-1.55, 1.8, 40], rotation: [0, 0, 0], scale: [0.08, 0.8, 10], collision: false },
    { id: 'train-window-2', model: 'building', position: [1.55, 1.8, 40], rotation: [0, 0, 0], scale: [0.08, 0.8, 10], collision: false },
    // 车厢连接处
    { id: 'train-joint-1', model: 'step', position: [0, 0.6, 46.5], rotation: [0, 0, 0], scale: [3.5, 1, 0.3], collision: true },
    
    // 第二节车厢（绿色货运车厢）
    { id: 'train-body-2', model: 'building', position: [0, 1.2, 62], rotation: [0, 0, 0], scale: [1, 1, 1], collision: true, w: 3.2, d: 10, h: 2.6, color: 0x5d4a3a, roofColor: 0x3d2f1f },
    { id: 'train-joint-2', model: 'step', position: [0, 0.6, 67.5], rotation: [0, 0, 0], scale: [3.5, 1, 0.3], collision: true },

    // ---- 站台建筑 ----
    // 候车大厅（左侧）
    { id: 'station-1', model: 'building', position: [-20, 0, 10], rotation: [0, 0.2, 0], scale: [1, 1, 1], collision: true, w: 8, d: 6, h: 4.5, color: 0xa09080, roofColor: 0x5d4a3a },
    // 售票厅（右侧）
    { id: 'station-2', model: 'building', position: [18, 0, 8], rotation: [0, -0.3, 0], scale: [1, 1, 1], collision: true, w: 5, d: 5, h: 3.8, color: 0xb0a090, roofColor: 0x4a3a2a },
    // 行李房（后方）
    { id: 'station-3', model: 'building', position: [0, 0, -25], rotation: [0, 0, 0], scale: [1, 1, 1], collision: true, w: 6, d: 4, h: 3.2, color: 0x908880, roofColor: 0x3d3530 },

    // ---- 站台上层结构（遮雨棚支柱）----
    { id: 'canopy-pole-1', model: 'step', position: [-6, 0, 39], rotation: [0, 0, 0], scale: [0.15, 1, 0.15], collision: true },
    { id: 'canopy-pole-2', model: 'step', position: [6, 0, 39], rotation: [0, 0, 0], scale: [0.15, 1, 0.15], collision: true },
    { id: 'canopy-pole-3', model: 'step', position: [-6, 0, 42], rotation: [0, 0, 0], scale: [0.15, 1, 0.15], collision: true },
    { id: 'canopy-pole-4', model: 'step', position: [6, 0, 42], rotation: [0, 0, 0], scale: [0.15, 1, 0.15], collision: true },
    // 遮雨棚顶
    { id: 'canopy-roof', model: 'step', position: [0, 5.5, 40], rotation: [0, 0, 0], scale: [13, 0.1, 7], collision: false },

    // ---- 站台边缘台阶 ----
    { id: 'platform-edge-1', model: 'step', position: [-4, 0.28, 39], rotation: [0, 0, 0], scale: [8, 1, 1], collision: true },
    { id: 'platform-edge-2', model: 'step', position: [-4, 0.28, 42], rotation: [0, 0, 0], scale: [8, 1, 1], collision: true },

    // ---- 站台灯柱 ----
    { id: 'lamp-1', model: 'lamp', position: [-8, 0, 39], rotation: [0, 0, 0], scale: [1, 1, 1], collision: true },
    { id: 'lamp-2', model: 'lamp', position: [8, 0, 39], rotation: [0, 0, 0], scale: [1, 1, 1], collision: true },
    { id: 'lamp-3', model: 'lamp', position: [-8, 0, 42], rotation: [0, 0, 0], scale: [1, 1, 1], collision: true },
    { id: 'lamp-4', model: 'lamp', position: [8, 0, 42], rotation: [0, 0, 0], scale: [1, 1, 1], collision: true },

    // ---- 站台座椅 ----
    { id: 'bench-1', model: 'vehicle', position: [-5, 0.45, 38], rotation: [0, 0, 0], scale: [1, 1, 1], collision: true, variant: 'car', color: 0x5d4a3a },
    { id: 'bench-2', model: 'vehicle', position: [5, 0.45, 38], rotation: [0, 0, 0], scale: [1, 1, 1], collision: true, variant: 'car', color: 0x5d4a3a },

    // ---- 障碍物/掩体 ----
    { id: 'crate-1', model: 'crate', position: [-3, 0.5, 25], rotation: [0, 0.3, 0], scale: [1, 1, 1], collision: true },
    { id: 'crate-2', model: 'crate', position: [3, 0.5, 25], rotation: [0, -0.2, 0], scale: [1, 1, 1], collision: true },
    { id: 'crate-3', model: 'crate', position: [-3, 0.5, 28], rotation: [0, 0.5, 0], scale: [1, 1, 1], collision: true },
    { id: 'crate-4', model: 'crate', position: [3, 0.5, 28], rotation: [0, -0.4, 0], scale: [1, 1, 1], collision: true },

    // ---- 爆炸物 ----
    { id: 'barrel-1', model: 'barrel', position: [-2, 0, 32], rotation: [0, 0, 0], scale: [1, 1, 1], collision: true },
    { id: 'barrel-2', model: 'barrel', position: [2, 0, 32], rotation: [0, 0, 0], scale: [1, 1, 1], collision: true },
    { id: 'barrel-3', model: 'barrel', position: [-2, 0, 36], rotation: [0, 0, 0], scale: [1, 1, 1], collision: true },
    { id: 'barrel-4', model: 'barrel', position: [2, 0, 36], rotation: [0, 0, 0], scale: [1, 1, 1], collision: true },

    { id: 'tnt-1', model: 'tnt', position: [-4, 0, 45], rotation: [0, 0.3, 0], scale: [1, 1, 1], collision: true },
    { id: 'tnt-2', model: 'tnt', position: [4, 0, 45], rotation: [0, -0.3, 0], scale: [1, 1, 1], collision: true },

    // ---- 刷怪点 ----
    { id: 'spawner-1', model: 'spawner', position: [-15, 0, -35], rotation: [0, 0, 0], scale: [1, 1, 1], collision: false },
    { id: 'spawner-2', model: 'spawner', position: [15, 0, -35], rotation: [0, 0, 0], scale: [1, 1, 1], collision: false },
    { id: 'spawner-3', model: 'spawner', position: [-15, 0, 50], rotation: [0, 0, 0], scale: [1, 1, 1], collision: false },
    { id: 'spawner-4', model: 'spawner', position: [15, 0, 50], rotation: [0, 0, 0], scale: [1, 1, 1], collision: false }
  ]
};
