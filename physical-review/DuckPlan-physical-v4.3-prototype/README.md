# DuckPlan V4.3 physical prototype

**Engineering status: unfinished prototype; do not manufacture the full device yet.** This package implements a CAD assembly around the linked V4.3 plan and provides a starting point for mechanical review. It is not a completed working mechanism or a validated product.

## Open the model

- `exports/duckplan_folded.step` — combined assembly with folded stand.
- `exports/duckplan_stand_open.step` — the same parts with the stand rotated 25 degrees.
- `exports/duckplan_with_hardware_envelopes.step` — folded assembly plus approximate display and speaker volumes. `exports/duckplan_with_all_reference_envelopes.step` also includes generic switch bodies.
- Individual parts in `exports/` have matching STEP and STL files. STEP retains CAD solids; STL is a mesh. STL files retain assembly coordinates, are not placed on a print bed, and are not production-ready.
- `technical-views.png` shows front, rear, side, top, deployed and exploded projections from the exported meshes. It is an orthographic study, not a dimensioned drawing.
- Run `build.py` using build123d 0.13.0, Pillow, numpy and OpenCV, after generating `../DuckPlan-physical-v4.3-control-study/exports/` and `../DuckPlan-physical-v4.3-hardware/exports/`. The code references the canonical approved v11 artwork. Run `views.py` to regenerate the views. `requirements.txt` lists the direct dependencies.

## What is modeled

A rounded bezel and rear tray, provisional corner screw bosses, a lower grille and two speaker alignment supports, a head cap with source-derived facial marks, an independent beak plunger and shaft guide, a rear-mounted head guide with retention lips, and a rear stand with two outer hinge knuckles and a central leaf. An example 2.8 mm hinge pin is included as a reference; it is not a specified purchased part. All dimensions and placements outside the manufacturer-listed display envelope are provisional. The artwork-derived face is faceted and the square guide frame is exposed; its appearance still needs refinement against the approved design.

Elecrow lists the selected CrowPanel Advance 7-inch overall dimensions as 181.26 × 108.36 × 16 mm and active area as 156 × 87 mm: https://www.elecrow.com/crowpanel-advance-7-hmi-esp32-ai-display-800x480-ai-ips-touch-screen.html. A bounding box is used in the CAD; screen position, board shape, fixing holes and connectors are not verified. The speaker envelope is 30 × 20 × 5 mm based on the candidate Adafruit 3923, whose actual selection is not confirmed: https://www.adafruit.com/product/3923. The case is provisionally 210 × 148 × 26 mm.

## Proposed assembly and print study

1. First make small PETG test pieces for the sliding fit and hinge pin, adjusting clearances for the printer. The model assumes 0.5 mm nominal per side at the main guide and 0.25 mm radial clearance between the example pin and nominal bore; neither has been physically tested.
2. A future complete build would fit the speaker behind the grille, secure the display after verified mounting and cable details are modeled, place the head in its guide and fit the beak through its guide, then join bezel and rear and install the stand pin. A speaker retainer and complete hardware specification are not yet designed.
3. Trial print orientation: shell cavity upward, front bezel flat, head face flat, beak face down, stand leaf flat. The model's guides, hinge and retainer lips may require support or redesign. Inspect the slicer layer preview and do not print the full assembly before mechanical validation. Face marks are thin separate solids and need a practical attachment or multi-material strategy.

## Verification and blockers

OpenCascade reported each generated part valid. The code sampled head movement at 0, -1, and -2 mm and beak motion at 0 and -1 mm; the tested head/beak, head/case, beak/guide combinations had zero solid intersection at those positions. The stand and rear had zero solid overlap at 0, 5, 10, 15, 20 and 25 degrees; the example pin also had zero overlap with the stand and rear. Approximate panel and speaker boxes did not intersect the rear at their assumed positions. These checks are discrete and do not test the swept path, forces, tolerances, fastening, actual components, or stability.

The initial head-switch envelope collided with the shell. A provisional shelf and clearance were added; the revised generic switch body boxes have zero modeled intersection with the shell and bezel, and zero intersection with the controls at the sampled rest and pressed positions. `switch_envelopes_reference.step` contains generic body volumes only; it does not model actuators or establish that a real switch can be fitted or activated. Neither actual tactile switch, its actuator and retention, wiring, return spring, beak retention, head travel stops nor electrical input is implemented. The stand has no positive open-angle stop and has not been shown to support the device. The front and rear fasteners, speaker retention, display fixing, cable openings and ventilation need hardware-specific engineering. The selected display, speaker SKU, switch models, connection pinout and physical measurements must be checked against the actual parts and manufacturer drawings before modifying the mounts or declaring anything print-ready. No physical print, assembly, electrical test, load test or slicing has been performed.
