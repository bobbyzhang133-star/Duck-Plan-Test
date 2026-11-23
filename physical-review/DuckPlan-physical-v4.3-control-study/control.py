"""Early control geometry study in mm; source asset-derived silhouette, not print-ready."""
from pathlib import Path
from PIL import Image
from build123d import *
root=Path(__file__).resolve().parent
out=root/'exports'; out.mkdir(exist_ok=True)
asset=root.parent/'DuckPlan-motion-preview/landing/assets/duckplan-sigma-head-v11.png'
im=Image.open(asset).convert('RGB')
# Sample the outer dark contour, excluding the bottom flare where the artwork is cropped.
# Each side uses outermost dark pixel; 12-pixel sampling is a deliberate faceting approximation.
left=[]; right=[]
for row in range(125, 850, 12):
    dark=[x for x in range(30,994) if max(im.getpixel((x,row)))<95]
    if dark and max(dark)-min(dark)>20:
        left.append((min(dark),row)); right.append((max(dark),row))
assert len(left)>30
scale=0.045
pts=[((x-512)*scale,74+(850-y)*scale) for x,y in left+right[::-1]]
with BuildPart() as cap_build:
    with BuildSketch(Plane.XY.offset(2)):
        Polygon(*pts, align=None)
    extrude(amount=3)
cap=cap_build.part
# Sliding rim sits between two guide rails and clears the backing plate.
carriage = Pos(0,90.5,-2.5)*Box(37,27,4.7,align=(Align.CENTER,Align.CENTER,Align.MIN))
carriage -= Pos(0,90.5,-3)*Box(29,19,6,align=(Align.CENTER,Align.CENTER,Align.MIN))
cap = cap + carriage
# Large temporary aperture permits vertical head travel independently of the beak.
aperture=Pos(0,86,-3)*Box(20,13,9,align=(Align.CENTER,Align.CENTER,Align.MIN))
cap=cap-aperture
# Backing carriage deliberately retains smooth faces; actual switches and fasteners are not specified.
base=Pos(0,89,-6)*Box(44,38,3,align=(Align.CENTER,Align.CENTER,Align.MIN))
# Mechanical sliding clearances start at 0.35 mm per side and require a print coupon.
for x in (-20.5,20.5):
    base += Pos(x,91,-3)*Box(3,34,4,align=(Align.CENTER,Align.CENTER,Align.MIN))
# A separate rounded beak with a narrower shaft to represent an inward moving plunger.
with BuildPart() as beak_build:
    with BuildSketch(Plane.XY.offset(4)):
        with Locations((0,86)):
            Ellipse(8,3.5)
    extrude(amount=3)
beak=beak_build.part + Pos(0,86,-1)*Box(6,3,5,align=(Align.CENTER,Align.CENTER,Align.MIN))
parts={'head_cap':cap,'guide_backplate':base,'beak_plunger':beak}
for n,p in parts.items():
    export_step(p,out/f'{n}.step'); export_stl(p,out/f'{n}.stl')
    print(n,'valid',p.is_valid,'solids',len(p.solids()),'volume',round(p.volume,2))
export_step(Compound(children=list(parts.values())),out/'duck_control_study.step')
# Check static clearances and idealized 2 mm head translation and 1 mm beak travel.
for h in (0,-1,-2):
    moved=Pos(0,h,0)*cap
    for b in (0,-1):
        bp=Pos(0,0,b)*beak
        hit=moved & bp
        print('head',h,'beak',b,'overlap mm3',round(hit.volume,6))
    print('head',h,'backplate overlap mm3',round((moved & base).volume,6))

# Merge the frame to the earlier rear-shell study; all mounting details remain provisional.
case_dir=root.parent/'DuckPlan-physical-v4.3-hardware/exports'
rear=import_step(case_dir/'rear_shell.step')
front=import_step(case_dir/'front_bezel.step')
# Clearance notch through the top bezel for head down-travel.
front -= Pos(0,73,-1)*Box(42,8,5,align=(Align.CENTER,Align.CENTER,Align.MIN))
export_step(front,out/'front_notched.step')
export_stl(front,out/'front_notched.stl')
stand=import_step(case_dir/'kickstand_concept.step')
rear_with_guide=rear + base
print('rear plus guide solids',len(rear_with_guide.solids()),'valid',rear_with_guide.is_valid)
export_step(rear_with_guide,out/'rear_with_guide.step')
export_stl(rear_with_guide,out/'rear_with_guide.stl')
export_step(Compound(children=[rear_with_guide,front,stand,cap,beak]),out/'duckplan_integrated_study.step')
for h in (0,-1,-2):
    print('head',h,'full case overlap mm3',round(((Pos(0,h,0)*cap) & rear_with_guide).volume,6), 'front overlap', round(((Pos(0,h,0)*cap) & front).volume,6))
