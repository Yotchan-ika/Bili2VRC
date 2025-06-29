'use strict';

//	-----------------------------------------------------------
//		Constant
//	-----------------------------------------------------------

//#region Constant

/** @type {Object.<string, string>} */
const classNames = Object.freeze({
	POPUP: 'bili2vrc-popup',
	POPUP_SHOWING: 'bili2vrc-popup-showing'
});

/** @type {Object.<string, string>} */
const popupThemeColors = Object.freeze({
	GREEN: 'bili2vrc-popup-green',
	RED: 'bili2vrc-popup-red',
	BLUE: 'bili2vrc-popup-blue'
});

/** @type {Array.<number>} */
let timeoutIDs = [];

//#endregion

//	-----------------------------------------------------------
//		Popup Manager
//	-----------------------------------------------------------

//#region Popup Manager

/**
 * Create new popup element and insert into the document body.
 * @param {HTMLElement} popupInnerElement - Popup inner element
 * @param {string} themeColor - Theme color of the popup
 * @returns {HTMLDialogElement} Popup Element
 */
function createPopup(popupInnerElement, themeColor = popupThemeColors.BLUE) {

	/* Close all showing popup */
	closeAllPopups();

	/* Create dialog element */
	/** @type {HTMLDialogElement} */
	const popupElement = document.createElement('dialog');
	popupElement.classList.add(classNames.POPUP);
	popupElement.classList.add(themeColor);
	popupElement.appendChild(popupInnerElement);
	document.body.appendChild(popupElement);

	return popupElement;

}

/**
 * Show created popup.
 * @param {HTMLDialogElement} popupElement - Popup element
 * @param {number} duration - Display duration (ms), 0: Infinity
 * @param {boolean} closeOnOutsideClick - Close on outside click
 */
function showPopup(popupElement, duration = 0, closeOnOutsideClick = true) {

	/* Detect clicks outside of the popup */
	if (closeOnOutsideClick) {
		document.addEventListener('click', closeAllPopups);
	}

	/* Display popup */
	popupElement.show();
	requestAnimationFrame(() => {

		/* Remove focus */
		document.activeElement.blur();

		/* Slide-in animation */
		popupElement.classList.add(classNames.POPUP_SHOWING);

		/* Close the popup after the specified number of seconds */
		if (duration > 0) {
			const timeoutID = setTimeout(() => {
				document.removeEventListener('click', closeAllPopups);
				closePopup(popupElement);
				clearAllTimeouts();
			}, duration + 500);
			timeoutIDs.push(timeoutID);
		}

	});

}

/**
 * Close all popups.
 */
function closeAllPopups() {

	/* Stop detecting outside clicks */
	document.removeEventListener('click', closeAllPopups);

	/* Close the popup with the class "bili2vrc-popup-showing" */
	const showingPopupElements = document.querySelectorAll('.' + classNames.POPUP_SHOWING);
	for (const showingPopupElement of showingPopupElements) {
		closePopup(showingPopupElement);
	}

	/* Clear timeout */
	clearAllTimeouts();

}

/**
 * Close a popup.
 * @param {HTMLDialogElement} popupElement - Popup element
 */
function closePopup(popupElement) {

	/* Slide-out animation */
	popupElement.classList.remove(classNames.POPUP_SHOWING);

	/* Close and delete the current popup after animation */
	setTimeout(() => {
		popupElement.close();
		popupElement.remove();
	}, 500);

}

/**
 * Clear all timeout processing.
 */
function clearAllTimeouts() {
	for (const timeoutID of timeoutIDs) {
		clearTimeout(timeoutID);
	}
	timeoutIDs = [];
}

//#endregion

//	-----------------------------------------------------------
//		Popups
//	-----------------------------------------------------------

//#region Popups

/**
 * Show invalid URL popup.
 */
async function showInvalidURLPopup() {

	/* Create popup inner element */
	const popupInnerElement = document.createElement('div');
	popupInnerElement.setAttribute('data-bili2vrc-msg-src', 'popup/invalid-url.html');

	/* Create and show the popup */
	const popupElement = createPopup(popupInnerElement);
	await includeHTMLs();
	showPopup(popupElement);

}

/**
 * Show too frequent parsing request popup.
 * @param {number} lastParsingTimestamp Last parsing timestamp (ms)
 */
async function showTooFrequentParsingRequest(lastParsingTimestamp) {

	/* Create popup inner element */
	const popupInnerElement = document.createElement('div');
	popupInnerElement.setAttribute('data-bili2vrc-msg-src', 'popup/too-frequent-parsing-request.html');

	/* Create and show the popup */
	const remainingCooldownTime = parsingCooldownTime - (Date.now() - lastParsingTimestamp);
	const popupElement = createPopup(popupInnerElement);
	await includeHTMLs();
	setDynamicValues({
		'cooldown-time': {value: Math.ceil(parsingCooldownTime / 1000)},
		'remaining-cooldown-time': {value: Math.ceil(remainingCooldownTime / 1000)}
	});
	showPopup(popupElement);

	/* Update remaining cooldown time */
	clearInterval(popupIntervalID);
	popupIntervalID = setInterval(() => {
		const remainingCooldownTime = parsingCooldownTime - (Date.now() - lastParsingTimestamp);
		if (remainingCooldownTime > 0) {
			setDynamicValues({'remaining-cooldown-time': {value: Math.ceil(remainingCooldownTime / 1000)}});
		} else {
			setDynamicValues({'remaining-cooldown-time': {value: 0}});
			clearInterval(popupIntervalID);
		}
	}, 200);

}

/**
 * Show processing popup.
 */
async function showProcessingPopup() {

	/* Create popup inner element */
	const popupInnerElement = document.createElement('div');
	popupInnerElement.setAttribute('data-bili2vrc-msg-src', 'popup/processing.html');

	/* Create and show the popup */
	const popupElement = createPopup(popupInnerElement);
	await includeHTMLs();
	showPopup(popupElement, 0, false);

}

/**
 * Show parsing successful popup.
 * @param {number} videoQualityCode - Video quality code
 * @param {string} videoTitle - Video title
 */
async function showParsingSuccessfulPopup(videoQualityCode, videoTitle) {

	/* Create popup inner element */
	const popupInnerElement = document.createElement('div');
	popupInnerElement.setAttribute('data-bili2vrc-msg-src', 'popup/parsing-successful.html');

	/* Create and show the popup */
	const videoQualityText = videoQualityTexts[videoQualityCode] || 'Unknown';
	const popupElement = createPopup(popupInnerElement, popupThemeColors.GREEN);
	await includeHTMLs();
	setDynamicValues({
		'video-title': {value: videoTitle},
		'video-quality': {value: videoQualityText}
	});
	showPopup(popupElement);

}

/**
 * Show clipboard write successful popup.
 * @param {number} videoQualityCode - Video quality code
 * @param {string} videoTitle - Video title
 */
async function showClipboardWriteSuccessfulPopup(videoQualityCode, videoTitle) {

	/* Create popup inner element */
	const popupInnerElement = document.createElement('div');
	popupInnerElement.setAttribute('data-bili2vrc-msg-src', 'popup/clipboard-write-successful.html');

	/* Create and show the popup */
	const videoQualityText = videoQualityTexts[videoQualityCode] || 'Unknown';
	const popupElement = createPopup(popupInnerElement, popupThemeColors.GREEN);
	await includeHTMLs();
	setDynamicValues({
		'video-title': {value: videoTitle},
		'video-quality': {value: videoQualityText}
	});
	showPopup(popupElement);

}

/**
 * Show parsing failed popup.
 * @param {string} errorMessage - Error message
 */
async function showParsingFailedPopup(errorMessage) {

	/* Create popup inner element */
	const popupInnerElement = document.createElement('div');
	popupInnerElement.setAttribute('data-bili2vrc-msg-src', 'popup/parsing-failed.html');

	/* Create and show the popup */
	const popupElement = createPopup(popupInnerElement, popupThemeColors.RED);
	await includeHTMLs();
	setDynamicValues({'error-message': {value: errorMessage}});
	showPopup(popupElement);

}

/**
 * Show fetch failed popup.
 * @param {string} errorMessage - Error message
 */
async function showFetchFailedPopup(errorMessage) {

	/* Create popup inner element */
	const popupInnerElement = document.createElement('div');
	popupInnerElement.setAttribute('data-bili2vrc-msg-src', 'popup/fetch-failed.html');

	/* Create and show the popup */
	const popupElement = createPopup(popupInnerElement, popupThemeColors.RED);
	await includeHTMLs();
	setDynamicValues({'error-message': {value: errorMessage}});
	showPopup(popupElement);

}

/**
 * Show clipboard write failed popup.
 * @param {string} errorMessage - Error message
 */
async function showClipboardWriteFailedPopup(errorMessage) {

	/* Create popup inner element */
	const popupInnerElement = document.createElement('div');
	popupInnerElement.setAttribute('data-bili2vrc-msg-src', 'popup/clipboard-write-failed.html');

	/* Create and show the popup */
	const popupElement = createPopup(popupInnerElement, popupThemeColors.RED);
	await includeHTMLs();
	setDynamicValues({'error-message': {value: errorMessage}});
	showPopup(popupElement);

}

/**
 * Show unknown error popup.
 * @param {string} errorMessage - Error message
 */
async function showUnknownErrorPopup(errorMessage) {

	try {

		/* Create popup inner element */
		const popupInnerElement = document.createElement('div');
		popupInnerElement.setAttribute('data-bili2vrc-msg-src', 'popup/unknown-error.html');

		/* Create and show the popup */
		const popupElement = createPopup(popupInnerElement, popupThemeColors.RED);
		await includeHTMLs();
		setDynamicValues({'error-message': {value: errorMessage}});
		showPopup(popupElement);

	} catch (error) {

		/* Show critial error popup */
		await showCriticalErrorPopup(errorMessage);

	}

}

/**
 * Display a minimal error popup if APIs like storage are inaccessible.
 * @param {string} errorMessage - Error message
 */
async function showCriticalErrorPopup(errorMessage) {

	/* Create popup inner element */
	const popupInnerElement = document.createElement('div');
	popupInnerElement.classList.add('bili2vrc-popup-details');
	popupInnerElement.textContent = errorMessage;

	/* Create and show the popup */
	const popupElement = createPopup(popupInnerElement, popupThemeColors.RED);
	showPopup(popupElement);

}

/**
 * Show history deleted popup.
 */
async function showHistoryDeletedPopup() {

	/* Create popup inner element */
	const popupInnerElement = document.createElement('div');
	popupInnerElement.setAttribute('data-bili2vrc-msg-src', 'popup/history-deleted.html');

	/* Create and show the popup */
	const popupElement = createPopup(popupInnerElement);
	await includeHTMLs();
	showPopup(popupElement, 0);

}

//#endregion