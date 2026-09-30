#!/usr/bin/env python3
"""Crop a restored record's historical tile out of upstream Angband's own tile sheets.

    python tools/extract-art.py                 write assets/ and tools/art-report.json
    python tools/extract-art.py --sheet out.png  also draw a contact sheet to look at

Reads tools/art.json, a list of records:

    {"kind": "object" | "monster", "name": "<name as upstream spelled it>",
     "last_tag": "<release tag>", "slug": "<file name stem>"}

For each record and each of the five bundled packs it:

1. walks back from `last_tag` to the newest tag whose pref file still maps the
   record (a record can outlive its pref line: Iron Spike's 3.5.1 prefs had
   already dropped it);
2. decodes the cell (row = attr & 0x7F, col = char & 0x7F) from whichever pref
   format that tag used: 3.0's index lines (`K:<index>:A/C`, `R:<index>:A/C`),
   3.3's `K:<tval name>:<name>:A:C`, 3.4 Shockbolt's `K:<tval>:<sval>:A:C`, or
   4.x `object:` and `monster:` lines;
3. crops that cell from the sheet at the same tag and writes
   assets/<slug>-<pack>-native-WxH.png;
4. records whether the 4.2.6 sheet still has identical pixels there and which
   4.2.6 record now claims the cell.

Identical pixels prove a cell survived, not that it ever showed the record, so the
contact sheet is for a person to look at before anything is declared.

Needs Pillow, a clone of angband/angband ($ANGBAND_UPSTREAM, default
../_angband/angband-upstream) and the game's reference tree ($NEO_ANGBAND_REPO,
default ../neo-angband). Only this tool needs them.
"""
import io
import json
import os
import re
import subprocess
import sys
import unicodedata

from PIL import Image, ImageChops, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UP = os.environ.get("ANGBAND_UPSTREAM", os.path.join(ROOT, "..", "_angband", "angband-upstream"))
GAME = os.environ.get("NEO_ANGBAND_REPO", os.path.join(ROOT, "..", "neo-angband"))
REF_TILES = os.path.join(GAME, "reference", "lib", "tiles")

# pack: (3.x prf stem, sheet name, width, height, 4.2.6 prf file, asset label)
PACKS = {
    "old": ("xxx", "8x8", 8, 8, "old/graf-xxx.prf", "old"),
    "nomad": ("nmd", "8x16", 8, 16, "nomad/graf-nmd.prf", "nomad"),
    "adam-bolt": ("new", "16x16", 16, 16, "adam-bolt/graf-new.prf", "adambolt"),
    "gervais": ("dvg", "32x32", 32, 32, "gervais/graf-dvg.prf", "gervais"),
    "shockbolt": ("shb", "64x64", 64, 64, "shockbolt/graf-shb-dark.prf", "shockbolt"),
}
# Smallest to largest: a substitute may come from a pack at or below the active one.
BY_RESOLUTION = ["old", "nomad", "adam-bolt", "gervais", "shockbolt"]
TAGS = ["v3.0.6", "v3.0.9", "v3.1.0", "v3.1.2", "v3.2.0", "v3.3.2", "v3.4.1", "3.5.1", "4.0.5", "4.1.3", "4.2.0"]
NUM = r"(0x[0-9A-Fa-f]+|\d+)"

_shown = {}


def show(tag, path, binary=False):
    key = (tag, path, binary)
    if key not in _shown:
        r = subprocess.run(["git", "-C", UP, "show", f"{tag}:{path}"], capture_output=True)
        _shown[key] = None if r.returncode else (r.stdout if binary else r.stdout.decode("utf-8", errors="replace"))
    return _shown[key]


def v3(tag):
    return tag.startswith("v3") or tag.startswith("3.")


def num(s):
    return int(s, 16) if s.lower().startswith("0x") else int(s)


def norm(name):
    name = re.sub(r"\[['\"^`]([a-zA-Z])\]", lambda m: m.group(1), name)
    n = "".join(c for c in unicodedata.normalize("NFKD", name) if not unicodedata.combining(c))
    n = re.sub(r"\|[^|]*\|[^|]*\|", "", n).replace("&", "").replace("~", "").strip().lower()
    return re.sub(r"\s+", " ", n)


def records(text):
    out, name, cur = [], None, []
    for line in text.splitlines():
        m = re.match(r"^(?:N:\d+:|name:(?:\d+:)?)(.*)$", line)
        if m:
            if name is not None:
                out.append((name, "\n".join(cur)))
            name, cur = m.group(1).strip(), [line]
        elif name is not None and line and not line.startswith("#"):
            cur.append(line)
    if name is not None:
        out.append((name, "\n".join(cur)))
    return out


def index_maps(tag, kind):
    """3.x record index -> name and (tval, sval) -> name, at that tag."""
    idx, tvs = {}, {}
    for n, rec in records(show(tag, f"lib/edit/{kind}.txt") or ""):
        m = re.match(r"N:(\d+):", rec)
        if m:
            idx[int(m.group(1))] = norm(n)
        i = re.findall(r"^I:(\d+):(\d+)", rec, re.M)
        if i:
            tvs[(int(i[0][0]), int(i[0][1]))] = norm(n)
    return idx, tvs


def prf_path(tag, pack):
    return f"lib/pref/graf-{PACKS[pack][0]}.prf" if v3(tag) else f"lib/tiles/{pack}/graf-{PACKS[pack][0]}.prf"


def sheet_path(tag, pack):
    return f"lib/xtra/graf/{PACKS[pack][1]}.png" if v3(tag) else f"lib/tiles/{pack}/{PACKS[pack][1]}.png"


_cells = {}


def cells(tag, pack, kind):
    """norm(name) -> (attr, char) from that tag's pref file for the pack."""
    key = (tag, pack, kind)
    if key in _cells:
        return _cells[key]
    text = show(tag, prf_path(tag, pack))
    out = None
    if text is not None:
        out = {}
        idx, tvs = index_maps(tag, kind) if v3(tag) else ({}, {})
        for line in (l.strip() for l in text.splitlines()):
            if kind == "monster":
                m = re.match(rf"^monster:(.+):{NUM}:{NUM}$", line)
                if m:
                    out[norm(m.group(1))] = (num(m.group(2)), num(m.group(3)))
                    continue
                m = re.match(rf"^R:(\d+):{NUM}[:/]{NUM}$", line)
                if m and int(m.group(1)) in idx:
                    out[idx[int(m.group(1))]] = (num(m.group(2)), num(m.group(3)))
            else:
                m = re.match(rf"^object:[^:]+:(.+):{NUM}:{NUM}$", line)
                if m:
                    out[norm(m.group(1))] = (num(m.group(2)), num(m.group(3)))
                    continue
                m = re.match(rf"^K:(\d+):(\d+):{NUM}:{NUM}$", line)
                if m and (int(m.group(1)), int(m.group(2))) in tvs:
                    out[tvs[(int(m.group(1)), int(m.group(2)))]] = (num(m.group(3)), num(m.group(4)))
                    continue
                m = re.match(rf"^K:([a-z ]+):(.+):{NUM}:{NUM}$", line)
                if m:
                    out[norm(m.group(2))] = (num(m.group(3)), num(m.group(4)))
                    continue
                m = re.match(rf"^K:(\d+):{NUM}[:/]{NUM}$", line)
                if m and int(m.group(1)) in idx:
                    out[idx[int(m.group(1))]] = (num(m.group(2)), num(m.group(3)))
    _cells[key] = out
    return out


_sheets = {}


def sheet(tag, pack):
    key = (tag, pack)
    if key not in _sheets:
        if tag == "now":
            _sheets[key] = Image.open(os.path.join(REF_TILES, pack, PACKS[pack][1] + ".png")).convert("RGBA")
        else:
            b = show(tag, sheet_path(tag, pack), binary=True)
            _sheets[key] = Image.open(io.BytesIO(b)).convert("RGBA") if b else None
    return _sheets[key]


def crop(img, cell, pack):
    w, h = PACKS[pack][2], PACKS[pack][3]
    r, c = cell
    box = (c * w, r * h, c * w + w, r * h + h)
    return None if box[2] > img.width or box[3] > img.height else img.crop(box)


_claims = {}


def claimed_by(pack, kind, cell):
    key = (pack, kind)
    if key not in _claims:
        text = open(os.path.join(REF_TILES, PACKS[pack][4]), encoding="utf-8").read()
        pat = rf"^monster:(.+):{NUM}:{NUM}" if kind == "monster" else rf"^object:[^:]+:(.+):{NUM}:{NUM}"
        _claims[key] = {(num(m.group(2)) & 0x7F, num(m.group(3)) & 0x7F): m.group(1) for m in re.finditer(pat, text, re.M)}
    return _claims[key].get(cell)


def extract(rec):
    found = {}
    order = TAGS[: TAGS.index(rec["last_tag"]) + 1][::-1]
    for pack in PACKS:
        for tag in order:
            cmap = cells(tag, pack, rec["kind"])
            if cmap and norm(rec["name"]) in cmap:
                a, c = cmap[norm(rec["name"])]
                cell = (a & 0x7F, c & 0x7F)
                img = sheet(tag, pack)
                tile = crop(img, cell, pack) if img else None
                # A fully transparent cell is not art, however it was mapped.
                if tile is None or tile.getbbox() is None:
                    break
                now = crop(sheet("now", pack), cell, pack)
                status = "oob" if now is None else ("same" if ImageChops.difference(tile, now).getbbox() is None else "changed")
                found[pack] = {"tag": tag, "cell": list(cell), "status": status,
                               "claimed_by": claimed_by(pack, rec["kind"], cell), "tile": tile}
                break
    return found


def art_entry(slug, found):
    """Per pack: its own tile, else the best one at or below its resolution."""
    packs = {}
    for pack in PACKS:
        w, h = PACKS[pack][2], PACKS[pack][3]
        src = pack if pack in found else None
        if src is None:
            for lower in reversed(BY_RESOLUTION[: BY_RESOLUTION.index(pack)]):
                lw, lh = PACKS[lower][2], PACKS[lower][3]
                if lower in found and lw <= w and lh <= h:
                    src = lower
                    break
        if src is not None:
            sw, sh = PACKS[src][2], PACKS[src][3]
            packs[pack] = {"asset": f"assets/{slug}-{PACKS[src][5]}-native-{sw}x{sh}.png"}
    return packs


def main():
    items = json.load(open(os.path.join(ROOT, "tools", "art.json"), encoding="utf-8"))
    report, rows = {}, []
    for rec in items:
        found = extract(rec)
        for pack, f in found.items():
            w, h = PACKS[pack][2], PACKS[pack][3]
            path = os.path.join(ROOT, "assets", f"{rec['slug']}-{PACKS[pack][5]}-native-{w}x{h}.png")
            tile = f.pop("tile")
            # Leave an existing file alone when its pixels already match, so a rerun
            # does not rewrite committed assets with a different PNG encoding.
            if os.path.exists(path) and ImageChops.difference(Image.open(path).convert("RGBA"), tile).getbbox() is None:
                continue
            tile.save(path)
        report[rec["slug"]] = {"name": rec["name"], "kind": rec["kind"], "found": found, "packs": art_entry(rec["slug"], found)}
        rows.append((rec, found))
        print(rec["slug"], " | ".join(f"{p}:{found[p]['status']}@{found[p]['tag']}" if p in found else f"{p}:-" for p in PACKS))
    with open(os.path.join(ROOT, "tools", "art-report.json"), "w", encoding="utf-8", newline="\n") as out:
        json.dump(report, out, indent=1, ensure_ascii=False)

    if "--sheet" in sys.argv:
        out = sys.argv[sys.argv.index("--sheet") + 1]
        scale, cw = 2, 64 * 2 + 8
        img = Image.new("RGBA", (220 + cw * len(PACKS), 28 + len(rows) * (64 * scale + 8)), (40, 40, 40, 255))
        d = ImageDraw.Draw(img)
        for i, p in enumerate(PACKS):
            d.text((220 + i * cw, 6), p, fill="white")
        for r, (rec, found) in enumerate(rows):
            y = 28 + r * (64 * scale + 8)
            d.text((6, y + 4), rec["slug"], fill="white")
            for i, p in enumerate(PACKS):
                path = os.path.join(ROOT, "assets", f"{rec['slug']}-{PACKS[p][5]}-native-{PACKS[p][2]}x{PACKS[p][3]}.png")
                if p in found and os.path.exists(path):
                    t = Image.open(path).convert("RGBA")
                    k = min(64 * scale // t.width, 64 * scale // t.height)
                    img.alpha_composite(t.resize((t.width * k, t.height * k), Image.NEAREST), (220 + i * cw, y))
        img.save(out)


if __name__ == "__main__":
    main()
