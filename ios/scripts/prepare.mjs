// Deterministic, original alarm tones. No downloaded or copyrighted sound assets.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sounds = path.join(root, 'Resources/Sounds');
fs.mkdirSync(sounds, { recursive: true });
function tone(name, notes, pulse) {
  const rate = 22050, seconds = 4, frames = rate * seconds;
  const data = Buffer.alloc(44 + frames * 2);
  data.write('RIFF',0); data.writeUInt32LE(data.length-8,4); data.write('WAVEfmt ',8);
  data.writeUInt32LE(16,16); data.writeUInt16LE(1,20); data.writeUInt16LE(1,22);
  data.writeUInt32LE(rate,24); data.writeUInt32LE(rate*2,28); data.writeUInt16LE(2,32); data.writeUInt16LE(16,34);
  data.write('data',36); data.writeUInt32LE(frames*2,40);
  for(let i=0;i<frames;i++) {
    const t=i/rate, age=t%pulse, frequency=notes[Math.floor(t/pulse)%notes.length];
    const envelope=Math.min(1,age/0.015)*Math.exp(-age*5)*Math.min(1,(seconds-t)/0.1);
    const wave=Math.sin(2*Math.PI*frequency*age)+0.25*Math.sin(2*Math.PI*frequency*2*age);
    data.writeInt16LE(Math.round(wave*envelope*11000),44+i*2);
  }
  fs.writeFileSync(path.join(sounds, name+'.wav'),data);
}
tone('gentle',[523.25,659.25,783.99],0.8);
tone('bright',[880,1174.66,1046.5,1318.51],0.32);
const icons = path.join(root,'Resources/Assets.xcassets/AppIcon.appiconset');
fs.mkdirSync(icons,{recursive:true});
execFileSync('/usr/bin/sips',['-z','1024','1024',path.join(root,'../landing/assets/duckplan-sigma-head-v7.png'),'--out',path.join(icons,'AppIcon.png')]);
fs.writeFileSync(path.join(icons,'Contents.json'),JSON.stringify({images:[{filename:'AppIcon.png',idiom:'universal',platform:'ios',size:'1024x1024'}],info:{author:'xcode',version:1}},null,2)+'\n');
fs.writeFileSync(path.join(root,'Resources/Assets.xcassets/Contents.json'),JSON.stringify({info:{author:'xcode',version:1}},null,2)+'\n');
console.log('Prepared native app icon and alarm sounds.');
