"""DuckPlan V4.3 preliminary envelope study. Dimensions are placeholders, mm.
Not a manufacturing design: see README before printing or assembling.
"""
from pathlib import Path
from build123d import *

OUT = Path(__file__).parent / 'exports'
OUT.mkdir(exist_ok=True)
# Coordinates: X horizontal, Y up the face, Z toward viewer. Dimensions provisional.
W,H,D,R = 210,148,26,9
VIEW_W,VIEW_H = 156,87
PANEL_W,PANEL_H,PANEL_D = 181.26,108.36,16

def rounded_plate(w,h,r,z,thick):
    with BuildPart() as p:
        with BuildSketch(Plane.XY.offset(z)):
            RectangleRounded(w,h,r)
        extrude(amount=thick)
    return p.part

def bore(part,x,y,z,r,depth):
    return part - Pos(x,y,z)*Cylinder(r,depth,align=(Align.CENTER,Align.CENTER,Align.MIN))

# Front frame and rear open tray. No display retention is claimed.
bezel = rounded_plate(W,H,R,0,3) - Pos(0,8,-1)*Box(VIEW_W,VIEW_H,5,align=(Align.CENTER,Align.CENTER,Align.MIN))
for x in range(-30,31,6):
    bezel = bore(bezel,x,-63,-1,1,5)
rear = rounded_plate(W,H,R,-D,2) + (rounded_plate(W,H,R,-D+2,D-2) - rounded_plate(W-5,H-5,R-2.5,-D+1,D))
# Duck cap: illustrative separate parts, no inferred actuator or switch geometry.
head = Pos(0,87,0)*Box(28,26,7,align=(Align.CENTER,Align.CENTER,Align.MIN))
head = head + Pos(0,100,0)*Cylinder(14,7,align=(Align.CENTER,Align.CENTER,Align.MIN))
# orange beak overlaps head intentionally as a visual placeholder
beak = Pos(0,88,7)*Box(19,7,3,align=(Align.CENTER,Align.CENTER,Align.MIN))
# Separate removable stand representation, not a validated hinge or stop.
stand = Pos(0,-4,-31)*Box(45,90,4,align=(Align.CENTER,Align.CENTER,Align.MIN))
parts={'front_bezel':bezel,'rear_shell':rear,'duck_head_concept':head,'beak_concept':beak,'kickstand_concept':stand}
for name,part in parts.items():
    export_step(part,OUT / f'{name}.step')
    export_stl(part,OUT / f'{name}.stl')
# Separate fit envelopes; placement is provisional, not a manufacturer CAD model.
panel = Pos(0,8,-16)*Box(PANEL_W,PANEL_H,PANEL_D,align=(Align.CENTER,Align.CENTER,Align.MIN))
export_step(panel,OUT/'crowpanel_envelope_reference.step')
# Adafruit 3923 is one possible SKU, not confirmed. Include space for connector routing separately.
speaker = Pos(0,-61,-8)*Box(30,20,5,align=(Align.CENTER,Align.CENTER,Align.MIN))
export_step(speaker,OUT/'speaker_envelope_unconfirmed.step')
assembly=Compound(children=list(parts.values()),label='DuckPlan V4.3 preliminary study')
export_step(assembly,OUT/'assembly_folded_concept.step')
# Kinematic study only: rotation about an assumed pin axis, no hinge hardware.
stand_deployed = stand.rotate(Axis((0, 41, -29), (1, 0, 0)), 25)
deployed = Compound(children=[bezel, rear, head, beak, stand_deployed],label='Deployed support study')
export_step(deployed, OUT/'assembly_deployed_concept.step')
reference = Compound(children=list(parts.values()) + [panel, speaker],label='Assembly with provisional component envelopes')
export_step(reference,OUT/'assembly_with_hardware_envelopes.step')
print('Panel vs rear shell intersection mm³:', round((panel & rear).volume, 6))
print('Speaker vs panel intersection mm³:', round((speaker & panel).volume, 6))
print('Speaker vs rear shell intersection mm³:', round((speaker & rear).volume, 6))
print('Wrote', len(parts),'parts and assembly to', OUT)
for name,p in parts.items():
    print(name, 'valid=',p.is_valid, 'solids=',len(p.solids()), 'volume=',round(p.volume,2))
