import { execSync } from 'child_process';
import fs from 'fs';

try {
	// Get the latest git tags to find the range
	// If no tags exist, it will fallback to fetching all commits
	let commitRange = '';
	try {
		const tags = execSync('git tag --sort=-v:refname', { encoding: 'utf8' })
			.trim()
			.split('\n');
		if (tags.length > 0 && tags[0] !== '') {
			const latestTag = tags[0];
			commitRange = `${latestTag}..HEAD`;
		}
	} catch (e) {
		// No tags found, we will just grab the recent history
		console.log('No git tags found. Fetching recent commit history instead.');
	}

	// Format: "Commit message (abc1234)"
	// %s = subject, %h = abbreviated commit hash
	const gitCmd = commitRange
		? `git log ${commitRange} --pretty=format:"* %s (%h)"`
		: `git log -n 20 --pretty=format:"* %s (%h)"`; // Default to last 20 if no tag

	const commits = execSync(gitCmd, { encoding: 'utf8' }).trim();

	if (!commits) {
		console.log('No new commits found since last tag.');
		process.exit(0);
	}

	const changelogContent = `## Changelog - ${new Date().toLocaleDateString()}\n\n${commits}\n`;

	// Write to CHANGELOG.md
	fs.writeFileSync('CHANGELOG.md', changelogContent, 'utf8');
	console.log('✅ CHANGELOG.md has been generated successfully!');
} catch (error) {
	console.error('❌ Error generating changelog:', error.message);
	process.exit(1);
}
