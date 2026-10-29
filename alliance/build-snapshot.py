# 把 screenshots/<DATE>/transfer_score.txt 轉成 transfer-scores/<DATE>-<HHMM>.json
# 並重建 data.js（snapshots + uid-map）
# 用法：python alliance/build-snapshot.py 2026-10-29 1530 "快照 35m 前"

import difflib
import json
import re
import sys
import unicodedata
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).resolve().parent

GREEK_MAP = {
    'ALPHA':'a','BETA':'b','GAMMA':'g','DELTA':'d','EPSILON':'e','ZETA':'z',
    'ETA':'h','THETA':'th','IOTA':'i','KAPPA':'k','LAMDA':'l','LAMBDA':'l',
    'MU':'m','NU':'n','XI':'x','OMICRON':'o','PI':'p','RHO':'r','SIGMA':'s',
    'TAU':'t','UPSILON':'u','PHI':'ph','CHI':'ch','PSI':'ps','OMEGA':'o',
}
# 其他 Unicode block 容易被玩家拿來裝飾的 Latin lookalikes
EXTRA_LOOKALIKE = {
    'օ':'o',  # U+0585 Armenian small letter oh
    'օ':'o',
    '×':'x',  # U+00D7 multiplication sign 常被當 x
    'ϻ':'m','ϼ':'r','ɸ':'ph',
}

def char_to_ascii(c: str) -> str:
    o = ord(c)
    # CJK 系（中/日假名/韓）保留原字
    if (0x4e00 <= o <= 0x9fff) or (0x3040 <= o <= 0x30ff) or (0xac00 <= o <= 0xd7af):
        return c
    if c in EXTRA_LOOKALIKE:
        return EXTRA_LOOKALIKE[c]
    # Combining Diacritical Marks (0300-036F) 整段丟 — 都是純裝飾
    if 0x0300 <= o <= 0x036F:
        return ''
    try:
        n = unicodedata.name(c, '')
    except Exception:
        return ''
    # 嚴格：LATIN ... LETTER X（最後一個 token 是單一大寫字母，前面可以有 WITH ... 修飾）
    m = re.fullmatch(r'LATIN (?:SMALL |CAPITAL )?LETTER (?:(?:SMALL CAPITAL|SMALL|CAPITAL|TURNED|REVERSED|SIDEWAYS|INVERTED) )*([A-Z])(?: WITH [A-Z ]+)?', n)
    if m:
        return m.group(1).lower()
    # Latin SUPERSCRIPT/SUBSCRIPT single letter
    m = re.fullmatch(r'(?:LATIN )?(?:SUPERSCRIPT|SUBSCRIPT) (?:SMALL |CAPITAL )?LATIN LETTER ([A-Z])', n)
    if m:
        return m.group(1).lower()
    # MODIFIER LETTER （上標字母常用來做裝飾／縮寫）
    m = re.fullmatch(r'MODIFIER LETTER (?:CAPITAL |SMALL )?([A-Z])', n)
    if m:
        return m.group(1).lower()
    # Greek
    m = re.fullmatch(r'GREEK (?:SMALL|CAPITAL) LETTER ([A-Z]+)', n)
    if m and m.group(1) in GREEK_MAP:
        return GREEK_MAP[m.group(1)]
    if c.isascii() and c.isalnum():
        return c.lower()
    if c.isdigit():
        return c
    return ''

def normalize_for_match(name: str) -> str:
    """主 key：Latin/希臘/亞美尼亞 lookalike → ASCII；CJK 保留；其餘丟掉"""
    s = unicodedata.normalize("NFKC", name)
    return ''.join(char_to_ascii(c) for c in s)

def normalize_strict(name: str) -> str:
    """備用 key：丟掉所有非 ASCII-alnum 與非 CJK（含 IPA、顏文字部件）
    用於玩家名的「真正字母骨幹」比對（避免 IPA letter 如 ʕ 被誤映射成 c）"""
    s = unicodedata.normalize("NFKC", name)
    out = []
    for c in s:
        o = ord(c)
        if (0x4e00 <= o <= 0x9fff) or (0x3040 <= o <= 0x30ff) or (0xac00 <= o <= 0xd7af):
            out.append(c)
        elif c.isascii() and c.isalnum():
            out.append(c.lower())
    return ''.join(out)

def parse_txt(txt_path: Path):
    """解析 transfer_score.txt → list of (name, alliance, score)
    txt 格式：前三名無 #N 標記，之後每筆以 '#N' 開頭標記下一筆。
    每筆是 3 行：name / alliance / score。
    """
    lines = [ln.rstrip() for ln in txt_path.read_text(encoding="utf-8").splitlines()]
    # 擷取非空行、非 #N 行
    body = []
    for ln in lines:
        s = ln.strip()
        if not s:
            continue
        if re.fullmatch(r"#\d+", s):
            continue
        body.append(s)
    # 每 3 行一筆
    if len(body) % 3 != 0:
        raise ValueError(f"txt 行數 {len(body)} 不是 3 的倍數，格式可能有缺")
    entries = []
    for i in range(0, len(body), 3):
        name = body[i]
        alliance = body[i+1]
        score_raw = body[i+2].replace(",", "").replace(" ", "")
        score = int(score_raw)
        entries.append({"name": name, "alliance": alliance, "score": score})
    return entries

def main():
    if len(sys.argv) < 3:
        print("用法: python build-snapshot.py <DATE> <HHMM> [snapshot_label]")
        print("範例: python build-snapshot.py 2026-10-29 1530 '快照 35m 前'")
        sys.exit(1)
    date_str = sys.argv[1]       # 2026-10-29
    hhmm = sys.argv[2]           # 1530
    label = sys.argv[3] if len(sys.argv) > 3 else f"快照 {hhmm}"

    txt_path = ROOT / "screenshots" / date_str / "transfer_score.txt"
    out_json = ROOT / "transfer-scores" / f"{date_str}-{hhmm}.json"

    umap = json.load(open(ROOT / "uid-map.json", encoding="utf-8"))
    uid_players = umap["players"]

    # 建立 normalized name → canonical name 索引（兩套策略並用）
    norm2canon = {}
    strict2canon = {}
    for k in uid_players.keys():
        norm2canon.setdefault(normalize_for_match(k), k)
        strict2canon.setdefault(normalize_strict(k), k)

    raw_entries = parse_txt(txt_path)
    if len(raw_entries) != 100:
        print(f"⚠️  讀到 {len(raw_entries)} 筆，不是 100 筆")

    captured = datetime.now().strftime("%Y-%m-%dT%H:%M+08:00")
    snapshot_at = f"{date_str}T{hhmm[:2]}:{hhmm[2:]}+08:00"

    # 讀前一天快照（如果有）供改名候選偵測
    snap_files_sorted = sorted((ROOT / "transfer-scores").glob("*.json"))
    prev_snapshot = None
    for f in reversed(snap_files_sorted):
        snap = json.load(open(f, encoding="utf-8"))
        if snap["snapshot_at"] < snapshot_at:
            prev_snapshot = snap
            break
    prev_entries = prev_snapshot["entries"] if prev_snapshot else []

    entries_out = []
    stats = {"exact": 0, "fuzzy": 0, "unmatched": 0}
    unmatched = []
    matched_canon = set()
    for i, raw in enumerate(raw_entries, start=1):
        name = raw["name"]
        alliance = raw["alliance"]
        score = raw["score"]
        canonical = None
        match_type = None
        if name in uid_players:
            canonical = name
            match_type = "exact"
        else:
            norm = normalize_for_match(name)
            strict = normalize_strict(name)
            if norm and norm in norm2canon:
                canonical = norm2canon[norm]
                match_type = "fuzzy"
            elif strict and strict in strict2canon:
                canonical = strict2canon[strict]
                match_type = "fuzzy"
            else:
                # 寬鬆：對 norm 做 difflib，閾值 0.85
                if norm:
                    close = difflib.get_close_matches(norm, list(norm2canon.keys()), n=1, cutoff=0.85)
                    if close:
                        canonical = norm2canon[close[0]]
                        match_type = "fuzzy"
        if canonical:
            stats[match_type] += 1
            matched_canon.add(canonical)
            uid = uid_players[canonical]["uid"]
            entry = {
                "rank": i,
                "player": canonical,
                "alliance": alliance,
                "score": score,
                "uid": uid,
            }
            if match_type == "fuzzy":
                entry["raw_name_in_game"] = name
                entry["note"] = "名字與 uid-map 標準版不同（含裝飾字元，已自動對上）"
        else:
            stats["unmatched"] += 1
            unmatched.append((i, name, alliance, score))
            entry = {
                "rank": i,
                "player": name,
                "alliance": alliance,
                "score": score,
                "note": "⚠️ uid-map 查無此名，疑似新進或改名；請翻前一天截圖比對頭像",
            }
        entries_out.append(entry)

    # 改名候選偵測：對每個未對上的 today-entry，找「昨天榜上有、今天沒對上 UID」的
    # entry 中分數最接近的（±50k 以內，排名差 ±5 以內）
    if prev_entries:
        today_uids = {e.get("uid") for e in entries_out if e.get("uid")}
        prev_disappeared = []
        for pe in prev_entries:
            pe_uid = pe.get("uid") or (uid_players.get(pe["player"], {}).get("uid"))
            if pe_uid and pe_uid in today_uids:
                continue  # 這個玩家今天還在
            prev_disappeared.append((pe, pe_uid))
        for e in entries_out:
            if "uid" in e:
                continue
            best = None
            best_score_diff = None
            for pe, pe_uid in prev_disappeared:
                score_diff = abs(e["score"] - pe["score"])
                rank_diff = abs(e["rank"] - pe["rank"])
                if score_diff <= 50000 and rank_diff <= 5:
                    if best_score_diff is None or score_diff < best_score_diff:
                        best = (pe, pe_uid)
                        best_score_diff = score_diff
            if best:
                pe, pe_uid = best
                e["note"] = (
                    f"🔄 疑似改名：昨天為「{pe['player']}」"
                    f"（UID {pe_uid}, 昨 #{pe['rank']} / {pe['score']:,}）"
                    f"；請用頭像核對後更新 uid-map"
                )
                e["suspected_rename_from"] = {"player": pe["player"], "uid": pe_uid}

    snapshot = {
        "captured_at": captured,
        "snapshot_at": snapshot_at,
        "snapshot_label": label,
        "server": 3209,
        "server_leader": "Frost Knight",
        "server_grade": "B+ (戰區生命值)",
        "entries": entries_out,
    }
    out_json.parent.mkdir(parents=True, exist_ok=True)
    out_json.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"✅ 寫出 {out_json.relative_to(ROOT)}")
    print(f"   對上 uid-map：exact={stats['exact']}, fuzzy={stats['fuzzy']}, 未對上={stats['unmatched']}")
    if unmatched:
        print("   未對上的名字：")
        for rank, name, alli, sc in unmatched:
            print(f"     #{rank:>3}  {name!r}  [{alli}]  {sc:,}")

    # ---- 重建 data.js ----
    snap_files = sorted((ROOT / "transfer-scores").glob("*.json"))
    all_snaps = []
    for f in snap_files:
        all_snaps.append(json.load(open(f, encoding="utf-8")))
    # 新到舊
    all_snaps.sort(key=lambda s: s["snapshot_at"], reverse=True)

    data_js = []
    data_js.append("// 3209 轉州分數快照 — 內部用，絕不公開")
    data_js.append("// 由 alliance/transfer-scores/*.json + uid-map.json 自動彙整")
    data_js.append(f"// 最後更新：{datetime.now().strftime('%Y-%m-%d %H:%M')}")
    data_js.append("window.SNAPSHOTS = [")
    for i, s in enumerate(all_snaps):
        suffix = "," if i < len(all_snaps) - 1 else ""
        data_js.append(json.dumps(s, ensure_ascii=False, indent=2) + suffix)
    data_js.append("];")
    data_js.append("window.UID_MAP = " + json.dumps(umap, ensure_ascii=False, indent=2) + ";")

    (ROOT / "data.js").write_text("\n".join(data_js) + "\n", encoding="utf-8")
    print(f"✅ 重建 data.js（{len(all_snaps)} 份快照）")

    # ---- 成長幅度 Top 10（跟前一天比）----
    if len(all_snaps) >= 2:
        today, prev = all_snaps[0], all_snaps[1]
        prev_by_uid = {}
        for e in prev["entries"]:
            u = e.get("uid")
            if not u:
                rec = uid_players.get(e["player"])
                if rec:
                    u = rec["uid"]
            if u:
                prev_by_uid[u] = e
        deltas = []
        for e in today["entries"]:
            u = e.get("uid")
            if not u:
                continue
            prev_e = prev_by_uid.get(u)
            if not prev_e:
                continue
            delta = e["score"] - prev_e["score"]
            rank_chg = prev_e["rank"] - e["rank"]  # 正 = 排名上升
            deltas.append((delta, rank_chg, e["player"], e["rank"], prev_e["rank"], e["score"]))
        deltas.sort(reverse=True)
        print()
        print(f"📈 成長幅度 Top 10（{prev['snapshot_at'][:16]} → {today['snapshot_at'][:16]}）")
        for d in deltas[:10]:
            delta, rc, name, r, pr, sc = d
            rc_str = f"↑{rc}" if rc > 0 else (f"↓{-rc}" if rc < 0 else "—")
            print(f"   +{delta:>8,}  (#{pr:>3}→#{r:<3} {rc_str:>4})  {name}  [{sc:,}]")
        print()
        print(f"📉 衰退（分數減少）")
        decays = [d for d in deltas if d[0] < 0]
        if not decays:
            print("   無")
        else:
            for d in sorted(decays)[:5]:
                delta, rc, name, r, pr, sc = d
                rc_str = f"↑{rc}" if rc > 0 else (f"↓{-rc}" if rc < 0 else "—")
                print(f"   {delta:>9,}  (#{pr:>3}→#{r:<3} {rc_str:>4})  {name}  [{sc:,}]")

if __name__ == "__main__":
    main()
