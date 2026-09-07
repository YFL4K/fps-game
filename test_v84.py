#!/usr/bin/env python3
# v8.4 headless E2E test — 喷气飞行器 · 狙击射速 · BOSS激光 · 霸王龙 · 枪模改造 + 回归
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

    vtag = page.text_content("#versionTag")
    check("versionTag == v8.4", vtag.strip() == "v8.4", vtag)

    page.click("#modeStoryBtn")
    page.wait_for_timeout(1200)

    # --- v8.4 需求2：狙击射速 ---
    rk = page.evaluate("window.__fpsTest.gunStatsTest()")
    check("sniper fireRate 3/s reload 1s + rocket 210/255", rk["ok"], rk)

    # --- v8.4 需求1：喷气飞行器 ---
    jp = page.evaluate("window.__fpsTest.jetpackTest()")
    check("jetpack cap 1, pickup/5000pts grant, space fly 15s", jp["ok"], jp)

    # --- v8.4 需求4：霸王龙 ---
    tx = page.evaluate("window.__fpsTest.trexTest()")
    check("trex spawns, health 24000, life 60s", tx["ok"], tx)

    # --- v8.4 需求5：枪模改造（删手/枪托隐藏/枪管tag） ---
    hs = page.evaluate("window.__fpsTest.handsTest()")
    check("stock hidden + barrel present on all guns", hs["ok"], hs)

    # --- 枪模无残缺 ---
    gc = page.evaluate("window.__fpsTest.gunClipTest()")
    check("6 guns intact at hip FOV75", gc["ok"], gc)

    # --- 回归（pigTrigger 需在会创建猪的测试之前） ---
    pg = page.evaluate("window.__fpsTest.pigTriggerTest()")
    check("pig trigger at 10 kills", pg["ok"], pg)
    h = page.evaluate("window.__fpsTest.enemyHealthTest()")
    check("pig 24000 / boss 22500 / heli 750", h["ok"], h)
    ps = page.evaluate("window.__fpsTest.pigSpeedTest()")
    check("pig defense 2 / speed 18.2 / life 90", ps["ok"], ps)
    ls = page.evaluate("window.__fpsTest.pigLaserPitchSweepTest()")
    check("laser pitch 35~75", ls["ok"], ls)
    s = page.evaluate("window.__fpsTest.shieldKillTest()")
    check("shield 15s base +0.5/kill cap 15", s["ok"], s)
    am = page.evaluate("window.__fpsTest.awardMilestoneTest()")
    check("air-support stacks to 3", am["ok"], am)
    bs = page.evaluate("window.__fpsTest.bossStatsTest()")
    check("boss L3 dmg 36 / speed 1.4", bs["ok"], bs)

    runtime_errs = [e for e in errs if "favicon" not in e.lower() and "net::" not in e.lower() and "403" not in e]
    check("no runtime errors", len(runtime_errs) == 0, runtime_errs[:5])

    browser.close()

fails = [r for r in results if not r[1]]
print("\n==== %d/%d passed ====" % (len(results) - len(fails), len(results)))
if fails:
    print("FAILED:", [f[0] for f in fails])
    sys.exit(1)