const rulesText = document.getElementById("ruleText");
const saveAllButton = document.getElementById("saveAll");

function saveConfig() {
  console.log("save config: " + rulesText.value);
  rules = JSON.parse(rulesText.value);
  browser.storage.local.set({ regexRules: rules });
  browser.runtime.sendMessage({ type: 'tabRenameUpdateRegexConfig'});
}

async function restoreConfig() {
  options = await browser.storage.local.get();

  config = JSON.stringify(options.regexRules);
  if (config === undefined) {
    config = ""
  }
  console.log("load config: " + config);
  rulesText.value = config;
}

document.addEventListener('DOMContentLoaded', restoreConfig);
saveAllButton.addEventListener("click", saveConfig)

// {".*baidu.*": "bd"}