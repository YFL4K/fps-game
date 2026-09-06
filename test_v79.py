#!/usr/bin/env python3
# v7.9 headless E2E test — 枪模重做(残缺修复) · 火箭筒+50% · 猪自爆90s · 护盾15s/上限15 · 性能优化 + 回归
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
    check("versionTag == v7.9", vtag.strip() == "v7.9", vtag)

    page.click("#modeStoryBtn")
    page.wait_for_timeout(1200)

    # --- v7.9 需求1+2：6 把枪模全部在视锥内（无残缺） ---
    gc = page.evaluate("window.__fpsTest.gunClipTest()")
    check("all 6 guns fully inside frustum (no clipping)", gc["ok"], gc)

    # --- v7.9 需求3：火箭筒伤害 +50% ---
    rk = page.evaluate("window.__fpsTest.gunStatsTest()")
    check("rocket dmg 140->210 / aoe 170->255 (+50%)", rk["ok"], rk)

    # --- v7.9 需求4：猪头佳自爆 90 秒 ---
    pf = page.evaluate("window.__fpsTest.pigSpeedTest()")
    check("pig speed 18.2 & self-destruct 30s -> 90s", pf["ok"], pf)

    # --- v7.9 需求5：护盾 15 秒 / 击杀 +0.5 上限 15 ---
    sh = page.evaluate("window.__fpsTest.shieldKillTest()")
    check("shield 15s base, +0.5s/kill, cap 15s", sh["ok"], sh)

    # --- v7.9 需求6：性能优化（pixelRatio cap / fx cap / debris no shadow / shared geo） ---
    per = page.evaluate("window.__fpsTest.perfTest()")
    check("pixelRatio cap 1.5 & FX_MAX 450", per["ok"], per)

    # --- 回归（pigTrigger 需在会创建猪的测试之前；pigSpeedTest 已创建猪） ---
    am = page.evaluate("window.__fpsTest.awardMilestoneTest()")
    check("5k milestone: bonus cap 1 (v7.8)", am["ok"], am)
    ic = page.evaluate("window.__fpsTest.itemCapTest()")
    check("nuke/air cap 1 (v7.8)", ic["ok"], ic)
    h = page.evaluate("window.__fpsTest.enemyHealthTest()")
    check("helicopter 750 / pig 12000 / boss 22500", h["ok"], h)
    b = page.evaluate("window.__fpsTest.bgmVolumeTest()")
    check("bgm master 0.24 (+50%)", b["ok"], b)
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