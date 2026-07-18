const fs = require('fs');
const https = require('https');
const path = require('path');

const fontUrl = 'https://raw.githubusercontent.com/googlefonts/noto-fonts/main/unhinted/ttf/NotoSansBengali/NotoSansBengali-Regular.ttf';
const targetPath = path.join(__dirname, 'src', 'lib', 'pdfFont.ts');

https.get(fontUrl, (res) => {
  const data = [];
  res.on('data', (chunk) => data.push(chunk));
  res.on('end', () => {
    const buffer = Buffer.concat(data);
    const base64 = buffer.toString('base64');
    
    const content = `import jsPDF from 'jspdf';

export const NotoSansBengaliBase64 = '${base64}';

export function addCustomFont(doc: jsPDF) {
  doc.addFileToVFS('NotoSansBengali-Regular.ttf', NotoSansBengaliBase64);
  doc.addFont('NotoSansBengali-Regular.ttf', 'NotoSansBengali', 'normal');
  doc.addFont('NotoSansBengali-Regular.ttf', 'NotoSansBengali', 'bold');
}
`;

    fs.writeFileSync(targetPath, content);
    console.log('Font successfully downloaded and converted to pdfFont.ts! Size:', buffer.length);
  });
}).on('error', (err) => {
  console.error('Error downloading font:', err.message);
});
