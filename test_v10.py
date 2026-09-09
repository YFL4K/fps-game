#!/usr/bin/env python3
# v10.0 测试 — 基于 V9.2 性能优化：删樱花树/删机甲激光/烟雾减少/猪头佳强化/材质优化
import sys
from playwright.sync_api import sync_playwright

URL = "file:///run/csi/mount-root/nas/4079184d856ecc166ed19d4887083405/workspaces/default/fps-game/index.html#test"
results = []

def check(name, cond, extra=""):
    results.append((name, bool(cond), extra))
    print(("PASS " if cond else "FAIL ") + name)

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

    check("versionTag == v10.0", page.text_content("#versionTag").strip() == "v10.0")

    page.click("#modeStoryBtn")
    page.wait_for_timeout(1200)

    # v10 樱花树已删除，椰子树回归
    check("sakura removed / coconut restored", page.evaluate("window.__fpsTest.coconutTest()")["ok"])

    # 猪头佳系列
    check("pigTrigger(10kills)", page.evaluate("window.__fpsTest.pigTriggerTest()")["ok"])
    check("pig health 55000", page.evaluate("window.__fpsTest.enemyHealthTest()")["ok"])
    check("pig speed 39/life 90/defense 2", page.evaluate("window.__fpsTest.pigSpeedTest()")["ok"])
    check("pig laser 20deg", page.evaluate("window.__fpsTest.pigLaserPitchSweepTest()")["ok"])

    # 战斗系统
    check("berserk 30%", page.evaluate("window.__fpsTest.berserkTest()")["ok"])
    check("shield 15s cap", page.evaluate("window.__fpsTest.shieldKillTest()")["ok"])
    check("bgm volume 0.24", page.evaluate("window.__fpsTest.bgmVolumeTest()")["ok"])
    check("boss L3 dmg36/speed1.4", page.evaluate("window.__fpsTest.bossStatsTest()")["ok"])
    check("big-enemy no-clip", page.evaluate("window.__fpsTest.collideBigTest()")["ok"])

    # 空中支援/核弹
    check("air stacks 3", page.evaluate("window.__fpsTest.awardMilestoneTest()")["ok"])
    check("air cap3 + nuke cap1", page.evaluate("window.__fpsTest.itemCapTest()")["ok"])

    # 枪械
    check("6 guns no-clip", page.evaluate("window.__fpsTest.gunClipTest()")["ok"])
    check("stock visible", page.evaluate("window.__fpsTest.handsTest()")["ok"])
    check("crosshair green/red", page.evaluate("window.__fpsTest.crosshairTest()")["ok"])
    check("sniper 3/s + rocket 210", page.evaluate("window.__fpsTest.gunStatsTest()")["ok"])

    # v9.2 新增
    check("no hand meshes", page.evaluate("window.__fpsTest.noHandsTest()")["ok"])
    check("no sightGlow", page.evaluate("window.__fpsTest.noSightGlowTest()")["ok"])

    # 道具/装饰/敌人
    check("jetpack cap1", page.evaluate("window.__fpsTest.jetpackTest()")["ok"])
    check("trex scale1.6/speed8", page.evaluate("window.__fpsTest.trexTest()")["ok"])
    check("mushroom 6~12", page.evaluate("window.__fpsTest.mushroomTest()")["ok"])
    check("gun pickup no-switch", page.evaluate("window.__fpsTest.gunPickupTest()")["ok"])
    check("stats fields", page.evaluate("window.__fpsTest.statsTest()")["ok"])
    check("perf pixelRatio/FX_MAX", page.evaluate("window.__fpsTest.perfTest()")["ok"])

    runtime_errs = [e for e in errs if "favicon" not in e.lower() and "net::" not in e.lower() and "403" not in e]
    check("no runtime errors", len(runtime_errs) == 0)
    if runtime_errs:
        print("  ERRORS:", runtime_errs[:10])

    browser.close()

fails = [r for r in results if not r[1]]
print("\n==== %d/%d passed ====" % (len(results) - len(fails), len(results)))
if fails:
    print("FAILED:", [f[0] for f in fails])
    sys.exit(1)
