'use strict';

/**
 * Get index of specified history item.
 * @param {string} bvid - Video ID (bvid)
 * @param {number} p - Video page numner (p)
 * @param {number} now - Current timestamp
 * @returns {Promise.<number>} Index of history item
 */
async function getHistoryItemIndex(bvid, p, now) {

	try {

		const currentTimestamp = new Date(now);

		/** @type {Array.<Object.<string, *>>} */
		const history = await loadFromStorage(storageKeys.HISTORY);
		const targetHistoryItemIndex = history.findIndex(item => {
			/** @type {Date} */
			const lastParsingTimestamp = new Date(item.lastParsingTimestamp);
			return (
				item.bvid === bvid &&
				item.p === p &&
				lastParsingTimestamp.getFullYear() === currentTimestamp.getFullYear() &&
				lastParsingTimestamp.getMonth() === currentTimestamp.getMonth() &&
				lastParsingTimestamp.getDate() === currentTimestamp.getDate()
			);
		});

		return targetHistoryItemIndex;

	} catch (error) {
		debug.error(error);
		return -1;
	}

}

/**
 * Get specified history item.
 * @param {string} bvid - Video ID (bvid)
 * @param {number} p - Video page numner (p)
 * @param {number} now - Current timestamp
 * @returns {Promise.<Object.<string, *>>} History item
 */
async function getHistoryItem(bvid, p, now) {

	try {

		/* Get index of the target history item */
		const history = await loadFromStorage(storageKeys.HISTORY);
		const historyItemIndex = await getHistoryItemIndex(bvid, p, now);

		return history[historyItemIndex];

	} catch (error) {
		debug.error(error);
		return undefined;
	}

}

/**
 * Update value of last-used-timestamp.
 * @param {string} bvid - Video ID (bvid)
 * @param {number} p - Video page number (p)
 * @param {number} now - Current timestamp
 * @returns {Promise.<boolean>} True: successful, False: failed
 */
async function updateLastUsedTimestamp(bvid, p, now) {

	try {

		/* Get target parsing history item */
		const history = await loadFromStorage(storageKeys.HISTORY);
		const targetHistoryItemIndex = await getHistoryItemIndex(bvid, p, now);
		if (targetHistoryItemIndex < 0) {
			return false;
		}

		/* Update last-used-timestamp */
		const targetHistoryItem = history[targetHistoryItemIndex];
		targetHistoryItem.lastUsedTimestamp = now;
		targetHistoryItem.formattedLastUsedTimestamp = new Date(now).toString();

		/* Save parsing history */
		await saveToStorage(storageKeys.HISTORY, history);

		debug.log('history:', history);

		return true;

	} catch (error) {
		debug.error(error);
		return false;
	}

}

/**
 * Add parsing history.
 * @param {Object.<string, *>} videoInfo - Video info
 * @returns {Promise.<boolean>} True: successful, False: failed
 */
async function addHistory(videoInfo) {

	try {

		/** @type {Array.<Object.<string, *>>} Get parsing history */
		const history = await loadFromStorage(storageKeys.HISTORY);
		const historyItemIndex = await getHistoryItemIndex(
			videoInfo.bvid,
			videoInfo.p,
			videoInfo.lastParsingTimestamp
		);

		/* If an parsing history from today exists, delete it */
		if (historyItemIndex >= 0) {
			history.splice(historyItemIndex, 1);
		}

		/* Save parsing history */
		history.push(videoInfo);
		await saveToStorage(storageKeys.HISTORY, history);

		debug.log('history:', history);

		return true;

	} catch (error) {
		debug.error(error);
		return false;
	}

}

/**
 * Delete history older than the retention period.
 * @param {number} now - Current timestamp
 * @returns {Promise.<boolean>} True: successful, False: failed
 */
async function deleteOldHistory(now) {

	try {

		/** @type {Array.<Object.<string, *>>} */
		const history = await loadFromStorage(storageKeys.HISTORY);
		const historyRetentionPeriod = await getOptionData(optionKeys.HISTORY_RENTENTION_PERIOD);
		const historyRetentionEarliestTimestamp = now - (1000 * 60 * 60 * historyRetentionPeriod);

		/* Delete old history */
		const retainedHistory = history.filter(item => (
			item.lastParsingTimestamp > historyRetentionEarliestTimestamp
		));

		/* Save parsing history */
		await saveToStorage(storageKeys.HISTORY, retainedHistory);

		return true

	} catch (error) {
		debug.error(error);
		return false;
	}

}

/**
 * Delete history item.
 * @param {number} historyID - History ID
 */
async function deleteHistoryItem(historyID) {

	/** @type {Array.<Object.<string, *>>} Get target history item index */
	const history = await loadFromStorage(storageKeys.HISTORY);
	const historyItemIndex = history.findIndex(item => item.historyID === historyID);

	/* Delete history item */
	history.splice(historyItemIndex, 1);

	/* Save history */
	await saveToStorage(storageKeys.HISTORY, history);

}