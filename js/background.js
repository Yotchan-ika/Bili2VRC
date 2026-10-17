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
browserObj.runtime.onMessage.addListener((request, sender, sendResponse) => {
	onMessageReceive(request, sender, sendResponse).catch(error => debug.error(error));
	return true;
});
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

	/* Add context menus shown when the extension icon clicked */
	await browserObj.contextMenus.removeAll();
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

		/* Parse through a built-in channel outside the content script CORS context. */
		case 'fetchVideoParsingData':
			try {
				const response = await fetchVideoParsingData(request.channel, request.bvid, request.p);
				sendResponse({status: 'successful', response: response});
			} catch (error) {
				debug.error('Video parsing failed:', error);
				sendResponse({status: 'error', source: 'background', message: error.message});
			}
			break;

		case 'validateVideoURL':
			try {
				const url = await fetchVerifiedVideoURL(normalizeParsedVideoURL(request.url));
				sendResponse({status: 'successful', url: url});
			} catch (error) {
				sendResponse({status: 'error', message: error.message});
			}
			break;

		/* Other message */
		default:
			sendResponse({status: 'error', source: 'background', message: `Unknown background action: ${request.action}`});
			throw new Error('Unknown message received');

	}

}

/**
 * Parse and validate a video through one fixed provider.
 * @param {string} channel - Channel identifier
 * @param {string} bvid - Video identifier
 * @param {number} p - Video page number
 * @returns {Promise.<Object.<string, *>>} Parsed video data
 */
async function fetchVideoParsingData(channel, bvid, p) {

	const requestURL = getVideoParsingRequestURL(channel, bvid, p);
	if (channel === parsingChannels.LOCAL) {
		return await fetchLocalVideoParsingData(requestURL, bvid, p);
	}
	const data = await fetchParsingJSON(requestURL, 'Video parsing API');
	if (data === null || typeof data.code !== 'number') {
		throw new Error('Video parsing API returned invalid data');
	}
	if (data.code !== 0) {
		debug.error('Video parsing API returned an error:', data.code, data.message);
		return {
			parsedVideoResponseCode: 1,
			parsedVideoResponseMessage: data.message || `Video parsing API returned code ${data.code}`
		};
	}

	return {
		parsedVideoURL: await fetchVerifiedVideoURL(normalizeParsedVideoURL(data.url)),
		parsedVideoQuality: data.quality,
		parsedVideoResponseCode: 0,
		parsedVideoResponseMessage: 'OK'
	};

}

/**
 * Request public playback information directly from Bilibili, without a parser service.
 * @param {URL} infoURL - Validated video metadata request
 * @param {string} bvid - Video identifier
 * @param {number} p - Video page number
 * @returns {Promise.<Object.<string, *>>} Validated CDN result
 */
async function fetchLocalVideoParsingData(infoURL, bvid, p) {

	const info = await fetchParsingJSON(infoURL, 'Bilibili video API');
	if (info?.code !== 0) {
		throw new Error(`Bilibili video API returned code ${info?.code}: ${info?.message || 'Invalid response'}`);
	}
	const pages = Array.isArray(info.data?.pages) ? info.data.pages : [];
	const page = pages.find(item => item.page === p);
	if (!Number.isSafeInteger(page?.cid) || page.cid < 1) {
		throw new Error(`Bilibili video API returned no CID for page ${p}`);
	}

	const playURL = new URL('https://api.bilibili.com/x/player/playurl');
	playURL.search = new URLSearchParams({
		bvid: bvid, cid: page.cid, qn: 80, type: 'mp4', otype: 'json',
		fnver: 0, fnval: 0, platform: 'html5', high_quality: 1, fourk: 1
	}).toString();
	const result = await fetchParsingJSON(playURL, 'Bilibili playback API');
	if (result?.code !== 0) {
		throw new Error(`Bilibili playback API returned code ${result?.code}: ${result?.message || 'Invalid response'}`);
	}
	const data = result.data;
	if (data?.is_preview === true || data?.is_preview === 1) {
		throw new Error('Bilibili returned a preview instead of the full video');
	}
	if (!Array.isArray(data?.durl) || data.durl.length !== 1) {
		throw new Error('Bilibili did not return a single MP4 file (separate audio/video or multiple segments)');
	}

	const video = data.durl[0];
	const candidates = [video?.url, ...(Array.isArray(video?.backup_url) ? video.backup_url : [])];
	let lastError;
	for (const candidate of [...new Set(candidates)].slice(0, 3)) {
		try {
			return {
				parsedVideoURL: await fetchVerifiedVideoURL(normalizeParsedVideoURL(candidate)),
				parsedVideoQuality: data.quality,
				parsedVideoResponseCode: 0,
				parsedVideoResponseMessage: 'OK'
			};
		} catch (error) {
			lastError = error;
		}
	}
	throw new Error(`Bilibili CDN validation failed: ${lastError?.message || 'No MP4 URL'}`);

}

/**
 * Bound both JSON connection and body reading time.
 * @param {URL} url - Request URL
 * @param {string} label - API name for errors
 * @returns {Promise.<Object>} Parsed JSON
 */
async function fetchParsingJSON(url, label) {

	const controller = new AbortController();
	const timeoutID = setTimeout(() => controller.abort(), videoParsingFetchTimeout);
	try {
		const response = await fetch(url, {credentials: 'omit', signal: controller.signal});
		if (response.ok === false) {
			await response.body?.cancel();
			throw new Error(`${label} returned HTTP ${response.status}`);
		}
		return await response.json();
	} finally {
		controller.abort();
		clearTimeout(timeoutID);
	}

}

/**
 * Follow redirects and read only the MP4 header, not the whole video.
 * @param {string} requestURL - Fixed service URL or validated media URL
 * @returns {Promise.<string>} Reachable MP4 URL
 */
async function fetchVerifiedVideoURL(requestURL) {

	const controller = new AbortController();
	const timeoutID = setTimeout(() => controller.abort(), videoParsingFetchTimeout);
	let response;
	let reader;
	try {
		response = await fetch(requestURL, {
			redirect: 'follow',
			credentials: 'omit',
			headers: {Range: 'bytes=0-31'},
			signal: controller.signal
		});
		if (response.ok === false) {
			throw new Error(`Video link returned HTTP ${response.status}`);
		}
		const url = normalizeParsedVideoURL(response.url);
		const contentType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
		if (['video/mp4', 'application/octet-stream'].includes(contentType) === false || !response.body) {
			throw new Error('Parsing channel did not return MP4 media');
		}
		reader = response.body.getReader();
		const header = new Uint8Array(12);
		let offset = 0;
		while (offset < header.length) {
			const {value, done} = await reader.read();
			if (done) {
				throw new Error('Video link returned an incomplete MP4 header');
			}
			const bytes = value.subarray(0, header.length - offset);
			header.set(bytes, offset);
			offset += bytes.length;
		}
		if (String.fromCharCode(...header.subarray(4, 8)) !== 'ftyp') {
			throw new Error('Video link returned invalid MP4 content');
		}
		return url;
	} finally {
		controller.abort();
		clearTimeout(timeoutID);
		if (reader) {
			await reader.cancel().catch(() => {});
		} else if (response?.body) {
			await response.body.cancel().catch(() => {});
		}
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
