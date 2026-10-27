from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
import subprocess,math
root=Path(__file__).resolve().parent.parent
font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
def f(n):return ImageFont.truetype(font,n)
# A deterministic, clearly illustrative product walkthrough; no AI imagery or real customer data.
out=subprocess.Popen(['ffmpeg','-y','-f','rawvideo','-vcodec','rawvideo','-pix_fmt','rgb24','-s','960x540','-r','20','-i','-','-f','lavfi','-i','sine=frequency=220:sample_rate=48000:duration=15','-filter:a','volume=0.03','-c:v','libvpx','-b:v','350k','-c:a','libopus','-b:a','32k','-t','15',str(root/'public/sample.webm')],stdin=subprocess.PIPE,stderr=subprocess.DEVNULL)
for n in range(300):
 t=n/20;im=Image.new('RGB',(960,540),'#f7f6f2');d=ImageDraw.Draw(im)
 d.rectangle((0,0,960,54),fill='#253c2d');d.text((26,16),'ScreenNote / illustrative walkthrough',font=f(17),fill='white')
 step=min(2,int(t/5));titles=['Show the detail.','Pin the feedback.','Keep work moving.']
 d.text((34,80),titles[step],font=f(29),fill='#253c2d')
 d.rounded_rectangle((34,132,590,448),radius=14,fill='white',outline='#dedfd7',width=2)
 d.text((60,156),'CHECKOUT PREVIEW',font=f(13),fill='#6c716a');d.text((60,195),'One simple next step.',font=f(24),fill='#292c29')
 for y,w in [(244,280),(270,350),(296,220)]:d.rounded_rectangle((60,y,60+w,y+10),radius=5,fill='#eeede7')
 color='#c44726' if step==2 else '#b8b9ae';d.rounded_rectangle((60,348,315,400),radius=8,fill=color);d.text((95,363),'Continue to payment',font=f(16),fill='white' if step==2 else '#3c433a')
 if step>=1:
  d.rounded_rectangle((620,145,923,333),radius=12,fill='white',outline='#dedfd7',width=2);d.text((640,167),'0:05   Alex',font=f(15),fill='#c44726');d.text((640,202),'Could this button',font=f(18),fill='#292c29');d.text((640,229),'be clearer?',font=f(18),fill='#292c29');d.text((640,282),'Sam: Increase contrast.',font=f(14),fill='#6c716a')
 if step==2:
  d.rounded_rectangle((620,352,923,406),radius=8,fill='#e2eee4');d.text((640,370),'Changes ready for review',font=f(16),fill='#285538')
 x=170+70*math.sin(t/2);y=370+25*math.cos(t/2);d.polygon([(x,y),(x+3,y+22),(x+9,y+16),(x+15,y+27),(x+20,y+24),(x+14,y+14),(x+23,y+12)],fill='#253c2d',outline='white')
 d.rounded_rectangle((34,482,926,488),radius=3,fill='#dedfd7');d.rounded_rectangle((34,482,34+max(3,892*t/15),488),radius=3,fill='#c44726');d.text((34,507),'EXAMPLE ONLY  /  No customer data',font=f(11),fill='#6c716a')
 out.stdin.write(im.tobytes())
out.stdin.close();assert out.wait()==0
