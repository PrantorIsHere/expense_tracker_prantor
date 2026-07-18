$ErrorActionPreference = "Stop"
$Uri = "https://raw.githubusercontent.com/googlefonts/noto-fonts/main/unhinted/ttf/NotoSansBengali/NotoSansBengali-Regular.ttf"
Write-Host "Downloading font..."
$response = Invoke-WebRequest -Uri $Uri -UseBasicParsing
$bytes = $response.Content
$base64 = [Convert]::ToBase64String($bytes)
Write-Host "Downloaded $($bytes.Length) bytes."

$content = "import jsPDF from 'jspdf';

export const NotoSansBengaliBase64 = '$base64';

export function addCustomFont(doc: jsPDF) {
  doc.addFileToVFS('NotoSansBengali-Regular.ttf', NotoSansBengaliBase64);
  doc.addFont('NotoSansBengali-Regular.ttf', 'NotoSansBengali', 'normal');
  doc.addFont('NotoSansBengali-Regular.ttf', 'NotoSansBengali', 'bold');
}
"
$path = Join-Path -Path $PSScriptRoot -ChildPath "src\lib\pdfFont.ts"
Set-Content -Path $path -Value $content -Encoding UTF8
Write-Host "pdfFont.ts created successfully!"
