#!/usr/bin/env python3
# v8.6 headless E2E test — 霸王龙外观重做/数值 + 持枪完整显示 + 回归
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
    check("versionTag == v8.6", vtag.strip() == "v8.6", vtag)

    page.click("#modeStoryBtn")
    page.wait_for_timeout(1200)

    # --- v8.6 需求1：霸王龙（体型1.6/速度8/24000血/60s） ---
    tx = page.evaluate("window.__fpsTest.trexTest()")
    check("trex scale 1.6 / speed 8 / 24000 / 60s", tx["ok"], tx)

    # --- v8.6 需求2：持枪完整显示（枪托可见） ---
    hs = page.evaluate("window.__fpsTest.handsTest()")
    check("stock visible (full gun display) + barrel present", hs["ok"], hs)

    # --- 枪模无残缺 ---
    gc = page.evaluate("window.__fpsTest.gunClipTest()")
    check("6 guns intact at hip FOV75", gc["ok"], gc)

    # --- 回归（pigTrigger 需在最前） ---
    pg = page.evaluate("window.__fpsTest.pigTriggerTest()")
    check("pig trigger at 10 kills", pg["ok"], pg)
    h = page.evaluate("window.__fpsTest.enemyHealthTest()")
    check("pig 24000 / boss 22500 / heli 750", h["ok"], h)
    ls = page.evaluate("window.__fpsTest.pigLaserPitchSweepTest()")
    check("pig laser 20 deg", ls["ok"], ls)
    jp = page.evaluate("window.__fpsTest.jetpackTest()")
    check("jetpack cap 1", jp["ok"], jp)
    co = page.evaluate("window.__fpsTest.coconutTest()")
    check("coconut 4~7 (no boulder)", co["ok"], co)
    gp = page.evaluate("window.__fpsTest.gunPickupTest()")
    check("gun pickup no-switch", gp["ok"], gp)
    rk = page.evaluate("window.__fpsTest.gunStatsTest()")
    check("sniper 3/s reload 1s", rk["ok"], rk)

    runtime_errs = [e for e in errs if "favicon" not in e.lower() and "net::" not in e.lower() and "403" not in e]
    check("no runtime errors", len(runtime_errs) == 0, runtime_errs[:5])

    browser.close()

fails = [r for r in results if not r[1]]
print("\n==== %d/%d passed ====" % (len(results) - len(fails), len(results)))
if fails:
    print("FAILED:", [f[0] for f in fails])
    sys.exit(1)