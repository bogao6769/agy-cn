#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
反重力（Antigravity）中文增强补丁 —— 安装 / 卸载

用法（Windows）：
    python install.py            安装或更新补丁
    python install.py --restore  还原官方 preload（卸载补丁）
    python install.py --check    只检查当前状态

做的事：
1. 把 inject.js / inject.css 复制到 %APPDATA%\\Antigravity\\agy-cn\\
2. 备份 resources\\app.asar -> app.asar.agyq-backup（只备份一次）
3. 在 asar 内的 dist/preload.js 末尾追加一段引导代码，启动时把补丁注入页面
"""
import argparse
import hashlib
import json
import os
import shutil
import struct
import sys

APP_DIRS = [
    os.path.expandvars(r"%LOCALAPPDATA%\Programs\antigravity"),
    os.path.expandvars(r"%LOCALAPPDATA%\Programs\Antigravity"),
    r"C:\Program Files\Antigravity",
]
MARK_BEGIN = "/* ==== agyq-cn inject BEGIN ==== */"
MARK_END = "/* ==== agyq-cn inject END ==== */"


# --------------------------------------------------------------------------
# asar 读写
# --------------------------------------------------------------------------
def read_asar(path):
    with open(path, "rb") as f:
        blob = f.read()
    if blob[:4] != struct.pack("<I", 4):
        raise ValueError("不是合法的 asar 文件")
    json_len = struct.unpack("<I", blob[12:16])[0]
    header = json.loads(blob[16:16 + json_len].decode("utf-8"))
    base = 12 + ((4 + json_len + 3) // 4) * 4
    return blob, header, base


def iter_entries(node, prefix=""):
    for name, info in node.items():
        p = prefix + "/" + name
        if "files" in info:
            yield from iter_entries(info["files"], p)
        else:
            yield p, info


def rebuild_asar(blob, header, base, replacements, out_path):
    """replacements: {path: bytes}（path 形如 /dist/preload.js）"""
    payloads = []
    for path, info in iter_entries(header["files"]):
        if info.get("unpacked"):
            continue
        if path in replacements:
            data = replacements[path]
        else:
            off = base + int(info["offset"])
            data = blob[off:off + info["size"]]
        payloads.append((path, info, data))

    # 先把 offset 清掉，迭代求稳定的头部长度
    for path, info, data in payloads:
        info.update(size=len(data), offset="0")
        if path in replacements:
            info["integrity"] = make_integrity(data)

    for _ in range(5):
        raw = json.dumps(header, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
        new_base = 12 + ((4 + len(raw) + 3) // 4) * 4
        offset = 0
        changed = False
        for path, info, data in payloads:
            if info["offset"] != str(offset):
                info["offset"] = str(offset)
                changed = True
            offset += len(data)
        if not changed:
            break

    raw = json.dumps(header, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    payload_len = ((4 + len(raw) + 3) // 4) * 4
    head = struct.pack("<III", 4, payload_len + 4, payload_len)
    head += struct.pack("<I", len(raw)) + raw
    head += b"\x00" * (payload_len - 4 - len(raw))
    assert len(head) == new_base, (len(head), new_base)

    with open(out_path, "wb") as f:
        f.write(head)
        for _p, _i, data in payloads:
            f.write(data)
    return new_base


def make_integrity(data, block_size=4 * 1024 * 1024):
    """与 electron-builder / @electron/asar 保持一致：
    单块文件 hash 即整文件 SHA256；多块时按块摘要拼接再哈希。"""
    blocks = [hashlib.sha256(data[i:i + block_size]).digest() for i in range(0, len(data), block_size)]
    if len(blocks) == 1:
        final = blocks[0]
    else:
        final = hashlib.sha256(b"".join(blocks)).digest()
    return {
        "algorithm": "SHA256",
        "hash": final.hex(),
        "blockSize": block_size,
        "blocks": [b.hex() for b in blocks],
    }


# --------------------------------------------------------------------------
# 补丁内容
# --------------------------------------------------------------------------

def build_bootstrap(src_dir):
    """preload 运行在沙箱里（Electron 20+ 默认 sandbox:true），require('fs') 不可用，
    所以把 inject.js / inject.css 直接内联进 preload。"""
    with open(os.path.join(src_dir, "inject.js"), encoding="utf-8") as f:
        js = f.read()
    with open(os.path.join(src_dir, "inject.css"), encoding="utf-8") as f:
        css = f.read()
    return f"""
{MARK_BEGIN}
(function agyqcn() {{
  try {{
    var wf = require('electron').webFrame;
    var css = {json.dumps(css, ensure_ascii=False)};
    var code = {json.dumps(js, ensure_ascii=False)};
    try {{ if (css) wf.insertCSS(css); }} catch (e) {{}}
    console.log('[agy-cn] preload bootstrap ok, inline ' + code.length + ' bytes');
    var p = wf.executeJavaScript('window.__AGYQ_CSS__ = ' + JSON.stringify(css) + ';\\n' + code);
    if (p && p.catch) {{
      p.catch(function (e) {{ console.warn('[agy-cn] 执行注入脚本失败：', e && e.message); }});
    }}
  }} catch (err) {{
    console.warn('[agy-cn] 注入失败：', err && err.message);
  }}
}})();
{MARK_END}
"""


def find_app_dir(explicit=None):
    if explicit:
        return explicit
    for d in APP_DIRS:
        if os.path.isfile(os.path.join(d, "resources", "app.asar")):
            return d
    return None


def read_preload(path):
    blob, header, base = read_asar(path)
    entry = header["files"]["dist"]["files"]["preload.js"]
    off = base + int(entry["offset"])
    return blob, header, base, entry, blob[off:off + entry["size"]].decode("utf-8", "replace")


def app_version(path):
    try:
        blob, header, base = read_asar(path)
        e = header["files"].get("package.json")
        if not e:
            return "?"
        data = blob[base + int(e["offset"]):base + int(e["offset"]) + e["size"]].decode("utf-8")
        return json.loads(data[data.index("{"):]).get("version", "?")
    except Exception:
        return "?"


UPSTREAM_START = """function startAutoUpdateChecks() {
    if (periodicCheckInterval) {
        return;
    }
    console.log('[AutoUpdater] Starting auto update checks');
    checkForUpdates();
    periodicCheckInterval = setInterval(checkForUpdates, CHECK_INTERVAL_MS);
}"""

PATCHED_START = """function startAutoUpdateChecks() {
    // [agy-cn] 自动更新检查已禁用：避免新版本覆盖中文增强补丁
    console.log('[agy-cn] 自动更新检查已禁用');
}"""


def patch_updater(js):
    """把后台自动检查更新关掉（手动菜单里的“检查更新”仍可用）。"""
    if "[agy-cn] 自动更新检查已禁用" in js:
        return js, "already"
    if UPSTREAM_START not in js:
        return js, "anchor-missing"
    return js.replace(UPSTREAM_START, PATCHED_START, 1), "patched"


def install(app_dir, src_dir):
    res = os.path.join(app_dir, "resources")
    asar = os.path.join(res, "app.asar")
    backup = asar + ".agyq-backup"

    # 关键：应用自动更新会换掉 app.asar（并清掉备份）。若当前 asar 是官方未打补丁的文件，
    # 说明版本变了，必须用**当前文件**重建备份，绝不能拿旧版本的备份去覆盖新版本。
    _, _, _, _, current = read_preload(asar)
    patched = MARK_BEGIN in current
    if patched and os.path.isfile(backup):
        source = backup
        print("[1/4] 已安装补丁，基于既有备份重建")
    else:
        shutil.copy2(asar, backup)
        source = backup
        ver = app_version(asar)
        print(f"[1/4] 备份当前官方 app.asar（v{ver}）-> {os.path.basename(backup)}")

    blob, header, base = read_asar(source)
    entry = header["files"]["dist"]["files"]["preload.js"]
    off = base + int(entry["offset"])
    preload = blob[off:off + entry["size"]].decode("utf-8")

    if MARK_BEGIN in preload:
        preload = preload[:preload.index(MARK_BEGIN)].rstrip() + "\n"
    preload = preload + build_bootstrap(src_dir)
    print(f"[2/4] 注入脚本已内联（preload {len(preload.encode('utf-8')):,} 字节）")

    replacements = {"/dist/preload.js": preload.encode("utf-8")}

    up_entry = header["files"]["dist"]["files"]["updater.js"]
    up_off = base + int(up_entry["offset"])
    updater = blob[up_off:up_off + up_entry["size"]].decode("utf-8")
    updater, state = patch_updater(updater)
    if state == "patched":
        replacements["/dist/updater.js"] = updater.encode("utf-8")
        print("[3/4] 已关闭后台自动更新检查")
    elif state == "already":
        replacements["/dist/updater.js"] = updater.encode("utf-8")
        print("[3/4] 自动更新检查此前已关闭")
    else:
        print("[3/4] 警告：没找到 updater 里的自动检查代码，自动更新未关闭")

    tmp = asar + ".agyq-tmp"
    rebuild_asar(blob, header, base, replacements, tmp)
    shutil.move(tmp, asar)
    print(f"[4/4] 已写入 app.asar（v{app_version(asar)}，{os.path.getsize(asar):,} 字节）。请重启 Antigravity 生效。")


def restore(app_dir):
    asar = os.path.join(app_dir, "resources", "app.asar")
    backup = asar + ".agyq-backup"
    if not os.path.isfile(backup):
        print("没有找到备份，无法还原。")
        return
    shutil.copy2(backup, asar)
    print("已还原官方 app.asar，重启 Antigravity 后补丁消失。")


def check(app_dir):
    asar = os.path.join(app_dir, "resources", "app.asar")
    backup = asar + ".agyq-backup"
    blob, header, base, _, preload = read_preload(asar)
    up = header["files"]["dist"]["files"]["updater.js"]
    updater = blob[base + int(up["offset"]):base + int(up["offset"]) + up["size"]].decode("utf-8", "replace")
    print("安装目录：", app_dir)
    print("应用版本：", "v" + app_version(asar))
    print("补丁状态：", "已安装" if MARK_BEGIN in preload else "未安装")
    print("自动更新：", "已关闭" if "[agy-cn] 自动更新检查已禁用" in updater else "仍开启")
    if os.path.isfile(backup):
        print("备份文件：", f"有（v{app_version(backup)}）")
    else:
        print("备份文件：", "无")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--restore", action="store_true")
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--app-dir")
    args = ap.parse_args()

    app_dir = find_app_dir(args.app_dir)
    if not app_dir:
        print("没找到 Antigravity 安装目录，请用 --app-dir 指定。")
        sys.exit(1)

    if args.check:
        check(app_dir)
    elif args.restore:
        restore(app_dir)
    else:
        install(app_dir, os.path.dirname(os.path.abspath(__file__)))


if __name__ == "__main__":
    main()
