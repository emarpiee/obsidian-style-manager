import { execSync } from 'child_process';
import fs from 'fs';

try {
	let commitRange = '';
	let latestTag = '';

	// 1. Get the latest git tag
	try {
		const tags = execSync('git tag --sort=-v:refname', { encoding: 'utf8' })
			.trim()
			.split('\n');
		if (tags.length > 0 && tags[0] !== '') {
			latestTag = tags[0];
			commitRange = `${latestTag}..HEAD`;
		}
	} catch (e) {
		console.log('No git tags found. Fetching recent commit history instead.');
	}

	// Format: "Commit message (abc1234)"
	const formatStr = '--pretty=format:"* %s (%h)"';
	let commits = '';

	if (commitRange) {
		// Try to get commits between the latest tag and HEAD
		commits = execSync(`git log ${commitRange} ${formatStr}`, {
			encoding: 'utf8',
		}).trim();

		// 💡 FIX: If no commits exist AFTER the tag, fetch the commits LEADING UP to the tag instead
		if (!commits) {
			console.log(
				`No new commits since ${latestTag}. Fetching history included in ${latestTag}...`
			);
			commits = execSync(`git log ${latestTag} -n 20 ${formatStr}`, {
				encoding: 'utf8',
			}).trim();
		}
	} else {
		// Default fallback if no tags exist at all
		commits = execSync(`git log -n 20 ${formatStr}`, {
			encoding: 'utf8',
		}).trim();
	}

	if (!commits) {
		console.log('No commit history found.');
		process.exit(0);
	}

	const titleHeader = latestTag ? `Changelog for ${latestTag}` : 'Changelog';
	const changelogContent = `## ${titleHeader} (${new Date().toLocaleDateString()})\n\n${commits}\n`;

	// Write to CHANGELOG.md
	fs.writeFileSync('CHANGELOG.md', changelogContent, 'utf8');
	console.log('✅ CHANGELOG.md has been generated successfully!');
} catch (error) {
	console.error('❌ Error generating changelog:', error.message);
	process.exit(1);
}
