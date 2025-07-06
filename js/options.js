'use strict';

/** @type {Array.<Object.<string, string>>} Constant texts */
const constantValues = {
	'version-text': {
		value: getVersionText(),
		attribute: undefined
	},
	'chrome-web-store-url-href': {
		value: 'https://chromewebstore.google.com/detail/fojgodnomgghdjkfohljapkfbgicddpb',
		attribute: 'href'
	},
	'microsoft-edge-addons-url-href': {
		value: 'https://microsoftedge.microsoft.com/addons/detail/nlamopbkkcadijajjipdepfmicngablg',
		attribute: 'href'
	},
	'developer-email-href': {
		value: 'mailto:squidtail.contact@gmail.com',
		attribute: 'href'
	},
	'developer-email': {
		value: 'squidtail.contact@gmail.com',
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
		await setResourceTexts();

		/* Set constant texts */
		setDynamicValues(constantValues);

		/* Reflect option data to option page */
		await SetOptionDataToForm();

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
async function SetOptionDataToForm() {

	/** @type {HTMLFormElement} */
	const form = document.forms['options'];

	/* Set option data to form */
	form.elements['language'].value = await getOptionData(optionKeys.LANGUAGE);
	form.elements['history-retention-period'].value = await getOptionData(optionKeys.HISTORY_RENTENTION_PERIOD);
	form.elements['insert-button-into-video-page'].checked = await getOptionData(optionKeys.INSERT_BUTTON_INTO_VIDEO_PAGE);

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
		await setResourceTexts();

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