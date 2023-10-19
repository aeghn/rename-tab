let tab_list = new Map();
let regexRules = undefined;

// create "Rename Tab" context menu item
browser.menus.create(
	{
		id: "tab-name",
		title: "Rename Tab",
		contexts: ["tab"],
	},
	console.info('"Rename Tab" menu item successfully created.')
);

// notify tab to pop up renaming menu
function rename(_info, tab) {
	// switch to tab
	browser.tabs.update(tab.id, { active: true });

	// notify tab to prompt user
	browser.tabs.sendMessage(tab.id, { action: "rename" }).then((response) => {
		// user pressed cancel button; do nothing
		if (response == undefined) return;

		// if rename field is empty remove from map
		if (response.title == undefined) {
			tab_list.delete(tab.id + "");
			updateMap();
			return;
		}
		// save new and default tab name
		tab_list.set(tab.id + "", {
			title: response.title,
			default: response.default,
		});
		updateMap();
	});
}

// send tab's info to content script when tab is
// refreshed or is finished loading
async function update_on_refresh(_request, sender, _sendResponse) {
	if (_request.type === "tabRenameUpdateRegexConfig") {
		asyncSetRegexRules();	
	}
	if (!tab_list.has(sender.tab.id + "")) return;
	let map = tab_list.get(sender.tab.id + "");
	let custom_title = map.title;

	// set default title to refreshed page's initial title
	map.default = sender.tab.title;
	updateMap();

	// notify tab of these changes
	browser.tabs.sendMessage(sender.tab.id, {
		action: "update",
		title: custom_title,
		default: map.default,
	});
}

// sync tab information on extension reload
async function on_reload() {
	await loadMap();
	// send stored information to each saved tab
	tab_list.forEach((value, key) => {
		let tab_id = parseInt(key);
		browser.tabs.sendMessage(tab_id, {
			action: "update",
			title: value.title,
			default: value.default,
		});
	});
}

// remove closed tab from the list & storage
function close(tab_id, _info) {
	if (!tab_list.has(tab_id + "")) return;
	tab_list.delete(tab_id + "");
	updateMap();
}

// update the title according to the hashmap
// when title changes
function titleChanged(tab_id, changed, tab) {
	if (tab.status !== "complete") {
		return;
	}

	if (!tab_list.has(tab_id + "")) {
		updateTitleByRegex(tab)
		return
	}
	if (changed.title == undefined) return;
	let map = tab_list.get(tab_id + "");
	if (changed.title == map.title) return;

	browser.tabs
		.sendMessage(tab_id, {
			action: "update",
			title: map.title,
			default: map.default,
		})
		.catch((_) => {
			/* tab hasn't loaded yet */
		});
}

// update the local map in storage
// so renamed tabs persist
function updateMap() {
	if (tab_list.size >= 1) {
		let obj = Object.fromEntries(tab_list);
		browser.storage.local.set({ map: obj });
	} else {
		// clear storage if map is empty
		browser.storage.local.clear();
	}
}

function updateTitleByRegex(tab) {
	if (regexRules === undefined) {
		console.warn("regexRules is undefined")
		return false
	}
	url = tab.url
	for (let [regex, value] of regexRules) {
		if (url.match(regex)) {
			browser.tabs.sendMessage(tab.id, {
				action: "only_update",
				title: value,
				default: url.title,
			})
			.catch((e) => {
				/* tab hasn't loaded yet */
				console.log("update title error: " + e)
			});
			return true;
		}
	}

	return false;
}

function setRegexRules(data) {
	let _ruleMap = data.regexRules;
	console.log("加载的 regexRules 为: " + JSON.stringify(data.regexRules))

	if (_ruleMap == undefined) {
		regexRules = new Map();
		return;
	}
	regexRules = new Map(Object.entries(_ruleMap));
	console.log("regexRules: " + JSON.stringify(regexRules))
}

async function asyncSetRegexRules() {
	console.log("set regex rules")
	setRegexRules((await browser.storage.local.get()))
}

// load the map from storage
async function loadMap() {
	let map = (await browser.storage.local.get()).map;
	if (map == undefined) {
		tab_list = new Map();
		return;
	}
	tab_list = new Map(Object.entries(map));

	await asyncSetRegexRules();

	console.error("Successfully loaded stored map.");
}

function handleClick() {
	browser.runtime.openOptionsPage();
}

browser.browserAction.onClicked.addListener(handleClick);
browser.menus.onClicked.addListener(rename);
browser.runtime.onMessage.addListener(update_on_refresh);
browser.runtime.onInstalled.addListener(on_reload);
browser.tabs.onRemoved.addListener(close);
browser.tabs.onUpdated.addListener(titleChanged);
document.addEventListener("DOMContentLoaded", asyncSetRegexRules)