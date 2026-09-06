#!/usr/bin/env python3
# v7.3 headless E2E test — 5000分空袭奖励+猪头佳激光武器+猪头佳10杀触发
import sys
from playwright.sync_api import sync_playwright

URL = "file:///run/csi/mount-root/nas/4079184d856ecc166ed19d4887083405/workspaces/default/fps-game/index.html#test"
results = []

def check(name, cond, extra=""):
    results.append((name, bool(cond), extra))
    print(("PASS " if cond else "FAIL ") + name + ("  | " + str(extra) if extra else ""))

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path="/usr/bin/chromium",
                                args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader",
                                      "--no-sandbox", "--autoplay-policy=no-user-gesture-required"])
    page = browser.new_page(viewport={"width": 1280, "height": 720})
    errs = []
    page.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.goto(URL)
    page.wait_for_timeout(2500)

    # 0. versionTag
    vtag = page.text_content("#versionTag")
    check("versionTag == v7.3", vtag.strip() == "v7.3", vtag)

    # 1. 进入游戏
    page.click("#modeStoryBtn")
    page.wait_for_timeout(1200)

    # 2. 需求2：猪头佳 10 杀触发（所有关卡+无尽共用 onEnemyKilled 逻辑）
    t = page.evaluate("window.__fpsTest.pigTriggerTest()")
    check("pig trigger at 10 kills", t["ok"], t)

    # 3. 需求3a：激光状态机 5s on / 3s off
    s = page.evaluate("window.__fpsTest.pigLaserStateTest()")
    check("pig laser 5s on / 3s off cycle", s["ok"], {k: v for k, v in s.items() if k in ("s0", "s1", "s2", "s3", "s4", "beams", "beamVisible")})

    # 4. 需求3b：激光对玩家 20/秒（钳制上限）
    p1 = page.evaluate("window.__fpsTest.pigLaserPlayerTest()")
    check("laser dmg player 20/s", p1["ok"], p1)

    # 5. 需求3c：激光对其它敌人 50/秒
    pe = page.evaluate("window.__fpsTest.pigLaserEnemyTest()")
    check("laser dmg enemy 50/s", pe["ok"], pe)

    # 6. 需求3d：射程 200 外不受伤害
    pr = page.evaluate("window.__fpsTest.pigLaserRangeTest()")
    check("laser range 200 (no dmg beyond)", pr["ok"], pr)

    # 7. 需求1：每 5000 分奖励空袭×1 + 满血（跨门槛累积、奖励优先消耗）
    a = page.evaluate("window.__fpsTest.awardMilestoneTest()")
    check("5000-score award milestone", a["ok"], {k: v for k, v in a.items() if k != "ok"})

    # 8. 运行时无 JS 错误
    runtime_errs = [e for e in errs if "favicon" not in e.lower() and "net::" not in e.lower() and "403" not in e]
    check("no runtime errors", len(runtime_errs) == 0, runtime_errs[:5])

    browser.close()

fails = [r for r in results if not r[1]]
print("\n==== %d/%d passed ====" % (len(results) - len(fails), len(results)))
if fails:
    print("FAILED:", [f[0] for f in fails])
    sys.exit(1)