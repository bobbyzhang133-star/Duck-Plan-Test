"""DuckPlan V4.3 editable functional-form prototype; mm; not production ready."""
from pathlib import Path
from build123d import *
import cv2
import numpy as np
root=Path(__file__).resolve().parent
out=root/'exports'; out.mkdir(exist_ok=True)
prev=root.parent/'DuckPlan-physical-v4.3-control-study/exports'
hardware=root.parent/'DuckPlan-physical-v4.3-hardware/exports'
front=import_step(prev/'front_notched.step')
# Provisional clearance for a replaceable 6 mm head switch carrier.
front-=Pos(0,71,-1)*Box(42,12,5,align=(Align.CENTER,Align.CENTER,Align.MIN))
rear=import_step(prev/'rear_with_guide.step')
head=import_step(prev/'head_cap.step')
# The panel's exact fixing coordinates and connectors are not known. The following
# corner posts and holes are preliminary candidate geometry, not finalized fittings.
for x in (-98.5,98.5):
    for y in (-67.5,67.5):
        boss=Pos(x,y,-24)*Cylinder(3.9,24,align=(Align.CENTER,Align.CENTER,Align.MIN))
        rear=rear + boss
        rear=rear - Pos(x,y,-21)*Cylinder(1.25,22,align=(Align.CENTER,Align.CENTER,Align.MIN))
        front=front - Pos(x,y,-1)*Cylinder(1.45,5,align=(Align.CENTER,Align.CENTER,Align.MIN))
# Speaker alignment supports, for a preliminary 30 x 20 x 5 envelope.
# They do not lock the speaker; separate retention, wiring and acoustic design remain TBD.
for x in (-17.1,17.1):
    support=Pos(x,-61,-24)*Box(3,24,16,align=(Align.CENTER,Align.CENTER,Align.MIN))
    rear=rear + support
# Retainer lips, 0.35 mm nominal face clearance over the head cap. The lips
# connect to the sides of the guide. Stops and spring seats remain provisional.
for side in (-1,1):
    x=side*20.5
    uprights=Pos(x,91,1)*Box(3,28,4.35,align=(Align.CENTER,Align.CENTER,Align.MIN))
    lip=Pos(side*19,91,5.35)*Box(6,28,1.2,align=(Align.CENTER,Align.CENTER,Align.MIN))
    rear=rear+uprights+lip
# Beak shaft guide attached to the fixed plate. An unconfirmed switch and
# return spring will need their own replaceable mount before functional use.
collar=Pos(0,84,-3)*Box(9,6,4.5,align=(Align.CENTER,Align.CENTER,Align.MIN))
collar-=Pos(0,84,-4)*Box(6.6,3.6,7,align=(Align.CENTER,Align.CENTER,Align.MIN))
rear=rear+collar
# Provisional plunger path and an undershelf for a generic head switch.
rear-=Pos(0,84,-7)*Box(6.6,3.6,7,align=(Align.CENTER,Align.CENTER,Align.MIN))
rear+=Pos(0,69.5,-1)*Box(8,7,2,align=(Align.CENTER,Align.CENTER,Align.MIN))
# Foldable stand concept: pin axis across X, two rear knuckles and a central leaf.
# Generic 3 mm pin, 0.3 mm radial running clearance; provisional tolerance.
pivot_y,pivot_z=23,-32
axis_rotation=Rot(0,90,0)
def cyl_x(x,y,z,length,r):
    return Pos(x,y,z)*axis_rotation*Cylinder(r,length,align=(Align.CENTER,Align.CENTER,Align.MIN))
for x in (-29,23):
    neck=Pos(x+3,pivot_y,-29)*Box(6,10,6,align=(Align.CENTER,Align.CENTER,Align.CENTER))
    knuckle=cyl_x(x,pivot_y,pivot_z,6,5)
    rear=rear + neck + knuckle
    rear=rear-cyl_x(x-1,pivot_y,pivot_z,8,1.65)
# Leaf integrates a hinge barrel; arm extends down from the pivot when folded.
stand=Pos(0,-24,-33.5)*Box(44,94,3,align=(Align.CENTER,Align.CENTER,Align.MIN))
stand=stand+cyl_x(-21,pivot_y,pivot_z,42,4.6)
stand=stand-cyl_x(-22,pivot_y,pivot_z,44,1.65)
stand_open=stand.rotate(Axis((0,pivot_y,pivot_z),(1,0,0)),25)
# Artwork-derived facial mark vectors and beak shape from the approved v11 asset.
img=cv2.imread(str(root.parent/'DuckPlan-motion-preview/landing/assets/duckplan-sigma-head-v11.png'))
# Pixel -> head coordinate transform matching the earlier head contour.
def point(x,y): return ((float(x)-512)*0.045,74+(850-float(y))*0.045)
def extruded_contour(contour,z,thickness):
    perimeter=cv2.arcLength(contour,True)
    approx=cv2.approxPolyDP(contour, max(1.5,perimeter*0.002), True).reshape(-1,2)
    coords=[point(x,y) for x,y in approx]
    with BuildPart() as b:
        with BuildSketch(Plane.XY.offset(z)):
            Polygon(*coords,align=None)
        extrude(amount=thickness)
    return b.part
# Separate dark appliqués for eyebrows/eyes, derived from the source image.
gray=cv2.cvtColor(img,cv2.COLOR_BGR2GRAY)
mask=np.zeros_like(gray); mask[270:490,220:805]=(gray[270:490,220:805]<65).astype(np.uint8)*255
contours,_=cv2.findContours(mask,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
face=[]
for contour in contours:
    if cv2.contourArea(contour)>600:
        face.append(extruded_contour(contour,5.02,0.6))
# Source peach bill mask, separate plunger with provisional shaft.
b,g,r=cv2.split(img)
peach=((r>200)&(g>110)&(g<220)&(b>75)&(b<190)).astype(np.uint8)*255
peach[:490,:]=0; peach[800:,:]=0
cs,_=cv2.findContours(peach,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
bill_shape=extruded_contour(max(cs,key=cv2.contourArea),4,3)
# Increase opening for the artwork-derived beak plus proposed vertical head travel.
head=head-Pos(0,84,-4)*Box(22,17,12,align=(Align.CENTER,Align.CENTER,Align.MIN))
beak=bill_shape + Pos(0,84,-6.1)*Box(6,3,10.2,align=(Align.CENTER,Align.CENTER,Align.MIN))
pin=cyl_x(-30,pivot_y,pivot_z,60,1.4)  # 2.8 mm example pin; actual hardware unselected
parts={'hinge_pin_reference':pin,'front_bezel':front,'rear_shell':rear,'head_cap':head,'beak':beak,'kickstand':stand}
for i,f in enumerate(face): parts[f'face_mark_{i+1}']=f
for name,obj in parts.items():
    print(name,'solids',len(obj.solids()),'valid',obj.is_valid,'volume',round(obj.volume,2))
    export_step(obj,out/(name+'.step')); export_stl(obj,out/(name+'.stl'))
assembly=Compound(children=list(parts.values()),label='DuckPlan V4.3 prototype')
export_step(assembly,out/'duckplan_folded.step')
export_step(Compound(children=[front,rear,head,beak,stand_open,pin,*face]),out/'duckplan_stand_open.step')
panel=import_step(hardware/'crowpanel_envelope_reference.step')
speaker=import_step(hardware/'speaker_envelope_unconfirmed.step')
export_step(Compound(children=[*parts.values(),panel,speaker]),out/'duckplan_with_hardware_envelopes.step')
def intersection_volume(a,b):
    c=a & b
    return round(c.volume,5) if c is not None else 0.0
print('panel/rear',intersection_volume(panel,rear),'speaker/rear',intersection_volume(speaker,rear))
for h in (0,-1,-2):
    moved=Pos(0,h,0)*head
    print('head travel',h,'case',intersection_volume(moved,rear),'front',intersection_volume(moved,front), 'beak at rest',intersection_volume(moved,beak),'beak pressed',intersection_volume(moved,Pos(0,0,-1)*beak))
print('beak resting/guide',intersection_volume(beak,rear),'beak pressed/guide',intersection_volume(Pos(0,0,-1)*beak,rear))
print('stand folded/rear',intersection_volume(stand,rear),'open/rear',intersection_volume(stand_open,rear))

# Two generic switch envelopes show only reserved volume; actual switches are not selected.
# They are references, not a verified switch mechanism or printable part.
head_switch=Pos(0,68.5,3.5)*Box(6,6,3,align=(Align.CENTER,Align.CENTER,Align.CENTER))
beak_switch=Pos(0,84,-9)*Box(6,6,3,align=(Align.CENTER,Align.CENTER,Align.CENTER))
export_step(Compound(children=[head_switch,beak_switch]),out/'switch_envelopes_reference.step')
print('switch envelope vs shell',intersection_volume(head_switch,rear),intersection_volume(beak_switch,rear),'head switch vs bezel',intersection_volume(head_switch,front))
print('beak vs switch body rest/pressed',intersection_volume(beak,beak_switch),intersection_volume(Pos(0,0,-1)*beak,beak_switch))
print('head vs switch body rest/pressed',intersection_volume(head,head_switch),intersection_volume(Pos(0,-2,0)*head,head_switch))
export_step(Compound(children=[*parts.values(),panel,speaker,head_switch,beak_switch]),out/'duckplan_with_all_reference_envelopes.step')
