#!/usr/bin/env python3
# v8.0 headless E2E test — 枪模残缺彻底修复(常规+瞄准) · 蘑菇装饰模型 · 回归
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
    check("versionTag == v8.0", vtag.strip() == "v8.0", vtag)

    page.click("#modeStoryBtn")
    page.wait_for_timeout(1200)

    # --- v8.0 核心：枪模常规+瞄准双状态无残缺（挂相机下测） ---
    gc = page.evaluate("window.__fpsTest.gunClipTest()")
    check("6 guns intact at hip FOV75 AND aim FOV", gc["ok"], gc)

    # --- v8.0 蘑菇装饰 ---
    mu = page.evaluate("window.__fpsTest.mushroomTest()")
    check("mushrooms 6~12 with multi-variant/size", mu["ok"], mu)

    # --- 回归 ---
    pg = page.evaluate("window.__fpsTest.pigTriggerTest()")
    check("pig trigger at 10 kills (no pig yet)", pg["ok"], pg)
    h = page.evaluate("window.__fpsTest.enemyHealthTest()")
    check("helicopter 750 / pig 12000 / boss 22500", h["ok"], h)
    s = page.evaluate("window.__fpsTest.shieldKillTest()")
    check("shield 15s base +0.5/kill cap 15 (v7.9)", s["ok"], s)
    rk = page.evaluate("window.__fpsTest.gunStatsTest()")
    check("rocket dmg 210 / aoe 255 (v7.9)", rk["ok"], rk)
    am = page.evaluate("window.__fpsTest.awardMilestoneTest()")
    check("5k milestone bonus cap 1 (v7.8)", am["ok"], am)
    ic = page.evaluate("window.__fpsTest.itemCapTest()")
    check("nuke/air cap 1 (v7.8)", ic["ok"], ic)
    bs = page.evaluate("window.__fpsTest.bossStatsTest()")
    check("boss L3 dmg 36 / speed 1.4 (v7.7)", bs["ok"], bs)
    cb = page.evaluate("window.__fpsTest.collideBigTest()")
    check("big-enemy no-clip (v7.7)", cb["ok"], cb)

    runtime_errs = [e for e in errs if "favicon" not in e.lower() and "net::" not in e.lower() and "403" not in e]
    check("no runtime errors", len(runtime_errs) == 0, runtime_errs[:5])

    browser.close()

fails = [r for r in results if not r[1]]
print("\n==== %d/%d passed ====" % (len(results) - len(fails), len(results)))
if fails:
    print("FAILED:", [f[0] for f in fails])
    sys.exit(1)