import { execSync } from 'child_process';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const version = pkg.version;

console.log(`Releasing version ${version}...`);

try {
    execSync('git add .', { stdio: 'inherit' });
    execSync(`git commit -m "${version}"`, { stdio: 'inherit' });
    execSync(`git tag ${version}`, { stdio: 'inherit' });
    execSync('git push', { stdio: 'inherit' });
    execSync('git push --tags', { stdio: 'inherit' });
    
    console.log('Generating changelog...');
    execSync('npm run changelog', { stdio: 'inherit' });
    
    execSync('git add .', { stdio: 'inherit' });
    execSync('git commit -m "Added CHANGELOG.md"', { stdio: 'inherit' });
    execSync('git push', { stdio: 'inherit' });
    
    console.log('Release completed successfully!');
} catch (error) {
    console.error('Release failed:', error.message);
    process.exit(1);
}
