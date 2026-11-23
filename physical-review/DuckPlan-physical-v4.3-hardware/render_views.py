"""Render orthographic overview of exported meshes, using the same assembly geometry."""
from pathlib import Path
from PIL import Image, ImageDraw
import struct, math
P=Path(__file__).parent
colors={'front_bezel':(229,217,192),'rear_shell':(199,186,163),'duck_head_concept':(244,237,219),'beak_concept':(247,159,70),'kickstand_concept':(159,151,139)}
meshes=[]
for name,c in colors.items():
    b=(P/'exports'/f'{name}.stl').read_bytes(); n=struct.unpack_from('<I',b,80)[0]
    for i in range(n):
        vals=struct.unpack_from('<12fH',b,84+i*50)
        meshes.append((name,c,[vals[3:6],vals[6:9],vals[9:12]]))
im=Image.new('RGB',(1500,530),'#f8f7f2'); dr=ImageDraw.Draw(im)
views=[('FRONT',lambda x,y,z:(x,y,z)),('SIDE',lambda x,y,z:(z,y,-x)),('REAR',lambda x,y,z:(-x,y,-z))]
for j,(label,transform) in enumerate(views):
    cx=250+j*500; cy=265; scale=1.85
    dr.text((cx-210,20),label,fill='#303030',stroke_width=0)
    tris=[]
    for name,c,vertices in meshes:
        p=[transform(*v) for v in vertices]
        tris.append((sum(v[2] for v in p)/3,c,p))
    for depth,c,p in sorted(tris,key=lambda t:t[0]):
        dr.polygon([(cx+x*scale,cy-y*scale) for x,y,z in p],fill=c)
    dr.text((cx-210,485),'Concept only • hardware dimensions unverified',fill='#555555')
im.save(P/'concept-views.png')
