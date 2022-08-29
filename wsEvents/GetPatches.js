const { promisify } = require('util');
const { exec } = require('child_process');
const { getPatchList } = require('../utils/PatchListRememberer.js');
// const PatchesParser = require('../utils/PatchesParser.js');
const os = require('os');
const actualExec = promisify(exec);

const rootedPatches = [
  'microg-support',
  'hide-cast-button',
  'music-microg-support'
];

module.exports = async function (message, ws) {
  const patchList = [];
  const getPatches = await actualExec(
    `java -jar ${global.jarNames.cli} -a ${global.jarNames.integrations} -b ${global.jarNames.patchesJar} -l --with-packages --with-versions`
  );
  const patchesText = getPatches.stdout;
  const matches = patchesText.matchAll(
    /:\s+(?<pkg>\S+)\s+(?<name>\S+)\s+(?<description>.+)\t+(?<versions>.+)/g
  );
  const distinctMatches = Array.from(matches).filter(
    (value, i, self) =>
      self.map((x) => x.groups.name).indexOf(value.groups.name) === i
  );

  let hasRoot = true;
  if (os.platform() === 'android') {
    await actualExec('su -c exit').catch((err) => {
      const error = err.stderr || err.stdout;
      if (
        error.includes('No su program found on this device.') ||
        error.includes('Permission denied')
      ) {
        hasRoot = false;
      }
    });
  }

  for (const match of distinctMatches) {
    const { name, description, pkg, versions } = match.groups;
    const isRooted = rootedPatches.includes(name);
    const isCompatible = pkg === global.jarNames.selectedApp;

    const versionsArr = versions.split(', ');
    global.versions = versionsArr.map((i) => i.trim());
    const maxVersion = versionsArr.sort()[versionsArr.length - 1];
    let patchDesc;
    if (name === 'enable-debugging') {
      patchDesc =
        "WARNING: THIS PATCH WILL SLOW DOWN THE APP, PLEASE DON'T ENABLE THIS PATCH UNLESS YOU WANT TO DEBUG THE APP.\n" +
        description.trim();
    }

    if (isCompatible && (!isRooted || hasRoot)) {
      patchList.push({
        name,
        description: patchDesc || description.trim(),
        maxVersion,
        isRooted
      });
    }
  }

  const rememberedPatchList = getPatchList(global.jarNames.selectedApp);

  return ws.send(
    JSON.stringify({
      event: 'patchList',
      patchList,
      rememberedPatchList
    })
  );
};
