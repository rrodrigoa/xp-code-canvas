"""Create static SVG/PNG concept checks from V4 visual tokens; NOT a live extension capture."""
from pathlib import Path
import cairosvg
from html import escape
P=Path(__file__).resolve().parents[1]/'docs'
W,H=1600,960
ink='#dde5ef'; muted='#93a2b7';surface='#171f29';bg='#11161e'; line='#344151'
blue='#7cafe8';green='#78c7a5';purple='#b4a0e3';amber='#dec07e'
css=f'''<style>text{{font-family:Inter,Segoe UI,Arial,sans-serif;fill:{ink}}}.mono{{font-family:Consolas,monospace}}.muted{{fill:{muted}}}.cap{{font-size:11px;font-weight:bold;letter-spacing:1.6px}}.sub{{font-size:12px}}.title{{font-size:19px;font-weight:bold}}.edge{{fill:none;stroke:{blue};stroke-width:2;stroke-dasharray:7 5}}.small{{font-size:11px}}.tiny{{font-size:10px}}.bold{{font-weight:bold}}</style>'''
def rect(x,y,w,h,fill=surface,stroke=line,r=9,width=1):return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}" stroke="{stroke}" stroke-width="{width}"/>'
def text(x,y,s,size=13,color=ink,extra=''):return f'<text x="{x}" y="{y}" font-size="{size}" fill="{color}" style="fill:{color}" {extra}>{escape(str(s))}</text>'
def wrap(content):
 return f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}"><defs><pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".8" fill="#314255"/></pattern><linearGradient id="rin" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="{blue}" stop-opacity=".22"/><stop offset="1" stop-color="{blue}" stop-opacity=".8"/></linearGradient><linearGradient id="rout" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="{green}" stop-opacity=".8"/><stop offset="1" stop-color="{green}" stop-opacity=".23"/></linearGradient><marker id="arr" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto"><path d="M1 1 L9 5 L1 9" fill="none" stroke="{blue}" stroke-width="1.6"/></marker></defs>{css}{rect(0,0,W,H,bg,bg,0)}{content}</svg>'
def chrome(active):
 s=rect(0,0,W,68,'#1b222c','#293543',0)+rect(0,68,W,43,'#181e27','#293543',0)
 s+=rect(17,15,38,38,'#243549',blue,10)+text(27,41,'◇',24,blue)+text(69,29,'XP Canvas',15,ink,'font-weight="bold"')+text(69,46,'PYTHON UML',10,muted,'letter-spacing="1.6"')
 x=268
 for label in ['Architecture','Packages','Modules','Code']:
  width=112 if label=='Architecture' else 95
  s+=rect(x,18,width,31,'#314054' if label=='Code' else '#242c36',blue if label=='Code' else line,6)+text(x+15,38,label,12)
  x+=width+4
 s+=rect(734,18,186,32,'#202833',line,6)+text(747,38,'◎  agent.py',12)
 s+=rect(934,18,210,32,'#202833',line,6)+text(948,38,'⌕  Find a symbol',12,muted)
 s+=rect(1220,17,148,36,'#202833',line,8)
 for i,l in enumerate(['UML','Flow']):
  selected=l==active
  s+=rect(1224+i*70,21,70,27,'#344459' if selected else '#202833',blue if selected else '#202833',5)+text(1243+i*70,39,l,12,ink if selected else muted)
 s+=text(1424,38,'▦   ⊞   ⚙',17,muted)
 s+=text(23,95,'◌  CONNECTIONS',11,muted)+text(180,95,'4 types visible',12,ink)+text(366,95,'Trace: All relationships',12,muted)+text(1252,95,'⊙ GIT DIFF',11,muted)+rect(1352,76,88,26,'#1b222c',line,5)+text(1363,93,'HEAD~1',11)
 s+=rect(0,111,W,H-111,'url(#grid)','none',0)
 return s
def role_card(x,y,w,h,title,role,kind,lines=None,status=None,subtitle=None):
 pal={'class':amber,'callable':blue,'module':purple,'data':green};c=pal[role]
 s=rect(x,y,w,h,surface,line,11)+rect(x,y,w,4,c,c,1)
 s+=rect(x+15,y+18,34,34,'#2c3642',c,8)+text(x+25,y+42,{'class':'▣','callable':'ƒ','module':'▤','data':'#'}[role],21,c)
 s+=text(x+61,y+23,'«'+kind+'»',11,muted)+text(x+61,y+46,title,15,ink,'font-weight="bold"')+text(x+w-72,y+36,'⌄  ⋮  ⇥',15,muted)
 sep=y+65;s+=f'<path d="M{x+1} {sep} H{x+w-1}" stroke="{line}"/>'
 if status:s+=rect(x+14,sep+9,85,23,'#39372a',amber,5)+text(x+25,sep+25,status,11,amber)
 if lines:
  top=sep+(46 if status else 16);s+=text(x+16,top+1,'STRUCTURE',10,muted,'font-weight="bold" letter-spacing="1.2"')
  s+=text(x+w-118,top+1,f'{len(lines)} CONSTRUCTS',10,muted)
  for i,(label,rname,count) in enumerate(lines):
   by=top+17+i*42
   rc=pal[rname];s+=rect(x+16,by,w-32,35,'#222d39',rc,6)+rect(x+16,by,4,35,rc,rc,2)
   s+=text(x+29,by+23,label,12,ink,'font-family="Consolas,monospace"')+text(x+w-79,by+23,str(count)+' links',10,muted)
 if subtitle:s+=text(x+17,y+h-16,subtitle,11,muted)
 return s
# UML view
s=chrome('UML')
s+=rect(30,131,274,56,'#1b222c',line,9)+text(48,155,'◫  agent.py',14,ink,'font-weight="bold"')+text(48,174,'Code · Anatomy   •   18 symbols   •   12 links',11,muted)
s+=rect(530,192,460,673,'#182532','#38618d',15)+rect(557,180,126,26,'#202c3b','#4e7ea9',6)+text(572,198,'▤   agent.py',11,blue)
s+='<path d="M378 408 H470 Q489 408 489 431 V435 H576" class="edge" marker-end="url(#arr)"/>'
s+='<path d="M954 464 H1065 Q1080 464 1080 430 H1141" class="edge" marker-end="url(#arr)"/>'
s+='<path d="M951 644 H1052 Q1080 644 1080 711 H1142" class="edge" marker-end="url(#arr)"/>'
s+=role_card(67,365,311,160,'handle_request','callable','function',subtitle='api.py · L18')
s+=role_card(577,234,378,346,'Agent','class','class',lines=[('plan','callable',2),('execute','callable',4),('summarize','callable',1)],status='Modified',subtitle='FIELDS   # _context  # tools')
s+=role_card(1140,310,389,312,'ToolRegistry','class','class',lines=[('search','callable',4),('run','callable',3),('cache','data',1)],subtitle='tools.py · L14')
s+=role_card(576,618,426,210,'execute','callable','method',subtitle='agent.py · L22')
s+=rect(592,696,392,111,'#101922','#344557',6)+text(609,719,'async def execute(self, plan):',12,blue,'font-family="Consolas,monospace"')+text(609,743,'    result = await tools.run(plan)',12,ink,'font-family="Consolas,monospace"')+text(609,767,'    return result',12,green,'font-family="Consolas,monospace"')
s+=rect(67,888,509,37,'#1b222c',line,7)+text(84,912,'Module',11,purple)+text(166,912,'Class',11,amber)+text(238,912,'Callable',11,blue)+text(346,912,'Data',11,green)+text(426,912,'• Git separately',11,muted)
s+=text(1240,913,'STATIC DESIGN PREVIEW • V4',10,muted)
svg=wrap(s);(P/'V4_UML_CONCEPT.svg').write_text(svg);cairosvg.svg2png(bytestring=svg.encode(),write_to=str(P/'V4_UML_CONCEPT.png'))
# Static Sankey visual with geometry-proportional source evidence samples
s=chrome('Flow')
s+=text(70,165,'RELATIONSHIP FLOW',12,blue,'font-weight="bold" letter-spacing="2"')+text(70,206,'Agent.execute',29,ink,'font-weight="bold"')+text(70,231,'Ribbon width represents static source references — not runtime throughput or performance.',13,muted)
for i,(count,label) in enumerate([(23,'Incoming static callsites · 22% of view'),(17,'Outgoing static callsites · 16% of view'),(105,'All static callsites in this graph')]):
 x=70+i*486;s+=rect(x,265,465,70,'#1b222c',line,9)+text(x+22,310,count,31,ink,'font-weight="bold"')+text(x+93,305,label,12,muted)
s+=rect(70,362,1462,498,'#151c25',line,13)
for x,l in [(119,'CALLERS / USERS'),(699,'FOCUSED CONSTRUCT'),(1195,'DEPENDENCIES / USES')]:s+=text(x,407,l,12,muted,'font-weight="bold" letter-spacing="1.2"')
s+='''<g>'''
# bars and proportional filled ribbon polygons, not transitive paths
center_x,center_w,center_y,center_h=700,194,472,288
s+=rect(center_x,center_y,center_w,center_h,'#202a37',blue,12,2)+text(747,594,'execute()',22,ink,'font-weight="bold"')+text(747,623,'METHOD',12,muted)
left=[('api.handle_request',7,500),('pipeline.run',12,625),('plan()',4,758)]
right=[('ToolRegistry.run',6,496),('search_tools()',7,620),('write_log()',4,754)]
unit=12
port_in=478;port_out=478
for dir,items in [('in',left),('out',right)]:
 for label,qty,y in items:
  thick=qty*unit;x=119 if dir=='in' else 1195;bw=260
  s+=rect(x,y-24,bw,49,'#25303b',blue if dir=='in' else green,7)+text(x+14,y+4,label,13,ink,'font-family="Consolas,monospace"')+text(x+bw-33,y+4,str(qty),13,muted)
  x0=379 if dir=='in' else center_x+center_w;x1=center_x if dir=='in' else 1195
  y0=y if dir=='in' else port_out+thick/2;y1=port_in+thick/2 if dir=='in' else y
  cy=(x1-x0)*.43;h=thick/2
  d=f'M{x0},{y0-h} C{x0+cy},{y0-h} {x1-cy},{y1-h} {x1},{y1-h} L{x1},{y1+h} C{x1-cy},{y1+h} {x0+cy},{y0+h} {x0},{y0+h} Z'
  s+=f'<path d="{d}" fill="url(#r{dir})"/>'
  if dir=='in':port_in+=thick
  else:port_out+=thick
s+='</g>'
s+=text(72,911,'Incoming and outgoing are independent; this is a one-hop static reference view.',12,muted)
s+=text(1240,913,'STATIC DESIGN PREVIEW • V4',10,muted)
svg=wrap(s);(P/'V4_SANKEY_CONCEPT.svg').write_text(svg);cairosvg.svg2png(bytestring=svg.encode(),write_to=str(P/'V4_SANKEY_CONCEPT.png'))
print('V4 concept PNGs rendered')
