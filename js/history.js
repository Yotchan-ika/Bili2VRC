'use strict';

executeOnWindowLoad(init);

/**
 * Initialization.
 */
async function init() {

	try {

		const now = Date.now();

		/* Delete old parsing history */
		await deleteOldHistory(now);

		/* Display the parsing history */
		await setHistoryHTMLContent();

	} catch (error) {

		/* Display unknown error popup */
		await showUnknownErrorPopup(error.stack);

	}

}

/**
 * Handler executed when the video parsing button clicked.
 * @param {Event} event - Event
 */
async function onVideoParsingButtonClick(event) {

	try {

		/* Get target history ID */
		const buttonElement = event.currentTarget;
		const historyID = Number(buttonElement.getAttribute('data-bili2vrc-history-id'));

		/** @type {Array.<Object.<string, *>>} Get target history item */
		const history = await loadFromStorage(storageKeys.HISTORY);
		const historyItem = history.find(item => item.historyID === historyID);

		/* Request video parsing */
		if (historyItem) {
			await requestVideoParsing(historyItem.url);
		} else {
			throw new Error('Parsing history not found');
		}

	} catch (error) {

		/* Display unknown error popup */
		await showUnknownErrorPopup(error.stack);

	}

}

/**
 * Handler executed when the delete history button clicked.
 * @param {Event} event - Event
 */
async function onDeleteHistoryButtonClick(event) {

	try {

		/* Get target history item element */
		const buttonElement = event.currentTarget;
		const historyID = Number(buttonElement.getAttribute('data-bili2vrc-history-id'));

		/** Delete history item */
		await deleteHistoryItem(historyID);

		/** Remove history item element */
		const historyItemElement = document.querySelector(`.bili2vrc-history-item[data-bili2vrc-history-id="${historyID}"]`);
		historyItemElement.classList.add('bili2vrc-deleting');
		setTimeout(async () => {

			/* Remove history item */
			historyItemElement.remove();

			/* Update history list */
			await setHistoryHTMLContent();

		}, 200);

		/* Show history deleted popup */
		await showHistoryDeletedPopup();

	} catch (error) {

		/* Display unknown error popup */
		await showUnknownErrorPopup(error.stack);

	}

}

/**
 * Display the parsing history list on the page.
 */
async function setHistoryHTMLContent() {

	const currentDatetime = new Date();

	/* Save the current scroll position */
	const scrollX = window.scrollX;
	const scrollY = window.scrollY;

	/* Get history list container element */
	const historyListElement = document.getElementById('history-list');
	historyListElement.replaceChildren();

	/** @type {Array.<Object.<string, *>>} Get parsing history */
	const history = await loadFromStorage(storageKeys.HISTORY);

	/* Sort by most recently used */
	const sortedHistory = history.sort((itemA, itemB) => (
		itemB.lastUsedTimestamp - itemA.lastUsedTimestamp
	));

	/* Split the history to today, yesterday, last 7 days, last 30 days, Earlier */
	const oneDay = 1000 * 60 * 60 * 24;
	const startTimestampOfToday = new Date(currentDatetime.getFullYear(), currentDatetime.getMonth(), currentDatetime.getDate()).getTime();
	const startTimestampOfYesterday = startTimestampOfToday - oneDay;
	const startTimestampOfOneWeekAgo = startTimestampOfToday - oneDay * 7;
	const startTimestampOfOneMonthAgo = startTimestampOfToday - oneDay * 30;
	const historyOfToday = [];
	const historyOfYesterday = [];
	const historyOfLast7days = [];
	const historyOfLast30days = [];
	const historyOfEarlier = [];
	for (const item of sortedHistory) {
		if (item.lastParsingTimestamp >= startTimestampOfToday) {
			historyOfToday.push(item);
		} else if (item.lastParsingTimestamp >= startTimestampOfYesterday) {
			historyOfYesterday.push(item);
		} else if (item.lastParsingTimestamp >= startTimestampOfOneWeekAgo) {
			historyOfLast7days.push(item);
		} else if (item.lastParsingTimestamp >= startTimestampOfOneMonthAgo) {
			historyOfLast30days.push(item);
		} else {
			historyOfEarlier.push(item);
		}
	}

	/* Create hisotry item element and insert it to the page */
	if (historyOfToday.length > 0) {
		historyListElement.appendChild(createHistoryItemHeaderElement('history_historyItemTitle_today'));
		for (const item of historyOfToday) {
			const historyItemElement = await createHistoryItemElement(item);
			historyListElement.appendChild(historyItemElement);
		}
	}
	if (historyOfYesterday.length > 0) {
		historyListElement.appendChild(createHistoryItemHeaderElement('history_historyItemTitle_yesterday'));
		for (const item of historyOfYesterday) {
			const historyItemElement = await createHistoryItemElement(item);
			historyListElement.appendChild(historyItemElement);
		}
	}
	if (historyOfLast7days.length > 0) {
		historyListElement.appendChild(createHistoryItemHeaderElement('history_historyItemTitle_last7days'));
		for (const item of historyOfLast7days) {
			const historyItemElement = await createHistoryItemElement(item);
			historyListElement.appendChild(historyItemElement);
		}
	}
	if (historyOfLast30days.length > 0) {
		historyListElement.appendChild(createHistoryItemHeaderElement('history_historyItemTitle_last30days'));
		for (const item of historyOfLast30days) {
			const historyItemElement = await createHistoryItemElement(item);
			historyListElement.appendChild(historyItemElement);
		}
	}
	if (historyOfEarlier.length > 0) {
		historyListElement.appendChild(createHistoryItemHeaderElement('history_historyItemTitle_earlier'));
		for (const item of historyOfEarlier) {
			const historyItemElement = await createHistoryItemElement(item);
			historyListElement.appendChild(historyItemElement);
		}
	}

	/* If no history, display message */
	await setNoHistoryMessage();

	/* Set locale texts */
	await setLangAttributes();
	await setLocaleTexts();

	/* Display content */
	await displayContent();

	/* Restore the scroll position */
	window.scrollTo(scrollX, scrollY);

}

/**
 * Display no history message if the list has no parsing history.
 */
async function setNoHistoryMessage() {

	/* Get history list container element */
	const historyListElement = document.getElementById('history-list');

	/* Insert message element if the list has no child */
	if (!historyListElement.firstElementChild) {
		const textElement = document.createElement('div');
		textElement.setAttribute('data-bili2vrc-msg', 'history_noHistoryMessage');
		historyListElement.replaceChildren(textElement);
		await setLocaleTexts();
	}

}

/**
 * Get title and subtitle text from history item data.
 * @param {Object.<string, *>} historyItem - History item data
 * @returns
 */
function getTitleText(historyItem) {

	/* If the subtitle is undefined, return only the title */
	if (historyItem.subtitle) {
		return historyItem.title + '\n' + historyItem.subtitle;
	} else {
		return historyItem.title;
	}

}

//	-----------------------------------------------------------
//		Create History Item Element
//	-----------------------------------------------------------

//#region Craete History Item Element

/**
 * Create history item header element.
 * @param {string} messageID - Message ID of locale text
 * @returns {HTMLElement} Header element
 */
function createHistoryItemHeaderElement(messageID) {

	/* Create header element */
	const headerElement = document.createElement('h2');
	headerElement.setAttribute('data-bili2vrc-msg', messageID);
	headerElement.classList.add('bili2vrc-underline');

	return headerElement;

}

/**
 * Create history item element.
 * @param {Object.<string, *>} historyItem - History item data
 * @returns {Promise.<HTMLElement>} History item element
 */
async function createHistoryItemElement(historyItem) {

	/* Create history item element */
	const tempElement = document.createElement('div');
	tempElement.innerHTML = await loadTextFile('html/common/history-item.html');

	/* Format parsed date and time */
	const formatOptions = {
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: 'numeric',
		hour12: true
	};
	const parsedDatetime = await getFormattedDatetime(historyItem.lastParsingTimestamp, formatOptions);

	/* Set dynamic values */
	const subtitle = historyItem.subtitle || '';
	const buttonIcon = await loadTextFile('images/ButtonIcon_24x24.html');
	const dynamicValues = {
		'history-id': 			{value: historyItem.historyID, 		attribute: 'data-bili2vrc-history-id'},
		'url-href': 			{value: historyItem.url, 			attribute: 'href'},
		'title': 				{value: historyItem.title, 			attribute: undefined},
		'title-title': 			{value: historyItem.title, 			attribute: 'title'},
		'title-alt': 			{value: getTitleText(historyItem), 	attribute: 'alt'},
		'subtitle': 			{value: subtitle, 					attribute: undefined},
		'uploader': 			{value: historyItem.uploader, 		attribute: undefined},
		'thumbnail-src': 		{value: historyItem.thumbnail, 		attribute: 'src'},
		'parsing-datetime': 	{value: parsedDatetime, 			attribute: undefined},
		'parsing-button-icon': 	{value: buttonIcon, 				attribute: undefined},
	};
	setDynamicValues(dynamicValues, tempElement);

	/* Add eventListener */
	const videoParsingButtonElement = tempElement.querySelector('.bili2vrc-history-item-video-parsing-button');
	const deleteHistoryButtonElement = tempElement.querySelector('.bili2vrc-history-item-delete-history-button');
	videoParsingButtonElement.addEventListener('click', onVideoParsingButtonClick);
	deleteHistoryButtonElement.addEventListener('click', onDeleteHistoryButtonClick);

	return tempElement.firstElementChild;

}

//#endregion