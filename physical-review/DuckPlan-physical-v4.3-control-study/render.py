from pathlib import Path
from PIL import Image,ImageDraw
import struct
p=Path(__file__).parent
paths=[(p/'exports/rear_with_guide.stl',(196,181,159)),(p/'exports/front_notched.stl',(234,223,204)),(p/'exports/head_cap.stl',(250,248,239)),(p/'exports/beak_plunger.stl',(244,159,65)),(p.parent/'DuckPlan-physical-v4.3-hardware/exports/kickstand_concept.stl',(145,137,127))]
meshes=[]
for f,c in paths:
    b=f.read_bytes(); n=struct.unpack_from('<I',b,80)[0]
    for i in range(n):
        v=struct.unpack_from('<12fH',b,84+i*50); meshes.append((c,[v[3:6],v[6:9],v[9:12]]))
im=Image.new('RGB',(1500,550),'#f5f4ef'); d=ImageDraw.Draw(im)
views=[('FRONT',lambda x,y,z:(x,y,z)),('SIDE',lambda x,y,z:(z,y,-x)),('REAR',lambda x,y,z:(-x,y,-z))]
for j,(label,tf) in enumerate(views):
    cx=250+j*500; cy=280; scale=1.85; d.text((cx-210,20),label,fill='#333333')
    tris=[]
    for color,verts in meshes:
        points=[tf(*v) for v in verts]; tris.append((sum(v[2] for v in points)/3,color,points))
    for depth,color,points in sorted(tris,key=lambda q:q[0]):
        d.polygon([(cx+x*scale,cy-y*scale) for x,y,z in points],fill=color)
    d.text((cx-210,510),'CAD study - mechanisms incomplete',fill='#555555')
im.save(p/'control-views.png')
