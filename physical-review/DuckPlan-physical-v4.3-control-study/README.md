# DuckPlan V4.3 — control geometry study

This is a **work-in-progress CAD model**, not a functional or print-ready assembly. The previous envelope is preserved separately in `DuckPlan-physical-v4.3-hardware`.

`control.py` samples the outer dark contour of the approved v11 duck image and scales it into a preliminary head cap. The sampled contour is faceted and cropped, and the face and bill have not yet been faithfully modeled. The rectangular frame is visible in this first study and needs refinement. The cap includes a preliminary rear sliding rim and a wide beak clearance opening. The guide is joined to the rear shell and a clearance notch is cut in the front bezel. The separate elliptical plunger is only a provisional representation of the orange beak.

The script checks solid intersections at head offsets of 0, -1 and -2 mm and beak offsets of 0 and -1 mm. At those sampled positions, it reports zero volume overlap for head versus beak, guide, rear case, and front bezel. This is a static CAD intersection check, **not** a continuous-motion, tolerance, force or usability test. The beak has no carrier, the head has no retaining features, neither control has a switch, spring, travel stop, or reliable alignment, and the stand has no hinge. Do not print this as a working mechanism.

`exports/duckplan_integrated_study.step` shows the full current study. Separate STEP and STL exports provide the cap, beak, guide and updated shell. STLs use assembly coordinates and are not arranged for a slicer. `control-views.png` is rendered from the same geometry. Use `python control.py` with build123d 0.13.0 and Pillow; run `python render.py` for the view.

Next work is to reproduce the approved face and bill, replace the exposed rectangular guide with an enclosed detachable module, design retention and switch mounting for verified components, complete the rear hinge and stop, verify real display fit and connectors, then print and test mechanism coupons before the complete case.
