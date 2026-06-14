'use strict';

//	-----------------------------------------------------------
//		Constant
//	-----------------------------------------------------------

//#region Constant

/* API URL */
const detailedVideoInfoEndpoint = 'https://api.bilibili.com/x/web-interface/view';

/* Video page URL */
const videoPageURLFormat = 'https://www.bilibili.com/video/{bvid}/?p={p}';

/* Reuse expiration of parsed video URL (ms) */
const reuseExpirationTime = 1000 * 60 * 60;

/* Parsing cooldown duration (ms) */
const parsingCooldownTime = 1000 * 5;

/* Video parsing API timeout duration (ms) */
const videoParsingFetchTimeout = 1000 * 20;

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

/* Whether a video parsing request is already being handled in this page */
let isVideoParsingRequestLocked = false;

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
			const parsingResult = await requestVideoParsing(window.location.href);
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
async function requestVideoParsing(videoPageURL) {

	if (isVideoParsingRequestLocked) {
		debug.log('Video cannot be parsed because another request is already being handled.');
		return false;
	}

	isVideoParsingRequestLocked = true;

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
				await writeTextToClipboard(historyItem.parsedVideoURL);
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

	} finally {

		isVideoParsingRequestLocked = false;

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
		await saveToStorage(storageKeys.PARSING_STATUS, parsingStatuses.PARSING);
		await showProcessingPopup();

		/* Set default value */
		const basicVideoInfo = {
			bvid: bvid,
			p: p,
			url: getVideoPageURL(bvid, p)
		};
		debug.log('basic video info:', basicVideoInfo);

		/* Get detailed video info */
		const detailedVideoInfo = await getDetailedVideoInfo(bvid, p);
		debug.log('detailed video info:', detailedVideoInfo);

		/* Send parsing request to Web API */
		const parsedVideoData = await getParsedVideoData(bvid, p);
		if (parsedVideoData === undefined) {
			return false;
		}
		debug.log('parsed video info:', parsedVideoData);

		/* Get history item info to add to history */
		const historyItemInfo = getHistoryItemInfo(Date.now());
		debug.log('history item info:', historyItemInfo);

		/* Construct video info */
		const videoInfo = {
			...basicVideoInfo,
			...detailedVideoInfo,
			...parsedVideoData,
			...historyItemInfo
		};
		debug.log('video info:', videoInfo);

		switch (videoInfo.parsedVideoResponseCode) {

			/* Parsing successful */
			case 0:

				/* Save parsing history */
				try {
					const historyRetentionPeriod = await loadOptionData(optionKeys.HISTORY_RENTENTION_PERIOD);
					if (historyRetentionPeriod > 0) {
						await addHistory(videoInfo);
					}
				} catch (error) {
					debug.log(error);
				}

				/* Copy the parsed video's URL to the clipboard */
				try {
					await writeTextToClipboard(videoInfo.parsedVideoURL);
					await showParsingSuccessfulPopup(videoInfo.parsedVideoQuality, videoInfo.title);
				} catch (error) {
					await showClipboardWriteFailedPopup(error.stack);
					return false;
				}

				break;

			/* Parsing failed */
			case 1:
				await showParsingFailedPopup(videoInfo.parsedVideoResponseMessage);
				return false;

			/* Other error */
			default:
				const errorMessage = `API Error: API returned unknown code ${videoInfo.parsedVideoResponseCode}.`;
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
		try {
			const now = Date.now();
			const parsingStatus = await loadFromStorage(storageKeys.PARSING_STATUS);
			if (parsingStatus !== parsingStatuses.PARSABLE) {
				await saveToStorage(storageKeys.PARSING_STATUS, parsingStatuses.PARSABLE);
				await saveToStorage(storageKeys.LAST_PARSING_TIMESTAMP, now);
			}
		} catch (error) {
			debug.error(error);
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

	/* Set default return value */
	const result = {
		bvid: bvid,
		p: p,
		thumbnail: undefined,
		uploader: '---',
		cid: undefined,
		title: '---',
		subtitle: undefined
	};

	try {

		/* Create request URL */
		const requestURL = new URL(detailedVideoInfoEndpoint);
		requestURL.searchParams.set('bvid', bvid);

		/* Send request */
		const response = await fetchWithTimeout(requestURL, {}, videoParsingFetchTimeout);
		if (response.ok === false) {
			throw new Error(`Bilibili API returned HTTP ${response.status}`);
		}
		const detailedVideoInfo = await response.json();
		debug.log('bilibili API:', detailedVideoInfo);

		if (detailedVideoInfo.code !== 0 || detailedVideoInfo.data === undefined) {
			throw new Error(`Bilibili API returned code ${detailedVideoInfo.code}`);
		}

		/* extract video info */
		const pages = Array.isArray(detailedVideoInfo.data.pages) ? detailedVideoInfo.data.pages : [];
		const pageInfo = pages.find(page => page.page === p) || pages[0];
		if (pageInfo === undefined) {
			throw new Error('Bilibili API returned no page info');
		}
		result.cid = pageInfo.cid;
		result.title = detailedVideoInfo.data.title;
		result.subtitle = (pages.length > 1) ? pageInfo.part : undefined;
		result.uploader = detailedVideoInfo.data.owner ? detailedVideoInfo.data.owner.name : result.uploader;
		result.thumbnail = detailedVideoInfo.data.pic;

	} catch (error) {

		debug.log(error);

	} finally {

		return result;

	}

}

/**
 * Parse the video using the video parsing API and fetch the processed data.
 * @param {string} bvid - Video ID (bvid)
 * @param {number} p - Video page number (p)
 * @returns {Promise.<Object.<string, *>>} Parsed video data
 */
async function getParsedVideoData(bvid, p) {

	try {

		const parsingServerMode = await getVideoParsingMode();
		if (parsingServerMode === parsingServerModes.REDIRECT_URL) {
			return await getParsedVideoDataFromRedirectURLServer(bvid, p);
		}

		return await getParsedVideoDataFromJSONServer(bvid, p);

	} catch (error) {

		/* Display fetch failed popup */
		await showFetchFailedPopup(error.stack);

		return undefined;

	}

}

/**
 * Parse the video using a JSON video parsing API.
 * @param {string} bvid - Video ID (bvid)
 * @param {number} p - Video page number (p)
 * @returns {Promise.<Object.<string, *>>} Parsed video data
 */
async function getParsedVideoDataFromJSONServer(bvid, p) {

	/* Create request URL */
	const requestURL = new URL(await getVideoParsingEndpoint());
	requestURL.searchParams.set('bv', bvid);
	requestURL.searchParams.set('p', p);
	requestURL.searchParams.set('format', 'mp4');
	requestURL.searchParams.set('otype', 'json');

	/* Send request */
	const response = await fetchWithTimeout(requestURL, {}, videoParsingFetchTimeout);
	if (response.ok === false) {
		throw new Error(`Video parsing API returned HTTP ${response.status}`);
	}
	const parsedVideoData = await response.json();
	debug.log('bilibili-parse API:', parsedVideoData);

	if (parsedVideoData === undefined || parsedVideoData.code === undefined) {
		throw new Error('Video parsing API returned invalid data');
	}

	/* Set return value */
	const result = {
		parsedVideoURL: parsedVideoData.url,
		parsedVideoQuality: parsedVideoData.quality,
		parsedVideoResponseCode: parsedVideoData.code,
		parsedVideoResponseMessage: parsedVideoData.message
	};

	return result;

}

/**
 * Parse the video using a redirect URL video parsing API.
 * @param {string} bvid - Video ID (bvid)
 * @param {number} p - Video page number (p)
 * @returns {Promise.<Object.<string, *>>} Parsed video data
 */
async function getParsedVideoDataFromRedirectURLServer(bvid, p) {

	/* Create request URL */
	const requestURL = new URL(await getVideoParsingEndpoint());
	requestURL.searchParams.set('url', getVideoPageURL(bvid, p));

	/* Send request */
	let response = await fetchWithTimeout(requestURL, {redirect: 'manual'}, videoParsingFetchTimeout);
	let parsedVideoURL = response.headers.get('location');

	if (parsedVideoURL === null) {
		response = await fetchWithTimeout(requestURL, {redirect: 'follow'}, videoParsingFetchTimeout);
		if (response.ok === false) {
			throw new Error(`Video parsing redirect server returned HTTP ${response.status}`);
		}
		parsedVideoURL = response.url;
	}

	parsedVideoURL = normalizeParsedVideoURL(parsedVideoURL, requestURL);
	debug.log('video parsing redirect URL:', parsedVideoURL);

	return {
		parsedVideoURL,
		parsedVideoQuality: 64,
		parsedVideoResponseCode: 0,
		parsedVideoResponseMessage: 'OK'
	};

}

/**
 * Normalize and validate parsed video URL.
 * @param {string} parsedVideoURL - Parsed video URL
 * @param {URL} baseURL - Base URL
 * @returns {string} Normalized parsed video URL
 */
function normalizeParsedVideoURL(parsedVideoURL, baseURL) {

	const url = new URL(parsedVideoURL, baseURL);
	const validHostSuffixes = ['.bilivideo.com', '.bilivideo.cn', '.akamaized.net', '.cloudfront.net'];
	const hostname = url.hostname.toLowerCase();
	const isValidHost = validHostSuffixes.some((suffix) => hostname.endsWith(suffix));

	if (['http:', 'https:'].includes(url.protocol) === false) {
		throw new Error('Video parsing redirect server returned unsupported protocol');
	}

	if (isValidHost === false || url.pathname.includes('.mp4') === false) {
		throw new Error('Video parsing redirect server returned invalid video URL');
	}

	return url.toString();

}

/**
 * Get video parsing server endpoint.
 * @returns {Promise.<string>} Video parsing server endpoint
 */
async function getVideoParsingEndpoint() {

	try {
		const endpoint = await loadOptionData(optionKeys.PARSING_SERVER_ENDPOINT);
		const url = new URL(endpoint);
		if (['http:', 'https:'].includes(url.protocol) === false) {
			throw new Error('Unsupported protocol');
		}
		return url.toString();
	} catch (error) {
		debug.warn('Invalid parsing server endpoint. Use default endpoint.', error);
		return defaultVideoParsingEndpoint;
	}

}

/**
 * Get video parsing server mode.
 * @returns {Promise.<string>} Video parsing server mode
 */
async function getVideoParsingMode() {

	const mode = await loadOptionData(optionKeys.PARSING_SERVER_MODE);
	if (Object.values(parsingServerModes).includes(mode)) {
		return mode;
	}
	return parsingServerModes.JSON;

}

/**
 * Get history info.
 * @param {number} now - Current timestamp
 * @returns {Object.<string, *>} History info
 */
function getHistoryItemInfo(now) {

	const formattedNow = new Date(now).toString();
	const result = {
		historyID: now,
		lastParsingTimestamp: now,
		formattedLastParsingTimestamp: formattedNow,
		lastUsedTimestamp: now,
		formattedLastUsedTimestamp: formattedNow,
	};

	return result;

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
