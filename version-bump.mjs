import { readFileSync, writeFileSync } from 'fs';
import { URL } from 'url';

let manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
let pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const { minAppVersion } = manifest;

manifest.version = pkg.version;
manifest.description = pkg.description;
writeFileSync('manifest.json', JSON.stringify(manifest, null, '\t') + '\n');

// update versions.json with target version and minAppVersion from manifest.json
let versions = JSON.parse(readFileSync('versions.json', 'utf8'));
versions[pkg.version] = minAppVersion;
writeFileSync('versions.json', JSON.stringify(versions, null, '\t') + '\n');
