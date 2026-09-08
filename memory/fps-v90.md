# fps-game v9.0 正式版（2026-09-06）

## 目标
正式版发布前整体运行测试，修复 bug，优化性能，修复贴图错误。

## 实施
- **全量回归测试**：test_v90.py 覆盖 v7.3~v8.6 共 24 项核心功能钩子，24/24 全过，无 runtime errors
- **性能优化**：trex.js 受击闪红 `new T.Color()` → `emissive.setHex()`（消除每帧临时对象）；沿用 pixelRatio≤1.5 / FX_MAX 450 / 碎片弹壳爆炸几何共享 / 全局 Box3·Color 复用
- **贴图/渲染**：枪械完整显示（v8.6 恢复枪托）；大体型敌人无穿模；装饰物随机分布正常

## 测试结果（24/24 通过）
- pigTrigger / pig health 24000 / pig speed 18.2·life 90·defense 2 / pig laser 20deg
- berserk 30% / shield 15s / bgm 0.24 / boss L3 / big-enemy no-clip
- air stacks 3 / air cap3+nuke cap1
- 6 guns no-clip / stock visible / crosshair / sniper 3/s+rocket 210
- jetpack cap1 / trex scale1.6·speed8 / coconut no-boulder / mushroom 6~12 / gun pickup / stats / perf
- no runtime errors

## 发布
- commit 5c7fdb3「v9.0 official: full regression pass + trex color reuse perf + fixes」push 成功
- README 履历 v9.0 已加