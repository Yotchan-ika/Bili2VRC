'use strict';

executeOnWindowLoad(init);

/**
 * Handler executed when video parsing button left-clicked.
 * @param {Event} event - Event
 */
async function onVideoParsingButtonLeftClick(event) {

	/* Parse the video */
	await requestVideoParsing(window.location.href);

}

/**
 * Handler executed when video parsing button right-clicked.
 * @param {Event} event - Event
 */
async function onVideoParsingButtonRightClick(event) {

	try {

		/* Do not display default context menu */
		event.preventDefault();

		/* Display context menu element */
		const contextMenuElement = document.getElementById('bili2vrc-context-menu');
		contextMenuElement.style.display = 'block';

		/* Display the context menu at the mouse cursor position */
		const left = event.pageX - (contextMenuElement.getBoundingClientRect().width / 2);
		const top = event.pageY + 15;
		contextMenuElement.style.left = left + 'px';
		contextMenuElement.style.top = top + 'px';

	} catch (error) {

		/* Display unknown error popup */
		await showUnknownErrorPopup(error.stack);

	}

}

/**
 * Handler executed when document clicked.
 * @param {Event} event - Event
 */
async function onDocumentClick(event) {

	try {

		/* Hide context menu element */
		const contextMenuElement = document.getElementById('bili2vrc-context-menu');
		contextMenuElement.style.display = 'none';

	} catch (error) {

		/* Display unknown error popup */
		await showUnknownErrorPopup(error.stack);

	}

}

/**
 * Handler executed when the context menu clicked.
 * @param {Event} event - Event
 */
async function onContextMenuClick(event) {

	try {

		/* Get context menu ID */
		const target = event.currentTarget;
		const contextMenuID = target.getAttribute('data-bili2vrc-context-menu-id');

		switch (contextMenuID) {

			/* Parse the video*/
			case 'parseVideo':
				await requestVideoParsing(window.location.href);
				break;

			/* Video parsing history */
			case 'videoParsingHistory':
				await openExtensionsPage('history.html');
				break;

			/* Options */
			case 'options':
				await openExtensionsPage('options.html');
				break;

			/* Unknown context menu */
			default:
				throw new Error('Unknown context menu item');

		}

	} catch (error) {

		/* Display unknown error popup */
		await showUnknownErrorPopup(error.stack);

	}

}

/**
 * Insert the context menu and video parsing button.
 */
async function onDataLoad() {

	try {

		/* Add event listeners */
		document.addEventListener('click', onDocumentClick);

		/* Insert the context menu */
		await insertContextMenu();
		debug.log('Successfully inserted the context menu.');

		/* Insert the video parsing button */
		await insertVideoParsingButton();
		debug.log('Successfully inserted the video parsing button.');

	} catch (error) {

		/* Display unknown error popup */
		await showUnknownErrorPopup(error.stack);

	}

}

/**
 * Initialization.
 * @returns {Promise.<boolean>} True: successful, False: failed
 */
async function init() {

	try {

		const now = Date.now();

		/* Begin listening for messages */
		const browserObj = getBrowserObject();
		browserObj.runtime.onMessage.addListener(onMessageReceive);

		/* Reset parsing status */
		await saveToStorage(storageKeys.PARSING_STATUS, parsingStatuses.PARSABLE);

		/* Delete old parsing history */
		await deleteOldHistory(now);

		/* If the video parsing button or the context menu already exists, remove it */
		const videoParsingButtonElement = document.getElementById('bili2vrc-parse-video-button');
		const contextMenuElement = document.getElementById('bili2vrc-context-menu');
		if (videoParsingButtonElement) {
			debug.warn('Removed the video parsing button because it already exists.');
			videoParsingButtonElement.remove();
		}
		if (contextMenuElement) {
			debug.warn('Removed the context menu because it already exists.')
			contextMenuElement.remove();
		}

		/* If the current tab's URL is not a video page, skip the subsequent operations */
		if (isValidURL(window.location.href) === false) {
			debug.log('Video parsing not supported.');
			return false;
		}

		/* If button insertion is disabled on the video page, skip the subsequent operations */
		const insertButtonIntoVideoPage = await getOptionData(optionKeys.INSERT_BUTTON_INTO_VIDEO_PAGE);
		if (insertButtonIntoVideoPage === false) {
			debug.log('Button insertion on the video page is disabled.');
			return false;
		}

		/* Wait for data loading to complete */
		await waitForDataLoadComplete();

		return true;

	} catch (error) {

		/* Display unknown error popup */
		await showUnknownErrorPopup(error.stack);

		return false;

	}

}

/**
 * Wait for data loading to complete, and insert parse video button.
 */
async function waitForDataLoadComplete() {

	/* Get HTML element with the attribute "data-loaded" */
	const dataLoadedFlagElement = document.querySelector('[data-loaded]');

	/* If the element exists and the attribute "data-loaded" is true, insert parse video button */
	if (dataLoadedFlagElement) {
		const dataLoadedFlag = dataLoadedFlagElement.getAttribute('data-loaded');
		if (dataLoadedFlag === 'true') {
			try {
				onDataLoad();
			} catch (error) {
				debug.log('Failed to insert the parse video button.');
			}
			return;
		}
	}

	/* Retry */
	setTimeout(async () => {
		await waitForDataLoadComplete();
	}, 500);

}

/**
 * Insert parse video button into the video page.
 */
async function insertVideoParsingButton() {

	/* Create video parsing button */
	const videoParsingButtonElement = await createVideoParsingButton();
	videoParsingButtonElement.addEventListener('click', onVideoParsingButtonLeftClick);
	videoParsingButtonElement.addEventListener('contextmenu', onVideoParsingButtonRightClick);

	/* Insert parse video button into toolbar element */
	const toolbarRightElement = document.querySelector('.video-toolbar-right');
	const toolbarRightElementLastChild = toolbarRightElement.children[toolbarRightElement.children.length - 1];
	toolbarRightElement.insertBefore(videoParsingButtonElement, toolbarRightElementLastChild);

	/* Set resource texts */
	await setResourceTexts();

}

/**
 * Create HTML element of the video parsing button.
 * @returns {Promise.<HTMLDivElement>} Video parsing button element
 */
async function createVideoParsingButton() {

	/* Load HTML of the parse vide button icon */
	const htmlText = await loadTextFile('images/ButtonIcon_24x24.html');

	/* Create text element */
	const VideoParsingButtonTextElement = document.createElement('span');
	VideoParsingButtonTextElement.setAttribute('data-bili2vrc-msg', 'content_parseVideoButton_buttonText');
	VideoParsingButtonTextElement.classList.add('video-toolbar-item-text');

	/* Create button inner element */
	const videoParsingButtonInnerElement = document.createElement('div');
	videoParsingButtonInnerElement.classList.add('bili2vrc-video-parse-video-inner');
	videoParsingButtonInnerElement.innerHTML = htmlText;
	videoParsingButtonInnerElement.appendChild(VideoParsingButtonTextElement);

	/* Create button element */
	const videoParsingButtonElement = document.createElement('div');
	videoParsingButtonElement.setAttribute('id', 'bili2vrc-parse-video-button');
	videoParsingButtonElement.classList.add('bili2vrc-video-parse-video');
	videoParsingButtonElement.classList.add('video-toolbar-right-item');
	videoParsingButtonElement.appendChild(videoParsingButtonInnerElement);

	return videoParsingButtonElement;

}

/**
 * Create context menu and insert it into the video page.
 */
async function insertContextMenu() {

	/* Insert context menu element into the body */
	const contextMenuElement = createContextMenuElement();
	document.body.appendChild(contextMenuElement);

	/* Set resource texts */
	await setResourceTexts();

}

/**
 * Create context menu element.
 * @returns {HTMLDivElement} Context menu element
 */
function createContextMenuElement() {

	/* Create context menu items */
	const contextMenuParseVideoElement = document.createElement('li');
	contextMenuParseVideoElement.setAttribute('data-bili2vrc-context-menu-id', 'parseVideo');
	contextMenuParseVideoElement.setAttribute('data-bili2vrc-msg', 'content_contextMenu_parseVideo');
	contextMenuParseVideoElement.addEventListener('click', onContextMenuClick);

	const contextMenuVideoParsingHistoryElement = document.createElement('li');
	contextMenuVideoParsingHistoryElement.setAttribute('data-bili2vrc-context-menu-id', 'videoParsingHistory');
	contextMenuVideoParsingHistoryElement.setAttribute('data-bili2vrc-msg', 'content_contextMenu_videoParsingHistory');
	contextMenuVideoParsingHistoryElement.addEventListener('click', onContextMenuClick);

	const contextMenuOptionsElement = document.createElement('li');
	contextMenuOptionsElement.setAttribute('data-bili2vrc-context-menu-id', 'options');
	contextMenuOptionsElement.setAttribute('data-bili2vrc-msg', 'content_contextMenu_options');
	contextMenuOptionsElement.addEventListener('click', onContextMenuClick);

	/* Create unordered list element */
	const ulElement = document.createElement('ul');
	ulElement.appendChild(contextMenuParseVideoElement);
	ulElement.appendChild(contextMenuVideoParsingHistoryElement);
	ulElement.appendChild(contextMenuOptionsElement);

	/* Create context menu element */
	const contextMenuElement = document.createElement('div');
	contextMenuElement.setAttribute('id', 'bili2vrc-context-menu');
	contextMenuElement.setAttribute('style', 'display: none;');
	contextMenuElement.classList.add('bili2vrc-context-menu');
	contextMenuElement.appendChild(ulElement);

	return contextMenuElement;

}