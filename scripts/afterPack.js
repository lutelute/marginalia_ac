const { execSync } = require('child_process');
const path = require('path');

exports.default = async function (context) {
  const appDir = context.appOutDir;
  console.log(`afterPack: removing extended attributes from ${appDir}`);
  try {
    execSync(`xattr -cr "${appDir}"`, { stdio: 'inherit' });
  } catch (e) {
    console.warn('afterPack: xattr -cr failed (non-fatal):', e.message);
  }
};
