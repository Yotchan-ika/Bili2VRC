'use strict';

/** @type {Array.<Object.<string, string>>} Constant texts */
const dynamicValues = {
	'version-text': {
		value: getVersionText(),
		attribute: undefined
	}
};

executeOnWindowLoad(init);

/**
 * Initialization.
 */
async function init() {

	try {

		/* Add event listener */
		document.forms['options'].addEventListener('change', onOptionsChanged);
		document.forms['tabs'].addEventListener('change', setTabVisibility);
		document.getElementById('bili2vrc-view-tutorial-button').addEventListener('click', onViewTutorialButtonClick);
		document.getElementById('bili2vrc-open-changelog-button').addEventListener('click', onOpenChangelogButtonClick);

		/* Set language texts */
		await setLangAttributes();
		await setLocaleTexts();

		/* Set constant texts */
		setDynamicValues(dynamicValues);

		/* Reflect option data to option page */
		await saveOptionDataToForm();

		/* Set visibility of tabs */
		setTabVisibility();

		/* Display content */
		await displayContent();

	} catch (error) {

		/* Display unknown error popup */
		await showUnknownErrorPopup(error.stack);

	}

}

/**
 * Handler executed when the view tutorial button clicked.
 * @param {Event} - Event
 */
async function onViewTutorialButtonClick(event) {

	/* Do not update the page */
	event.preventDefault();

	/* Open the tutorial page */
	await openExtensionsPage('tutorial.html');

}

/**
 * Handler executed when the open changelog button clicked.
 * @param {Event} - Event
 */
async function onOpenChangelogButtonClick(event) {

	/* Do not update the page */
	event.preventDefault();

	/* Open the changelog page */
	await openExtensionsPage('changelog.html');

}

/**
 * Reflect option data to option page.
 */
async function saveOptionDataToForm() {

	/** @type {HTMLFormElement} */
	const form = document.forms['options'];

	/* Set option data to form */
	form.elements['language'].value = await loadOptionData(optionKeys.LANGUAGE);
	form.elements['history-retention-period'].value = await loadOptionData(optionKeys.HISTORY_RENTENTION_PERIOD);
	form.elements['insert-button-into-video-page'].checked = await loadOptionData(optionKeys.INSERT_BUTTON_INTO_VIDEO_PAGE);

}

/**
 * Processing execute when options are changed.
 * @param {Event} event - Event
 */
async function onOptionsChanged(event) {

	try {

		/** @type {HTMLFormElement} */
		const form = document.forms['options'];

		/** @type {Object.<string, *>} Option data */
		const options = {
			[optionKeys.LANGUAGE]: form.elements['language'].value,
			[optionKeys.HISTORY_RENTENTION_PERIOD]: Number(form.elements['history-retention-period'].value),
			[optionKeys.INSERT_BUTTON_INTO_VIDEO_PAGE]: form.elements['insert-button-into-video-page'].checked
		};
		debug.log('options:', options);

		/* Save option data to storage */
		await saveToStorage(storageKeys.OPTIONS, options, true);

		/* Update language texts */
		await setLangAttributes();
		await setLocaleTexts();

	} catch (error) {

		/* Display unknown error popup */
		await showUnknownErrorPopup(error.stack);

	}

}

/**
 * Set visibility of tabs.
 * @param {Event} event - Event
 */
async function setTabVisibility(event) {

	try {

		/** @type {HTMLFormElement} */
		const form = document.forms['tabs'];

		/* Display/hide tab contents */
		const selectedTab = form.elements['tabs'].value;
		document.querySelectorAll('.tab-content').forEach(element => {
			const id = element.getAttribute('id');
			if (id === selectedTab) {
				element.removeAttribute('hidden');
			} else {
				element.setAttribute('hidden', '');
			}
		});

	} catch (error) {

		/* Display unknown error popup */
		await showUnknownErrorPopup(error.stack);

	}

}