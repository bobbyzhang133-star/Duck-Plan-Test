"""Analyze Playwright PNG captures with the shared macOS bitmap reader."""
import json
import statistics
import subprocess
import sys
from pathlib import Path

root = Path(sys.argv[1])
out = Path(__file__).resolve().parent
reader = out.parent / "native-reference-rebound" / "analyze.swift"

def motion(data):
    samples = data["samples"]
    baseline = samples[0]["paintEdgeY"]
    peak = max(s["paintEdgeY"] for s in samples)
    peaks = [s for s in samples if s["paintEdgeY"] == peak]
    release = peaks[-1]["timeMs"]
    tail = [(s["timeMs"] - release, s["paintEdgeY"] - baseline)
            for s in samples if s["timeMs"] >= release]
    return {"peakPx": peak - baseline,
            "firstMotionMs": next(s["timeMs"] for s in samples if s["paintEdgeY"] > baseline),
            "firstPeakMs": peaks[0]["timeMs"], "returnStartsFromMs": release,
            "peakPlateauMs": release - peaks[0]["timeMs"],
            "returnToBaselineMs": tail[-1][0], "tail": tail,
            "belowRest": any(value < 0 for time, value in tail)}

def interpolate(seq, time):
    for (start, a), (end, b) in zip(seq, seq[1:]):
        if start <= time <= end:
            return a + (b - a) * (time - start) / (end - start)
    return seq[-1][1]

trials = []
for trial in range(1, 4):
    folder = root if trial == 1 else root / f"trial{trial}"
    evidence = out if trial == 1 else out / f"trial{trial}"
    evidence.mkdir(exist_ok=True)
    measurements = {}
    for name in ["googleBefore", "local", "googleAfter"]:
        case = folder / name
        subprocess.run(["swift", "-module-cache-path", "/private/tmp/duckplan-swift-modulecache",
                        str(reader), str(case)], check=True, capture_output=True, text=True)
        data = json.loads((case / "samples.json").read_text())
        (evidence / f"{name}-samples.json").write_text(json.dumps(data, indent=2) + "\n")
        measurements[name] = motion(data)
        if trial == 1:
            for phase in ["before", "peak", "settled"]:
                (evidence / f"{name}-{phase}.png").write_bytes((case / f"{phase}.png").read_bytes())
    comparisons = {}
    for reference in ["googleBefore", "googleAfter"]:
        local, native = measurements["local"], measurements[reference]
        end = min(local["tail"][-1][0], native["tail"][-1][0])
        errors = [abs(interpolate(local["tail"], time) - interpolate(native["tail"], time))
                  for time in range(0, end + 1, 10)]
        comparisons[reference] = {
            "peakDifferencePx": local["peakPx"] - native["peakPx"],
            "firstMotionDifferenceMs": local["firstMotionMs"] - native["firstMotionMs"],
            "releaseAlignedMaxDifferencePx": max(errors),
            "releaseAlignedMeanDifferencePx": statistics.mean(errors),
            "returnDurationDifferenceMs": local["returnToBaselineMs"] - native["returnToBaselineMs"]}
    trials.append({"trial": trial,
                   "metrics": {name: {key: value for key, value in data.items() if key != "tail"}
                               for name, data in measurements.items()}, "comparisons": comparisons})

result = {"tool": "Playwright MCP browser_run_code_unsafe + CDP rendered PNG screencast",
          "runtime": "Chromium157.0.8103.79 on macOS", "websiteCommit": "653941c",
          "view": "Week on both sites", "gesture": {"distancePx": 240, "speedPxPerSecond": 1800,
          "source": "synthesized mouse gesture"}, "order": ["googleBefore", "local", "googleAfter"],
          "trials": trials,
          "scope": "Authorized public Google Calendar reference; not private calendar or physical trackpad equivalence"}
(out / "comparison.json").write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps(result, indent=2))
