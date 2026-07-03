import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const version = pkg.version;

console.log(`Releasing version ${version}...`);

try {
    execFileSync('git', ['add', '.'], { stdio: 'inherit' });
    execFileSync('git', ['commit', '-m', version], { stdio: 'inherit' });
    execFileSync('git', ['tag', version], { stdio: 'inherit' });
    execFileSync('git', ['push'], { stdio: 'inherit' });
    execFileSync('git', ['push', '--tags'], { stdio: 'inherit' });
    
    console.log('Generating changelog...');
    execFileSync('npm', ['run', 'changelog'], { stdio: 'inherit' });
    
    execFileSync('git', ['add', '.'], { stdio: 'inherit' });
    execFileSync('git', ['commit', '-m', 'Added CHANGELOG.md'], { stdio: 'inherit' });
    execFileSync('git', ['push'], { stdio: 'inherit' });
    
    console.log('Release completed successfully!');
} catch (error) {
    console.error('Release failed:', error.message);
    process.exit(1);
}
