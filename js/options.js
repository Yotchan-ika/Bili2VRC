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
		document.getElementById('bili2vrc-export-diagnostics-button').addEventListener('click', onExportDiagnosticsButtonClick);
		document.getElementById('bili2vrc-reset-parsing-server-endpoint-button').addEventListener('click', onResetParsingServerEndpointButtonClick);

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
 * Handler executed when the reset parsing server endpoint button clicked.
 * @param {Event} event - Event
 */
async function onResetParsingServerEndpointButtonClick(event) {

	/* Do not update the page */
	event.preventDefault();

	/** @type {HTMLFormElement} */
	const form = document.forms['options'];

	form.elements['parsing-server-endpoint'].value = defaultVideoParsingEndpoint;
	form.elements['parsing-server-mode'].value = parsingServerModes.JSON;

	await onOptionsChanged(event);

}

/**
 * Reflect option data to option page.
 */
async function saveOptionDataToForm() {

	/** @type {HTMLFormElement} */
	const form = document.forms['options'];

	/* Set option data to form */
	form.elements['language'].value = await loadOptionData(optionKeys.LANGUAGE);
	form.elements['appearance-theme'].value = await loadOptionData(optionKeys.APPEARANCE_THEME);
	form.elements['history-retention-period'].value = await loadOptionData(optionKeys.HISTORY_RENTENTION_PERIOD);
	form.elements['insert-button-into-video-page'].checked = await loadOptionData(optionKeys.INSERT_BUTTON_INTO_VIDEO_PAGE);
	form.elements['parsing-server-endpoint'].value = await loadOptionData(optionKeys.PARSING_SERVER_ENDPOINT);
	form.elements['parsing-server-mode'].value = await loadOptionData(optionKeys.PARSING_SERVER_MODE);
	form.elements['diagnostic-log-level'].value = await loadOptionData(optionKeys.DIAGNOSTIC_LOG_LEVEL);

}

/**
 * Handler executed when the export diagnostics button clicked.
 * @param {Event} event - Event
 */
async function onExportDiagnosticsButtonClick(event) {

	try {

		/* Do not update the page */
		event.preventDefault();

		const diagnostics = await createDiagnosticsExportData();
		const blob = new Blob([JSON.stringify(diagnostics, null, '\t')], {type: 'application/json'});
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `bili2vrc-diagnostics-${Date.now()}.json`;
		link.click();
		URL.revokeObjectURL(url);

	} catch (error) {

		/* Display unknown error popup */
		await showUnknownErrorPopup(error.stack);

	}

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
			[optionKeys.APPEARANCE_THEME]: normalizeAppearanceTheme(form.elements['appearance-theme'].value),
			[optionKeys.HISTORY_RENTENTION_PERIOD]: Number(form.elements['history-retention-period'].value),
			[optionKeys.INSERT_BUTTON_INTO_VIDEO_PAGE]: form.elements['insert-button-into-video-page'].checked,
			[optionKeys.PARSING_SERVER_ENDPOINT]: normalizeParsingServerEndpoint(form.elements['parsing-server-endpoint'].value),
			[optionKeys.PARSING_SERVER_MODE]: normalizeParsingServerMode(form.elements['parsing-server-mode'].value),
			[optionKeys.DIAGNOSTIC_LOG_LEVEL]: normalizeDiagnosticLogLevel(form.elements['diagnostic-log-level'].value)
		};
		debug.log('options:', options);

		/* Save option data to storage */
		await saveToStorage(storageKeys.OPTIONS, options, true);

		/* Update language texts */
		await applyAppearanceTheme();
		await setLangAttributes();
		await setLocaleTexts();

	} catch (error) {

		/* Display unknown error popup */
		await showUnknownErrorPopup(error.stack);

	}

}

/**
 * Normalize appearance theme option.
 * @param {string} theme - Appearance theme
 * @returns {string} Normalized appearance theme
 */
function normalizeAppearanceTheme(theme) {

	if (Object.values(appearanceThemes).includes(theme)) {
		return theme;
	}

	return appearanceThemes.AUTO;

}

/**
 * Normalize diagnostic log level option.
 * @param {string} logLevel - Diagnostic log level
 * @returns {string} Normalized diagnostic log level
 */
function normalizeDiagnosticLogLevel(logLevel) {

	if (Object.values(diagnosticLogLevels).includes(logLevel)) {
		return logLevel;
	}

	return diagnosticLogLevels.ERROR;

}

/**
 * Normalize parsing server mode option.
 * @param {string} mode - Server mode
 * @returns {string} Normalized server mode
 */
function normalizeParsingServerMode(mode) {

	if (Object.values(parsingServerModes).includes(mode)) {
		return mode;
	}

	return parsingServerModes.JSON;

}

/**
 * Normalize parsing server endpoint option.
 * @param {string} endpoint - Server endpoint
 * @returns {string} Normalized endpoint
 */
function normalizeParsingServerEndpoint(endpoint) {

	try {
		const url = new URL(endpoint);
		if (['http:', 'https:'].includes(url.protocol) === false) {
			throw new Error('Unsupported protocol');
		}
		return url.toString();
	} catch (error) {
		return defaultVideoParsingEndpoint;
	}

}

/**
 * Create diagnostics export data from selected categories.
 * @returns {Promise.<Object.<string, *>>} Diagnostics export data
 */
async function createDiagnosticsExportData() {

	/** @type {HTMLFormElement} */
	const form = document.forms['options'];

	const diagnostics = {
		generatedAt: new Date().toISOString(),
		extensionVersion: getVersionText(),
		userAgent: navigator.userAgent,
		selected: {
			logs: form.elements['diagnostics-include-logs'].checked,
			options: form.elements['diagnostics-include-options'].checked,
			history: form.elements['diagnostics-include-history'].checked
		},
		data: {}
	};

	if (diagnostics.selected.logs) {
		diagnostics.data.logs = await loadFromStorage(storageKeys.DIAGNOSTIC_LOGS);
	}
	if (diagnostics.selected.options) {
		diagnostics.data.options = await loadFromStorage(storageKeys.OPTIONS, true);
	}
	if (diagnostics.selected.history) {
		diagnostics.data.history = await loadFromStorage(storageKeys.HISTORY);
	}

	return diagnostics;

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
