import puppeteer from 'puppeteer';
import { execSync } from 'child_process';
import { generateReportHTML } from './report-html-template';

function findChromium(): string {
  // Try to find the Nix-installed chromium first (properly linked against system libs)
  try {
    const path = execSync('which chromium 2>/dev/null || which chromium-browser 2>/dev/null', { encoding: 'utf8' }).trim();
    if (path) return path;
  } catch (_) {}

  // Fall back to Puppeteer's own bundled binary
  return puppeteer.executablePath();
}

export async function generatePDFBuffer(
  reportData: any,
  clientData: any,
  structure: any
): Promise<Buffer> {
  const html = generateReportHTML(reportData, clientData, structure);

  const executablePath = findChromium();
  console.log('[pdf] Launching Chromium at:', executablePath);

  let browser: any;
  try {
    browser = await puppeteer.launch({
      headless: 'new' as any,
      executablePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });

    return Buffer.from(pdf);
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
