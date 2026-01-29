/**
 * Build script for pdfme browser bundle
 * Creates a single IIFE bundle from @pdfme/generator, @pdfme/common, and @pdfme/schemas
 */

const esbuild = require('esbuild');
const path = require('path');

async function build() {
  try {
    const result = await esbuild.build({
      entryPoints: [path.join(__dirname, 'pdfme-entry.js')],
      bundle: true,
      outfile: path.join(__dirname, '../lib/pdfme.bundle.min.js'),
      format: 'iife',
      globalName: 'pdfme',
      minify: true,
      platform: 'browser',
      target: ['chrome100', 'firefox100', 'safari15'],
      define: {
        'process.env.NODE_ENV': '"production"'
      },
      // Handle node built-ins that might be referenced
      external: [],
      // Log build info
      metafile: true,
      logLevel: 'info'
    });

    // Output bundle size info
    const outputs = result.metafile.outputs;
    for (const [file, info] of Object.entries(outputs)) {
      const sizeKB = (info.bytes / 1024).toFixed(2);
      console.log(`\nBundle created: ${file}`);
      console.log(`Size: ${sizeKB} KB`);
    }

    console.log('\nBuild successful!');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();
