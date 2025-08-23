'use strict';

/* Import scripts if this browser supports importScripts() */
if (typeof importScripts === 'function') {
	importScripts('utils/common-utils.js');
	importScripts('utils/history-utils.js');
	importScripts('utils/tutorial-utils.js');
}

const browserObj = getBrowserObject();
browserObj.runtime.onStartup.addListener(onStartup);
browserObj.runtime.onInstalled.addListener(onInstalled);
browserObj.runtime.onMessage.addListener(onMessageReceive);
browserObj.action.onClicked.addListener(onExtensionIconClick);
browserObj.contextMenus.onClicked.addListener(onContextMenuClick);

/**
 * Handler executed when browser launched.
 */
async function onStartup() {

	const now = Date.now();

	/* Delete old parsing history item */
	await deleteOldHistory(now);

	/* If a new version is installed, open the changelog page */
	if (await isNewVersionInstalled()) {
		await openExtensionsPage('changelog.html');
		openUnfinishedTutorial();
	}

}

/**
 * Handler executed when extension updated.
 * @param {Object.<string, *>} details - Install details
 */
async function onInstalled(details) {

	// /* Clear storate data */
	// await browserObj.storage.local.clear();
	// await browserObj.storage.sync.clear();

	/* Add context menus shown when the extension icon clicked */
	browserObj.contextMenus.create({
		id: 'parseVideo',
		title: browserObj.i18n.getMessage('contextMenu_parseVideo'),
		contexts: ['action']
	});
	browserObj.contextMenus.create({
		id: 'videoParsingHistory',
		title: browserObj.i18n.getMessage('contextMenu_videoParsingHistory'),
		contexts: ['action']
	});

	switch(details.reason) {

		/* On extension install */
		case 'install':
			await openExtensionsPage('tutorial.html');
			break;

		/* On extension update */
		case 'update':
			if (await isNewVersionInstalled()) {
				await openExtensionsPage('changelog.html');
				openUnfinishedTutorial();
			}
			break;

		default:
			/* DO NOTHING */
			break;

	}

}

/**
 * Handler executed when message receied.
 * @param {Object.<string, *>} request - Request
 * @param {*} sender - Sender
 * @param {Function} sendResponse - Send response function
 */
async function onMessageReceive(request, sender, sendResponse) {

	switch (request.action) {

		/* Open extension page */
		case 'openExtensionPage':
			await openExtensionsPage(request.path);
			sendResponse({status: 'successful'});
			break;

		/* Other message */
		default:
			sendResponse({status: 'error'});
			throw new Error('Unknown message received');

	}

}

/**
 * Handler executed when extension icon clicked.
 * @param {Object.<string, *>} tab - Tab data
 */
async function onExtensionIconClick(tab) {

	/* Parse the video */
	try {
		await browserObj.tabs.sendMessage(tab.id, {action: 'requestVideoParsing'});
	} catch (error) {
		debug.log(error);
	}

}

/**
 * Handler executed when context menu clicked.
 * @param {OnClickData} info - Info
 * @param {Tab} tab - Tab
 */
async function onContextMenuClick(info, tab) {

	switch (info.menuItemId) {

		/* Parse the video */
		case 'parseVideo':
			try {
				await browserObj.tabs.sendMessage(tab.id, {action: 'requestVideoParsing'});
			} catch (error) {
				debug.log(error);
			}
			break;

		/* Open the video parsing history page */
		case 'videoParsingHistory':
			await openExtensionsPage('history.html');
			break;

		default:
			throw new Error('Unknown context menu');

	}

}

/**
 * Whether a new version has been installed or not.
 * @returns {Promise.<Boolean>} True: A new version is installed, False: A new version is not installed
 */
async function isNewVersionInstalled() {

	/* Get the version saved at the previous browser startup and current version */
	const lastExtensionVersion = await loadFromStorage(storageKeys.LAST_EXTENSION_VERSION, false);
	const currentExtensionVersion = getVersionText();

	/* Update the saved version */
	await saveToStorage(storageKeys.LAST_EXTENSION_VERSION, currentExtensionVersion);

	/* If the versions are different, a new version is installed */
	if (lastExtensionVersion !== currentExtensionVersion) {
		return true;
	} else {
		return false;
	}

}