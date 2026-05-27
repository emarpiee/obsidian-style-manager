import { execSync } from 'child_process';
import fs from 'fs';

try {
	let latestTag = '';

	// 1. Get the latest git tag safely
	try {
		const tags = execSync('git tag --sort=-v:refname', { encoding: 'utf8' })
			.trim()
			.split('\n')
			.filter(Boolean); // Removes empty strings if no tags exist

		if (tags.length > 0) {
			latestTag = tags[0];
		}
	} catch (e) {
		console.log(
			'⚠️ Git command failed or not a git repository. Proceeding with caution...'
		);
	}

	// Format: "Commit message (abc1234)"
	const formatStr = '--pretty=format:"* %s (%h)"';
	let commits = '';
	let titleHeader = 'Changelog';

	if (latestTag) {
		// Try to get commits between the latest tag and HEAD (unreleased work)
		commits = execSync(`git log ${latestTag}..HEAD ${formatStr}`, {
			encoding: 'utf8',
		}).trim();

		if (!commits) {
			// HEAD is exactly AT the latest tag. Log the history leading UP TO this tag.
			console.log(
				`📍 HEAD is at ${latestTag}. Fetching history included in this release...`
			);
			commits = execSync(`git log ${latestTag} -n 20 ${formatStr}`, {
				encoding: 'utf8',
			}).trim();
			titleHeader = `Changelog for ${latestTag}`;
		} else {
			// There are new commits AFTER the latest tag
			console.log(
				`🚀 Found new commits since ${latestTag}. Generating upcoming changelog...`
			);
			titleHeader = `Changelog (Upcoming Release since ${latestTag})`;
		}
	} else {
		// Default fallback if no tags exist at all in the repo
		console.log('No git tags found. Fetching recent commit history instead.');
		commits = execSync(`git log -n 20 ${formatStr}`, {
			encoding: 'utf8',
		}).trim();
		titleHeader = 'Changelog (Recent History)';
	}

	// 2. Final validation check
	if (!commits) {
		console.log('❌ No commit history found.');
		process.exit(0);
	}

	const changelogContent = `## ${titleHeader} (${new Date().toLocaleDateString()})\n\n${commits}\n`;

	// 3. Write to CHANGELOG.md
	fs.writeFileSync('CHANGELOG.md', changelogContent, 'utf8');
	console.log('✅ CHANGELOG.md has been generated successfully!');
} catch (error) {
	console.error('❌ Error generating changelog:', error.message);
	process.exit(1);
}
