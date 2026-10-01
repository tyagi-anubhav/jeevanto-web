# Sets the site's screenshot (left) beside the design's (right), each labelled, for proof 4.
import sys, glob, os
from PIL import Image, ImageDraw
d = sys.argv[1] if len(sys.argv) > 1 else 'proofs/screens'
for site in sorted(glob.glob(os.path.join(d, '*-site.png'))):
    design = site.replace('-site.png', '-design.png')
    if not os.path.exists(design): continue
    a, b = Image.open(site).convert('RGB'), Image.open(design).convert('RGB')
    h = max(a.height, b.height) + 28
    out = Image.new('RGB', (a.width + b.width + 24, h), (128, 128, 128))
    out.paste(a, (0, 28)); out.paste(b, (a.width + 24, 28))
    dr = ImageDraw.Draw(out); dr.text((8, 8), 'SITE (jeevanto-web)', fill=(255, 255, 255)); dr.text((a.width + 32, 8), 'DESIGN (Site v10, coming soon)', fill=(255, 255, 255))
    out.save(site.replace('-site.png', '-side.png'))
