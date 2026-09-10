from pathlib import Path
from PIL import Image,ImageOps,ImageDraw
import pdfplumber,json
root=Path(r'C:\Users\richa\program-kasir\program-kasir-local')
files=sorted((root/'tmp/audit').glob('audit-page-*.png'))
for batch in range(2):
 selected=files[batch*6:(batch+1)*6]
 sheet=Image.new('RGB',(1260,1240),'#cccccc')
 for j,p in enumerate(selected):
  im=Image.open(p).convert('RGB');im.thumbnail((408,580))
  x=(j%3)*420+6;y=(j//3)*620+24
  sheet.paste(im,(x,y));ImageDraw.Draw(sheet).text((x,y-18),p.stem,fill='black')
 sheet.save(root/f'tmp/audit/review-{batch+1}.png')
checks=[]
with pdfplumber.open(root/'output/pdf/audit-menyeluruh-kasir-pintar.pdf') as pdf:
 for i,p in enumerate(pdf.pages):
  words=p.extract_words()
  checks.append({'page':i+1,'words':len(words),'minX':round(min(w['x0'] for w in words),1),'maxX':round(max(w['x1'] for w in words),1),'minY':round(min(w['top'] for w in words),1),'maxY':round(max(w['bottom'] for w in words),1)})
print(json.dumps(checks))
(root/'tmp/audit/pdf-qa.json').write_text(json.dumps(checks,indent=2))
