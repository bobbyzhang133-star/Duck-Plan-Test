"""Score each correction against the criteria committed before tuning."""
import json
import subprocess
import sys
from pathlib import Path

phase = sys.argv[1]
raw = Path("/private/tmp/duckplan-reference-loop") / phase
out = Path(__file__).resolve().parent / phase
out.mkdir(exist_ok=True)
criteria = json.loads((out.parent / "acceptance.json").read_text())
metrics = {}

def interpolate(points, time):
    for (a, x), (b, y) in zip(points, points[1:]):
        if a <= time <= b:
            return x + (y - x) * (time - a) / (b - a)
    return points[-1][1]

for name in ["googleBefore", "local", "googleAfter"]:
    folder = raw / name
    subprocess.run(["swift", "-module-cache-path", "/private/tmp/duckplan-swift-modulecache",
                    str(out.parent.parent / "native-reference-rebound" / "analyze.swift"), str(folder)],
                   check=True, text=True, capture_output=True)
    data = json.loads((folder / "samples.json").read_text())
    capture = json.loads((folder / "frames.json").read_text())
    (out / f"{name}-samples.json").write_text(json.dumps(data, indent=2) + "\n")
    samples = [dict(sample, paintEdgeY=sample["paintEdgeY"] * (-1 if capture.get("direction") == "bottom" else 1)) for sample in data["samples"]]
    baseline = samples[0]["paintEdgeY"]
    peak = max(s["paintEdgeY"] for s in samples)
    last_peak = [s["timeMs"] for s in samples if s["paintEdgeY"] == peak][-1]
    tail = [(s["timeMs"] - last_peak, s["paintEdgeY"] - baseline)
            for s in samples if s["timeMs"] >= last_peak]
    first_rest = next((i for i, (time, value) in enumerate(tail) if time > 0 and value == 0), None)
    if first_rest is not None:
        tail = tail[:first_rest + 1]
    gaps = [b[0] - a[0] for a, b in zip(tail, tail[1:])]
    first_input = capture["inputEvents"][0]["time"] - capture.get("gestureStartTime", capture["inputEvents"][0]["time"])
    first_motion = next(s["timeMs"] for s in samples if s["paintEdgeY"] > baseline)
    metrics[name] = {"peakPx": peak - baseline, "returnMs": tail[-1][0],
                     "firstPaintFromInputMs": first_motion - first_input,
                     "complete": first_rest is not None and max(gaps, default=0) < 150,
                     "noExtraOscillation": all(value >= 0 for time, value in tail), "tail": tail}

local, reference = metrics["local"], metrics["googleAfter"]
end = min(local["tail"][-1][0], reference["tail"][-1][0])
errors = [abs(interpolate(local["tail"], time) - interpolate(reference["tail"], time))
          for time in range(0, int(end) + 1, 10)]
differences = {"peakPx": abs(local["peakPx"] - reference["peakPx"]),
               "returnMs": abs(local["returnMs"] - reference["returnMs"]),
               "firstPaintMs": abs(local["firstPaintFromInputMs"] - reference["firstPaintFromInputMs"]),
               "pathMaxPx": max(errors), "pathMeanPx": sum(errors) / len(errors)}
checks = {"completeCapture": local["complete"] and reference["complete"],
          "peak": differences["peakPx"] <= criteria["peakDifferencePxMax"],
          "return": differences["returnMs"] <= criteria["returnDurationDifferenceMsMax"],
          "firstPaint": differences["firstPaintMs"] <= criteria["firstPaintDifferenceAfterFirstWheelMsMax"],
          "path": differences["pathMaxPx"] <= criteria["releaseAlignedPathDifferencePxMax"],
          "noExtraOscillation": local["noExtraOscillation"]}
result = {"phase": phase, "status": "PASS" if all(checks.values()) else "FAIL" if checks["completeCapture"] else "INCONCLUSIVE_CAPTURE",
          "checks": checks, "differences": differences,
          "metrics": {name: {k: v for k, v in value.items() if k != "tail"} for name, value in metrics.items()}}
(out / "comparison.json").write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps(result, indent=2))
