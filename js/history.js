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
			historyItemElement.remove();
			await setNoHistoryMessage();
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

	/* Get history list container element */
	const historyListElement = document.getElementById('history-list');

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

	/* Set resource texts */
	await setLangAttributes();
	await setResourceTexts();

	/* Display content */
	await displayContent();

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
		await setResourceTexts();
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
 * @param {string} messageID - Message ID of resource text
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
 * @returns {Promise.<HTMLDivElement>} History item element
 */
async function createHistoryItemElement(historyItem) {

	/* Create history item inner element */
	const historyItemInnerElement = document.createElement('div');
	historyItemInnerElement.classList.add('bili2vrc-history-item-inner');
	historyItemInnerElement.appendChild(createThumbnailContainerElement());
	historyItemInnerElement.appendChild(await createVideoInfoContainerElement());

	/* Create history item element */
	const historyItemElement = document.createElement('div');
	historyItemElement.setAttribute('data-bili2vrc-history-id', historyItem.historyID);
	historyItemElement.classList.add('bili2vrc-history-item');
	historyItemElement.classList.add('bili2vrc-underline');
	historyItemElement.appendChild(historyItemInnerElement);

	return historyItemElement;

	/**
	 * Create thumbnail container element.
	 * @returns {HTMLDivElement} Thumbnail container element
	 */
	function createThumbnailContainerElement() {

		/* Create thumbnail image element */
		const thumbnailElement = document.createElement('img');
		thumbnailElement.setAttribute('src', historyItem.thumbnail);
		thumbnailElement.setAttribute('alt', historyItem.title);
		thumbnailElement.classList.add('bili2vrc-history-item-thumbnail');
		const thumbnailAnchorElement = createAnchorElement(
			thumbnailElement,
			historyItem.url,
			getTitleText(historyItem)
		);

		/* Create thumbnail container element */
		const thumbnailContainerElement = document.createElement('div');
		thumbnailContainerElement.classList.add('bili2vrc-history-item-thumbnail-container');
		thumbnailContainerElement.appendChild(thumbnailAnchorElement);

		return thumbnailContainerElement;

	}

	/**
	 * Create video info container.
	 * @returns {Promise.<HTMLDivElement>} Video info container
	 */
	async function createVideoInfoContainerElement() {

		/* Create video info container element */
		const videoInfoContainerElement = document.createElement('div');
		videoInfoContainerElement.classList.add('bili2vrc-history-item-video-info-container');
		videoInfoContainerElement.appendChild(await createVideoInfoElement());
		videoInfoContainerElement.appendChild(await createButtonContainerElement());

		return videoInfoContainerElement;

		/**
		 * Create video info element.
		 * @returns {Promise.<HTMLDivElement>} Video info element
		 */
		async function createVideoInfoElement() {

			/* Create video info */
			const videoInfoElement = document.createElement('div');
			videoInfoElement.classList.add('bili2vrc-history-item-video-info');
			videoInfoElement.appendChild(createTitleContainerElement());
			videoInfoElement.appendChild(await createDetailedVideoInfoContainerElement());

			return videoInfoElement;

			/**
			 * Create title container.
			 * @returns {HTMLAnchorElement} Title container
			 */
			function createTitleContainerElement() {

				/* Create title */
				const titleElement = document.createElement('div');
				titleElement.classList.add('bili2vrc-history-item-title');
				titleElement.textContent = historyItem.title;

				/* Create subtitle */
				const subtitleElement = document.createElement('div');
				subtitleElement.classList.add('bili2vrc-history-item-subtitle');
				subtitleElement.textContent = historyItem.subtitle;

				/* Create title container */
				const titleContainerElement = document.createElement('div');
				titleContainerElement.setAttribute('lang', 'zh-CN');
				titleContainerElement.append(titleElement);
				titleContainerElement.append(subtitleElement);
				const titleContainerAnchorElement = createAnchorElement(
					titleContainerElement,
					historyItem.url,
					getTitleText(historyItem)
				);

				return titleContainerAnchorElement

			}

			/**
			 * Craete detailed video info container.
			 * @returns {Promise.<HTMLDivElement>} Detailed video info container
			 */
			async function createDetailedVideoInfoContainerElement() {

				/* Create container */
				const detailedVideoInfoContainerElement = document.createElement('div');
				detailedVideoInfoContainerElement.classList.add('bili2vrc-history-item-detailed-video-info-container');
				detailedVideoInfoContainerElement.appendChild(createUploaderContainerElement());
				detailedVideoInfoContainerElement.appendChild(await createParsingDatetimeContainerElemenet());

				return detailedVideoInfoContainerElement;

				/**
				 * Create uploader container.
				 * @returns {HTMLDivElement} Uploader container
				 */
				function createUploaderContainerElement() {

					/* Create uploader icon element */
					const uploaderIconElement = document.createElement('span');
					uploaderIconElement.classList.add('material-symbols-rounded');
					uploaderIconElement.textContent = 'account_circle';

					/* Create uploader text element */
					const uploaderTextElement = document.createElement('span');
					uploaderTextElement.textContent = historyItem.uploader;

					/* Create uploader container element */
					const uploaderContainerElement = document.createElement('div');
					uploaderContainerElement.setAttribute('lang', 'zh-CN');
					uploaderContainerElement.classList.add('bili2vrc-history-item-detailed-video-info-item');
					uploaderContainerElement.appendChild(uploaderIconElement);
					uploaderContainerElement.appendChild(uploaderTextElement);

					return uploaderContainerElement;

				}

				/**
				 * Create parsing date and time container.
				 * @returns {Promise.<HTMLDivElement>} Parsing date and time container
				 */
				async function createParsingDatetimeContainerElemenet() {

					/* Create parsing datetime icon element */
					const parsingDatetimeIconElement = document.createElement('span');
					parsingDatetimeIconElement.classList.add('material-symbols-rounded');
					parsingDatetimeIconElement.textContent = 'history';

					/* Create uploader text element */
					const formatOptions = {
						month: 'short',
						day: 'numeric',
						hour: 'numeric',
						minute: 'numeric',
						hour12: true
					};
					const parsingDatetimeTextElement = document.createElement('span');
					parsingDatetimeTextElement.textContent = await getFormattedDatetime(historyItem.lastParsingTimestamp, formatOptions);

					/* Create parsing datetime container element */
					const parsingDatetimeContainerElement = document.createElement('div');
					parsingDatetimeContainerElement.setAttribute('data-bili2vrc-set-lang-attribute', '');
					parsingDatetimeContainerElement.classList.add('bili2vrc-history-item-detailed-video-info-item');
					parsingDatetimeContainerElement.appendChild(parsingDatetimeIconElement);
					parsingDatetimeContainerElement.appendChild(parsingDatetimeTextElement);

					return parsingDatetimeContainerElement;

				}

			}



		}

		/**
		 * Create button container.
		 * @returns {Promise.<HTMLDivElement>} Button container
		 */
		async function createButtonContainerElement() {

			/* Create button contaienr */
			const buttonContainerElement = document.createElement('div');
			buttonContainerElement.classList.add('bili2vrc-history-item-button-container');
			buttonContainerElement.appendChild(await createVideoParsingButtonElement());
			buttonContainerElement.appendChild(createDeleteHistoryButtonElement());

			return buttonContainerElement;

			/**
			 * Create video parsing button.
			 * @returns {Promise.<HTMLButtonElement>} Video parsing button
			 */
			async function createVideoParsingButtonElement() {

				/* Create video parsing button icon */
				const videoParsingButtonIconElement = document.createElement('div');
				videoParsingButtonIconElement.innerHTML = await loadTextFile('images/ButtonIcon_24x24.svg');

				/* Create video parsing button text */
				const videoParsingButtonTextElement = document.createElement('div');
				videoParsingButtonTextElement.setAttribute('data-bili2vrc-msg', 'history_videoParsingButton');

				/* Create video parsing button */
				const videoParsingButtonElement = document.createElement('button');
				videoParsingButtonElement.setAttribute('data-bili2vrc-history-id', historyItem.historyID);
				videoParsingButtonElement.classList.add('bili2vrc-history-item-button');
				videoParsingButtonElement.classList.add('bili2vrc-history-item-video-parsing-button');
				videoParsingButtonElement.addEventListener('click', onVideoParsingButtonClick);
				videoParsingButtonElement.appendChild(videoParsingButtonIconElement);
				videoParsingButtonElement.appendChild(videoParsingButtonTextElement);

				return videoParsingButtonElement;

			}

			/**
			 * Create delete history button.
			 * @returns {HTMLButtonElement} Delete history button
			 */
			function createDeleteHistoryButtonElement() {

				/* Create delete history button icon */
				const deleteHistoryButtonIconElement = document.createElement('div');
				deleteHistoryButtonIconElement.classList.add('material-symbols-rounded');
				deleteHistoryButtonIconElement.textContent = 'delete'

				/* Create delete history button text */
				const deleteHistoryButtonTextElement = document.createElement('div');
				deleteHistoryButtonTextElement.setAttribute('data-bili2vrc-msg', 'history_deleteHistoryButton');

				/* Create delete history button */
				const deleteHistoryButtonElement = document.createElement('button');
				deleteHistoryButtonElement.setAttribute('data-bili2vrc-history-id', historyItem.historyID);
				deleteHistoryButtonElement.classList.add('bili2vrc-history-item-button');
				deleteHistoryButtonElement.classList.add('bili2vrc-history-item-delete-history-button');
				deleteHistoryButtonElement.addEventListener('click', onDeleteHistoryButtonClick);
				deleteHistoryButtonElement.appendChild(deleteHistoryButtonIconElement);
				deleteHistoryButtonElement.appendChild(deleteHistoryButtonTextElement);

				return deleteHistoryButtonElement;

			}

		}

	}

	/**
	 * Create anchor element.
	 * @param {HTMLElement} child - Inner HTML element or text node
	 * @param {string} href - URL text
	 * @param {stirng} title - Text displayed on mouse hover
	 * @returns {HTMLAnchorElement} Anchor Element
	 */
	function createAnchorElement(child, href, title = '') {

		/* Create anchor element */
		const anchorElement = document.createElement('a');
		anchorElement.setAttribute('href', href);
		anchorElement.setAttribute('title', title);
		anchorElement.setAttribute('target', '_blank');
		anchorElement.appendChild(child);

		return anchorElement;

	}

}

//#endregion