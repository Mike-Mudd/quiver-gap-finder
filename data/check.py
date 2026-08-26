#!/usr/bin/env python3
"""Data-quality checks for skis.json. Run from the repo root:  python data/check.py

Three checks, cheapest first. Each catches a class of error that is
invisible by eye and expensive to find later.
"""
import json, sys

METAL = {"none": 0.0, "partial": 0.5, "full": 1.0}
ROCKER_DEFAULT = {
    "full_camber": 5, "camber_tip_rocker": 20, "camber_tip_tail_rocker": 40,
    "flat_tip_tail_rocker": 65, "full_rocker": 90,
}

def rocker(s):
    v = s.get("rocker_percent")
    return v if isinstance(v, (int, float)) else ROCKER_DEFAULT.get(s.get("rocker_profile"), 40)

def feel(s):
    w = min(max((s["weight_g"] - 1500) / 860, 0), 1)
    return min(max(w * 65 + METAL.get(s["metal_content"], 0) * 35 - rocker(s) / 100 * 25, 0), 100)

def main():
    skis = json.load(open("data/skis.json"))["skis"]
    problems = 0

    # 1. Two skis identical on every field the scoring reads render as one
    #    mark on the coverage map, which looks like a bug to a user.
    seen = {}
    for s in skis:
        key = (s["waist_width_mm"], s["weight_g"], s["metal_content"], rocker(s))
        seen.setdefault(key, []).append(s["name"])
    for key, names in seen.items():
        if len(names) > 1:
            print(f"DUPLICATE  identical scoring inputs: {', '.join(names)}")
            problems += 1

    # 2. Within one ski, weight and turn radius must rise with length. A
    #    break is a transcription error, not a property of the ski.
    for s in skis:
        opts = sorted(s.get("length_options") or [], key=lambda o: o["length_cm"])
        for a, b in zip(opts, opts[1:]):
            if b["weight_g"] <= a["weight_g"]:
                print(f"MONOTONIC  {s['name']}: weight not rising {a['length_cm']}->{b['length_cm']}cm")
                problems += 1
            if b["turn_radius_m"] < a["turn_radius_m"]:
                print(f"MONOTONIC  {s['name']}: turn radius falling {a['length_cm']}->{b['length_cm']}cm")
                problems += 1

    # 3. Near a band boundary, small input errors flip what the user sees.
    #    These are the only skis where extra sourcing care pays for itself.
    near = []
    for s in skis:
        v = feel(s)
        margin = min(abs(v - 33.33), abs(v - 66.67))
        if margin < 5:
            near.append((margin, s["name"], v, s["metal_content"]))
    if near:
        print(f"\nNEAR-BOUNDARY ({len(near)} skis) — verify metal_content especially:")
        for margin, name, v, metal in sorted(near):
            print(f"  {margin:4.1f} pts   {name:<30} score {v:5.1f}   metal={metal}")

    print(f"\n{len(skis)} skis checked, {problems} problem(s).")
    return 1 if problems else 0

if __name__ == "__main__":
    sys.exit(main())
