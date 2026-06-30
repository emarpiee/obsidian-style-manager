import fs from 'fs';
import path from 'path';

const README_PATH = 'README.md';
const OUTPUT_PATH = 'README.view.md';
const CONTENT_TS_PATH = 'src/ui/views/ReadmeContent.ts';

function escapeTemplateLiteral(str) {
	// Escape backticks and dollar signs for TS template literals
	return str.replace(/`/g, '\\`').replace(/\$/g, '\\$');
}

function convertImgToLink(content) {
	return content.replace(/<img\s+([^>]+)>/gi, (match, attrs) => {
		const srcMatch = attrs.match(/src=["']([^"']*)["']/i);
		const altMatch = attrs.match(/alt=["']([^"']*)["']/i);
		const src = srcMatch ? srcMatch[1] : '';
		const alt = altMatch ? altMatch[1] : 'image';
		return src ? `[${alt}](${src})` : match;
	});
}

try {
	const content = fs.readFileSync(README_PATH, 'utf8');
	const processedContent = convertImgToLink(content);
	const escapedContent = escapeTemplateLiteral(processedContent);

	// Write to README.view.md
	fs.writeFileSync(OUTPUT_PATH, escapedContent);
	// console.log(`Successfully created ${OUTPUT_PATH}`);

	// Also update the actual TypeScript file
	const tsContent = `export const README_CONTENT = \`${escapedContent}\`;\n`;
	fs.writeFileSync(CONTENT_TS_PATH, tsContent);
	// console.log(`Successfully updated ${CONTENT_TS_PATH}`);

	// Delete the temporary view file after success
	fs.unlinkSync(OUTPUT_PATH);
	// console.log(`Deleted temporary file ${OUTPUT_PATH}`);
} catch (error) {
	console.error('Error processing README:', error);
	process.exit(1);
}
