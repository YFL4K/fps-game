# fps-game v8.6（2026-09-06）

## 需求（用户原话）
1. 霸王龙外观太难看不像霸王龙，重新建模，体型缩小50%，外观逼真，出现频率1000分→2万分，移动速度+60%
2. 参考CS修改持枪显示，枪只显示一半后半空缺，需完美显示整把枪

## 实施
- **霸王龙重做**（trex.js create 重写）：
  - 逼真造型：巨大颅骨+前突吻部+两排白牙+张嘴下颚+红发光眼、前倾胸腹、水平渐细长尾(5段微上翘)、粗壮后腿(大腿+小腿+三趾脚掌 pivot)、短小前肢+双爪
  - 体型缩小50%：spawnTrex scale 3.2→1.6
  - 出现频率：nextTrexScore 1000→20000，递增 1000→20000
  - 速度：speed 5→8
- **持枪完整显示**：撤销 v8.4 的枪托隐藏——gun.js create 移除 stock 隐藏 traverse；index.html render 循环移除 aimSlim 瞄准只显枪管逻辑；枪托恢复显示，整把枪完整显示

## 测试（test_v86.py 12/12 通过）
- trexTest（scale 1.6/speed 8/24000/60s）、handsTest（stock 全 visible 完整显示 + barrel）、gunClipTest（0 残缺）
- 回归全过

## 发布
- commit 31a7cbc「v8.6: T-rex realistic remodel + smaller/faster/rarer + full gun display」push 成功
- README 履历 v8.6 已加

## 当前数值口径
- 霸王龙：24000血/60s/速度8/体型scale1.6/每20000分随机出现/喷火踩踏吃蘑菇
- 持枪：完整显示（枪托恢复）