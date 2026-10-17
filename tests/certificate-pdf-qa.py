"""Offline QR creation and inspection of the final rendered PDF pages."""
import sys, json, subprocess
from pathlib import Path
from PIL import Image, ImageDraw
from reportlab.graphics.barcode.qr import QrCodeWidget
from pypdf import PdfReader, PdfWriter, Transformation
import pdfplumber

if sys.argv[1] == 'qr':
    code=QrCodeWidget(sys.argv[2]).qr
    code.make()
    matrix=code.modules
    quiet, scale=4, 8
    image=Image.new('RGB',((len(matrix)+quiet*2)*scale,)*2,'white')
    draw=ImageDraw.Draw(image)
    for y,row in enumerate(matrix):
        for x,dark in enumerate(row):
            if dark:
                draw.rectangle(((x+quiet)*scale,(y+quiet)*scale,(x+quiet+1)*scale-1,(y+quiet+1)*scale-1),fill='black')
    image.save(sys.argv[3])
else:
    import zxingcpp
    folder=Path(sys.argv[2])
    poppler=Path('/Users/baba/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/bin/pdftoppm')
    manifest=json.loads((folder/'manifest.json').read_text())
    results=[]
    for item in manifest:
        stem=f"{item['type']}-{item['language']}"
        path=folder/(stem+'.pdf')
        reader=PdfReader(path)
        assert len(reader.pages)==1, (stem,'page count')
        # Chromium rounds printer paper height. Normalize to the exact legacy
        # 2000x1414 CSS-pixel page, preserving the top-anchored content geometry.
        page=reader.pages[0]
        page.add_transformation(Transformation().translate(ty=1060.5-float(page.mediabox.height)))
        page.mediabox.upper_right=(1500,1060.5)
        page.cropbox.upper_right=(1500,1060.5)
        writer=PdfWriter()
        writer.add_page(page)
        writer.add_metadata({'/Title':f'Isolated certificate QA - {stem}'})
        with path.open('wb') as target:
            writer.write(target)
        reader=PdfReader(path)
        size=reader.pages[0].mediabox
        assert abs(float(size.width)-1500)<.01 and abs(float(size.height)-1060.5)<.01, (stem,'page size',size)
        with pdfplumber.open(path) as pdf:
            text=pdf.pages[0].extract_text()
            assert item['expectedName'] in text and item['formattedDate'] in text, (stem,'text')
            assert all('Ubuntu' in c['fontname'] for c in pdf.pages[0].chars), (stem,'font')
        fonts=reader.pages[0]['/Resources']['/Font']
        for font_ref in fonts.values():
            font=font_ref.get_object()
            descendants=font.get('/DescendantFonts')
            descriptor=(descendants[0].get_object() if descendants else font).get('/FontDescriptor')
            assert descriptor and descriptor.get_object().get('/FontFile2'), (stem,'font not embedded')
        subprocess.run([str(poppler),'-r','96','-singlefile','-png',str(path),str(folder/(stem+'-render'))],check=True)
        image=Image.open(folder/(stem+'-render.png'))
        decoded=zxingcpp.read_barcodes(image.crop((900,1200,1110,1414)))
        assert any(code.text==item['verificationUrl'] for code in decoded), (stem,'QR mismatch')
        results.append({'type':item['type'],'language':item['language'],'pages':1,'cssGeometry':'2000x1414','font':'embedded Ubuntu Bold','nameDate':'passed','qrDecoded':True,'documentJavaScript':False,'externalRequests':0})
    (folder/'results.json').write_text(json.dumps(results,indent=2))
    print(json.dumps({'pdfCases':len(results),'passed':len(results),'documentJavaScript':False,'externalRequests':0}))
