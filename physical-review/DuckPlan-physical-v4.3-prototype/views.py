"""Project the same exported meshes into six technical-view panels."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import struct, math
p=Path(__file__).resolve().parent
items=[('rear_shell',(189,176,154)),('front_bezel',(233,223,205)),('head_cap',(252,249,241)),('beak',(242,158,72)),('kickstand',(145,139,130))]+[(f'face_mark_{i}',(30,31,33)) for i in range(1,5)]
meshes=[]
for name,col in items:
    raw=(p/'exports'/f'{name}.stl').read_bytes(); n=struct.unpack_from('<I',raw,80)[0]
    for i in range(n):
        v=struct.unpack_from('<12fH',raw,84+i*50); meshes.append((name,col,[v[3:6],v[6:9],v[9:12]]))
W,H=1800,1120
img=Image.new('RGB',(W,H),'#f5f4f0'); d=ImageDraw.Draw(img)
try: f=ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc',20); small=ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc',15)
except OSError: f=small=ImageFont.load_default()
views=[('Front',lambda x,y,z:(x,y,z),'normal'),('Rear',lambda x,y,z:(-x,y,-z),'normal'),('Right side',lambda x,y,z:(z,y,-x),'normal'),('Top',lambda x,y,z:(x,-z,y),'normal'),('Stand deployed',lambda x,y,z:(x+0.46*z,y+0.24*z,z-0.28*x),'open'),('Exploded',lambda x,y,z:(x+0.55*z,y+0.28*z,z-0.4*x),'explode')]
def trans(name,v,mode):
    x,y,z=v
    if mode=='open' and name=='kickstand':
        a=math.radians(25); yy=y-23; zz=z+32
        y=23+math.cos(a)*yy-math.sin(a)*zz; z=-32+math.sin(a)*yy+math.cos(a)*zz
    if mode=='explode':
        shift={'rear_shell':-16,'front_bezel':5,'head_cap':19,'beak':29,'kickstand':-43}.get(name,24)
        z+=shift
        if name.startswith('face_mark'): y+=10
        if name in ('head_cap','beak'): y+=10
    return x,y,z
for i,(label,proj,mode) in enumerate(views):
    cx=(i%3)*600+300; cy=(i//3)*550+275; d.rounded_rectangle((i%3*600+15,i//3*550+15,i%3*600+585,i//3*550+535),radius=15,fill='white',outline='#dedbd2',width=2)
    d.text((i%3*600+35,i//3*550+32),label,font=f,fill='#222222')
    tris=[]
    for name,col,verts in meshes:
        q=[proj(*trans(name,v,mode)) for v in verts]
        tris.append((sum(v[2] for v in q)/3,col,q))
    for depth,col,q in sorted(tris,key=lambda a:a[0]):
        d.polygon([(cx+x*2,cy-y*2) for x,y,z in q],fill=col)
    d.text((i%3*600+35,i//3*550+504),'Provisional CAD  |  dimensions in mm',font=small,fill='#76716a')
img.save(p/'technical-views.png')
