# DuckPlan V4.3 — hardware-based preliminary CAD study

**Status: concept only. Not a complete, functional, or print-ready design.** The linked updated plan specifies an Elecrow CrowPanel Advance 7-inch ESP32-S3 and an Adafruit mini oval 8 Ω / 1 W speaker, with a separate head dismiss control, beak snooze control, lower speaker and folding support. This folder preserves the previous study and updates the preliminary proportions for that display.

## Dimensions and sources

- Elecrow lists the display's overall dimensions as **181.26 × 108.36 × 16 mm**, and active area as **156 × 87 mm**: https://www.elecrow.com/crowpanel-advance-7-hmi-esp32-ai-display-800x480-ai-ips-touch-screen.html
- The CAD represents the CrowPanel as a **simple box**, not a manufacturer CAD model. Its precise glass, board, connector, mounting-hole and component geometry and the position of the active area inside the overall envelope remain unverified. The viewing opening is temporarily 156 × 87 mm and its position is assumed; it is not a verified bezel design.
- The specific Adafruit speaker SKU is not selected. For spatial planning only, a **30 × 20 × 5 mm** box represents one possible speaker, Adafruit product 3923: https://www.adafruit.com/product/3923. Its connector and cable compatibility with the CrowPanel have not been verified. The envelope is not a speaker cavity or mount.
- The housing is **210 × 148 × 26 mm**, an unverified design choice. Clearances and overall dimensions must be revisited with the actual panel.

## Files and checks

`model.py` is the parametric build123d source. `exports/assembly_with_hardware_envelopes.step` includes the five concept pieces plus two box-shaped reference envelopes. `assembly_folded_concept.step` contains only the five concept pieces. `assembly_deployed_concept.step` rotates the same stand plate around an assumed axis; it is a motion study, with no physical hinge or demonstrated floor contact. Individual STEP and STL exports are for inspection, in assembly coordinates; the STL files are not arranged or validated for printing. `concept-views.png` is rendered from the same exported part meshes.

OpenCascade reports all exported STEP models as valid. The two assumed hardware boxes do not intersect each other or the rear tray in their assumed positions. This is only an envelope check; it is not verification of connector clearance, actual fit, function, or stability.

## Missing work before manufacture

The duck is a simple placeholder and does not yet reproduce the approved Sigma face or outline. No independent button guides, switches, return springs, detachable module, speaker mount, PCB/display mount, fasteners, wiring, cable opening, ventilation, stand hinge or stand stop has been designed. The stand plate merely illustrates the folded location. No interference or motion analysis, slicing, PETG fit test, button test or physical stability test has been completed. Keep manufacturer-unverified mounting holes, speaker cavities and connector cutouts open until drawings and physical components can establish their dimensions.

Run `python model.py` with build123d 0.13.0 to regenerate. Run `python render_views.py` with Pillow to regenerate the overview.
