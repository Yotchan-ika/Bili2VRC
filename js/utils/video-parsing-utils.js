'use strict';

//	-----------------------------------------------------------
//		Constant
//	-----------------------------------------------------------

//#region Constant

/* API URL */
const detailedVideoInfoEndpoint = 'https://api.bilibili.com/x/web-interface/view';
const videoParsingEndpoint = 'https://api.injahow.cn/bparse/';

/* Video page URL */
const videoPageURLFormat = 'https://www.bilibili.com/video/{bvid}/?p={p}';

/* Reuse expiration of parsed video URL (ms) */
const reuseExpirationTime = 1000 * 60 * 60;

/* Parsing cooldown duration (ms) */
const parsingCooldownTime = 1000 * 5;

/** @type {Object.<number, string>} Video quality texts */
const videoQualityTexts = Object.freeze({
	6: '240P 极速',
	16: '360P 流畅',
	32: '480P 清晰',
	64: '720P 高清',
	74: '720P60 高帧率',
	80: '1080P 高清',
	112: '1080P60 高码率',
	116: '1080P+ 高帧率',
	120: '4K 超清',
	125: 'HDR 真彩色',
	126: '杜比视界',
	127: '8K 超高清'
});

//#endregion

/* Interval ID to update remaining cooldown time */
let popupIntervalID;

//	-----------------------------------------------------------
//		Handler
//	-----------------------------------------------------------

//#region Handler

/**
 * Handler to execute when message received.
 * @param {Object.<string, *>} request - Request
 * @param {*} sender - Sender
 * @param {Function} sendResponse - Send response function
 */
async function onMessageReceive(request, sender, sendResponse) {

	switch (request.action) {

		/* Parse the video */
		case 'requestVideoParsing':
			const parsingResult = await RequestVideoParsing(window.location.href);
			if (parsingResult === true) {
				sendResponse({status: 'successful'});
			} else {
				sendResponse({status: 'failed'});
			}
			break;

		/* Other message */
		default:
			sendResponse({status: 'error'});
			throw new Error('Unknown message received');

	}

}

//#endregion

//	-----------------------------------------------------------
//		Video Parsing
//	-----------------------------------------------------------

//#region Video Parsing

/**
 * Request video parsing.
 * @param {string} videoPageURL - Video page's URL
 * @returns {Promise.<boolean>} True: successfull, False: failed
 */
async function RequestVideoParsing(videoPageURL) {

	try {

		const now = Date.now();

		/* If parsing is ongoing, skip the parsing */
		const parsingStatus = await loadFromStorage(storageKeys.PARSING_STATUS);
		if (parsingStatus !== parsingStatuses.PARSABLE) {
			debug.log(`Video cannot be parsed because the current status is "${parsingStatus}".`);
			return false;
		}

		/* Get video ID (bvid) and video page number (p) */
		let videoInfo;
		try {
			videoInfo = getBvidAndPageNoFromURL(videoPageURL);
		} catch (error) {
			await showInvalidURLPopup();
			return false;
		}

		/* Search parsing history */
		const historyItem = await getHistoryItem(videoInfo.bvid, videoInfo.p, now);
		if (
			historyItem &&
			historyItem.lastParsingTimestamp > now - reuseExpirationTime
		) {
			await updateLastUsedTimestamp(historyItem.bvid, historyItem.p, now);
			try {
				await navigator.clipboard.writeText(historyItem.parsedVideoUrl);
				await showClipboardWriteSuccessfulPopup(historyItem.parsedVideoQuality, historyItem.title);
				return true;
			} catch (error) {
				await showClipboardWriteFailedPopup(error.stack);
				return false;
			}
		}

		/* If actions are performed too frequently, skip the parsing */
		const lastParsingTimestamp = await loadFromStorage(storageKeys.LAST_PARSING_TIMESTAMP);
		if (now - lastParsingTimestamp < parsingCooldownTime) {
			showTooFrequentParsingRequest(lastParsingTimestamp);
			return false;
		}

		/* Parse the video */
		const parsingResult = await parseVideo(videoInfo.bvid, videoInfo.p);

		return parsingResult;

	} catch (error) {

		/* Display unknown error popup */
		await showUnknownErrorPopup(error.stack);

		return false;

	}

}

/**
 * Parse the current tab's video.
 * @param {string} bvid - Video ID (bvid)
 * @param {number} p - Video page number (p)
 * @returns {Promise.<boolean>} True: successful, False: failed
 */
async function parseVideo(bvid, p) {

	debug.log('Parsing the video...');

	try {

		/* Display processing popup */
		await showProcessingPopup();
		await saveToStorage(storageKeys.PARSING_STATUS, parsingStatuses.PARSING);

		/* Get detailed video info */
		let videoInfo;
		try {
			videoInfo = await getDetailedVideoInfo(bvid, p);
			videoInfo.url = getVideoPageURL(bvid, p);
		} catch (error) {
			debug.log(error);
			videoInfo.bvid = bvid;
			videoInfo.p = p;
		}

		/* Retain current timestamp */
		const now = Date.now();
		const formattedNow = new Date(now).toString();

		/* Send parsing request to Web API */
		let parsedVideoData;
		try {
			parsedVideoData = await getParsedVideoData(bvid, p);
			videoInfo.historyID = now;
			videoInfo.lastParsingTimestamp = now;
			videoInfo.formattedLastParsingTimestamp = formattedNow;
			videoInfo.lastUsedTimestamp = now;
			videoInfo.formattedLastUsedTimestamp = formattedNow;
			videoInfo.parsedVideoUrl = parsedVideoData.url;
			videoInfo.parsedVideoQuality = parsedVideoData.quality;
		} catch (error) {
			await showFetchFailedPopup(error.stack);
			return false;
		}

		debug.log('detailed video info:', videoInfo);

		switch (parsedVideoData.code) {

			/* Parsing successful */
			case 0:

				/* Save parsing history */
				try {
					const historyRetentionPeriod = await getOptionData(optionKeys.HISTORY_RENTENTION_PERIOD);
					if (historyRetentionPeriod > 0) {
						await addHistory(videoInfo);
					}
				} catch (error) {
					debug.log(error);
				}

				/* Copy the parsed video's URL to the clipboard */
				try {
					await navigator.clipboard.writeText(parsedVideoData.url);
					await showParsingSuccessfulPopup(parsedVideoData.quality, videoInfo.title);
				} catch (error) {
					await showClipboardWriteFailedPopup(error.stack);
					return false;
				}

				break;

			/* Parsing failed */
			case 1:
				await showParsingFailedPopup(parsedVideoData.message);
				return false;

			/* Other error */
			default:
				const errorMessage = `API Error: API returned unknown code ${parsedVideoData.code}.`;
				await showUnknownErrorPopup(errorMessage);
				return false;

		}

		return true;

	} catch (error) {

		/* Display unknown error popup */
		await showUnknownErrorPopup(error.stack);

		return false;

	} finally {

		/* Reset parsing status */
		const now = Date.now();
		const parsingStatus = await loadFromStorage(storageKeys.PARSING_STATUS);
		if (parsingStatus !== parsingStatuses.PARSABLE) {
			await saveToStorage(storageKeys.PARSING_STATUS, parsingStatuses.PARSABLE);
			await saveToStorage(storageKeys.LAST_PARSING_TIMESTAMP, now);
		}

	}

}

/**
 * Get video info from current tab's URL.
 * @param {string} videoPageURL - Video page's URL
 * @returns {Object.<string, *>} Video info
 */
function getBvidAndPageNoFromURL(videoPageURL) {

	const videoInfo = {};

	/* Get video ID (bvid) */
	try {
		const matchResult = videoPageURL.match(getBVIDRegexp);
		videoInfo.bvid = matchResult[1];
	} catch (error) {
		throw new Error('Failed to extract bvid');
	}

	/* Get video page number (p) */
	const url = new URL(videoPageURL)
	const params = new URLSearchParams(url.search);
	const pageNo = Number(params.get('p'));
	if (pageNo) {
		videoInfo.p = pageNo;
	} else {
		videoInfo.p = 1;
	}

	return videoInfo;

}

/**
 * Get detailed video info by using the bilibili API.
 * @param {string} bvid - Video ID (bvid)
 * @param {number} p - Video page number (p)
 * @returns {Promise.<Object.<string, *>>} Detailed video info
 */
async function getDetailedVideoInfo(bvid, p) {

	/* Create request URL */
	const requestURL = new URL(detailedVideoInfoEndpoint);
	requestURL.searchParams.set('bvid', bvid);

	/* Send request */
	const response = await fetch(requestURL);
	const detailedVideoInfo = await response.json();
	const pageInfo = detailedVideoInfo.data.pages.find(page => page.page === p);
	debug.log('bilibili API:', detailedVideoInfo);

	/* extract video info */
	const result = {};
	result.bvid = bvid;
	result.p = p;
	result.thumbnail = detailedVideoInfo.data.pic;
	result.uploader = detailedVideoInfo.data.owner.name;
	result.cid = pageInfo.cid;
	result.title = detailedVideoInfo.data.title;
	result.subtitle = (detailedVideoInfo.data.pages.length > 1) ? pageInfo.part : undefined;

	return result;

}

/**
 * Parse the video using the video parsing API and fetch the processed data.
 * @param {string} bvid - Video ID (bvid)
 * @param {number} p - Video page number (p)
 * @returns {Promise.<Object.<string, *>>} Parsed video data
 */
async function getParsedVideoData(bvid, p) {

	/* Create request URL */
	const requestURL = new URL(videoParsingEndpoint);
	requestURL.searchParams.set('bv', bvid);
	requestURL.searchParams.set('p', p);
	requestURL.searchParams.set('format', 'mp4');
	requestURL.searchParams.set('otype', 'json');

	/* Send request */
	const response = await fetch(requestURL);
	const parsedVideoData = await response.json();
	debug.log('bilibili-parse API:', parsedVideoData);

	return parsedVideoData;

}

/**
 * Get video page's URL from bvid and p.
 * @param {string} bvid - Video ID (bvid)
 * @param {number} p - Video page number (p)
 * @returns {string} Video page URL
 */
function getVideoPageURL(bvid, p) {
	return videoPageURLFormat.replaceAll('{bvid}', bvid).replaceAll('{p}', p);
}

//#endregion