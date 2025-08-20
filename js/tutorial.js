'use strict';

let tutorials;
let currentPageNo;

executeOnWindowLoad(init);

/**
 * Initialization.
 */
async function init() {

	try {

		/* Get unfinished tutorials */
		tutorials = await getUnfinishedTutorials();
		currentPageNo = 0;

		/* Add event listener */
		const backButtonElement = document.getElementById('bili2vrc-back-button');
		const nextButtonElement = document.getElementById('bili2vrc-next-button');
		const closeButtonElement = document.getElementById('bili2vrc-close-button');
		backButtonElement.addEventListener('click', onBackButtonClick);
		nextButtonElement.addEventListener('click', onNextButtonClick);
		closeButtonElement.addEventListener('click', onCloseButtonClick);
		document.forms['options'].addEventListener('change', onOptionsChanged);

		/* Reset tutorials if all tutorials has done */
		if (tutorials.length <= 0) {

			/* Initialize the list of the unfinished tutorials */
			await saveToStorage(storageKeys.FINISHED_TUTORIAL_IDS, []);
			tutorials = await getUnfinishedTutorials();

		}

		/* Set page count text of the page indicator */
		const pageCountElement = document.getElementById('bili2vrc-page-count');
		pageCountElement.textContent = tutorials.length;

		/* Display tutorial page */
		await setTutorialPage();

		/* Register the tutorial as completed */
		const tutorialIDs = tutorials.map(tutorial => tutorial.id);
		await completeTutorials(tutorialIDs);

	} catch (error) {

		/* Display unknown error popup */
		await showUnknownErrorPopup(error.stack);

	} finally {

		/* Display on load */
		await displayContent();

	}

}

/**
 * Handler executed when the back button clicked.
 */
async function onBackButtonClick() {

	/* Decrement the page number */
	if (currentPageNo > 0) {
		currentPageNo--;
		await setTutorialPage();
	}

}

/**
 * Handler executed when the next button clicked.
 */
async function onNextButtonClick() {

	/* Increment the page number */
	if (currentPageNo < tutorials.length - 1) {
		currentPageNo++;
		await setTutorialPage();
	}

}

/**
 * Handler executed when the close button clicked.
 */
async function onCloseButtonClick() {

	/* Close the current tab */
	window.close();

}

/**
 * Processing execute when language option is changed.
 * @param {Event} event - Event
 */
async function onOptionsChanged(event) {

	try {

		/** @type {HTMLFormElement} */
		const form = document.forms['options'];

		/* Save language option */
		await saveOptionData(optionKeys.LANGUAGE, form.elements['language'].value);

		/* Update language texts */
		await setLangAttributes();
		await setResourceTexts();

	} catch (error) {

		/* Display unknown error popup */
		await showUnknownErrorPopup(error.stack);

	}

}

/**
 * Display the tutorial's page.
 */
async function setTutorialPage() {

	/* Get current page's tutorial info */
	const tutorial = tutorials[currentPageNo];

	/* Set title */
	const titleElement = document.getElementById('bili2vrc-title');
	titleElement.setAttribute('data-bili2vrc-msg', tutorial.titleMsgID);

	/* Set description */
	const descriptionElement = document.getElementById('bili2vrc-description');
	descriptionElement.setAttribute('data-bili2vrc-msg', tutorial.descriptionMsgID);

	/* Set video source */
	const videoSourceElement = document.getElementById('bili2vrc-video');
	videoSourceElement.setAttribute('src', tutorial.videoSource);
	videoSourceElement.load();

	/* Set current page No. of the page indicator */
	const currentPageNoElement = document.getElementById('bili2vrc-current-page-no');
	currentPageNoElement.textContent = currentPageNo + 1;

	/* Enable/disable the button */
	const backButtonElement = document.getElementById('bili2vrc-back-button');
	const nextButtonElement = document.getElementById('bili2vrc-next-button');
	if (currentPageNo <= 0) {
		backButtonElement.setAttribute('disabled', '');
	} else {
		backButtonElement.removeAttribute('disabled');
	}
	if (currentPageNo >= tutorials.length - 1) {
		nextButtonElement.setAttribute('disabled', '');
	} else {
		nextButtonElement.removeAttribute('disabled');
	}

	/* Reflect language option to language selector */
	await setLanguageSelector();

	/* Set resource texts */
	await setLangAttributes();
	await setResourceTexts();

}

/**
 * Reflect language option to language selector.
 */
async function setLanguageSelector() {

	/** @type {HTMLFormElement} */
	const form = document.forms['options'];

	/* Set option data to form */
	form.elements['language'].value = await loadOptionData(optionKeys.LANGUAGE);

}