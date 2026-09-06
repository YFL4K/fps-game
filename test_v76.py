#!/usr/bin/env python3
# v7.6 headless E2E test — 猪头佳血量+200% / BOSS机甲血量+200% / 护盾击杀+0.5秒 / BGM音量+50% + v7.5 回归
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
    check("versionTag == v7.6", vtag.strip() == "v7.6", vtag)

    page.click("#modeStoryBtn")
    page.wait_for_timeout(1200)

    # --- v7.6 需求1+2：血量再提升 200% ---
    h = page.evaluate("window.__fpsTest.enemyHealthTest()")
    check("helicopter 750 / pig 12000 / boss 22500", h["ok"], h)

    # --- v7.6 需求3：护盾击杀 +0.5 秒 ---
    s = page.evaluate("window.__fpsTest.shieldKillTest()")
    check("shield +0.5s per kill (cap 60)", s["ok"], s)

    # --- v7.6 需求4：BGM 音量 +50% ---
    b = page.evaluate("window.__fpsTest.bgmVolumeTest()")
    check("bgm master 0.16 -> 0.24 (+50%)", b["ok"], b)

    # --- v7.4/v7.5 回归（pigTrigger 需在激光测试前，验证同屏最多一只） ---
    b2 = page.evaluate("window.__fpsTest.berserkTest()")
    check("berserk 30% + instant on hit", b2["ok"])
    gm = page.evaluate("window.__fpsTest.gatlingModelTest()")
    check("gatling new model structure", gm["ok"])
    pg = page.evaluate("window.__fpsTest.pigTriggerTest()")
    check("pig trigger at 10 kills", pg["ok"], pg)

    # --- v7.5 回归：猪头佳激光 ---
    sw = page.evaluate("window.__fpsTest.pigLaserPitchSweepTest()")
    check("laser pitch sweeps 30~50 deg", sw["ok"], {k: v for k, v in sw.items() if k != "ok"})
    pe = page.evaluate("window.__fpsTest.pigLaserEnemyTest()")
    check("laser dmg enemy 50/s at ground low target", pe["ok"], pe)

    runtime_errs = [e for e in errs if "favicon" not in e.lower() and "net::" not in e.lower() and "403" not in e]
    check("no runtime errors", len(runtime_errs) == 0, runtime_errs[:5])

    browser.close()

fails = [r for r in results if not r[1]]
print("\n==== %d/%d passed ====" % (len(results) - len(fails), len(results)))
if fails:
    print("FAILED:", [f[0] for f in fails])
    sys.exit(1)