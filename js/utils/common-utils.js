'use strict';

//	===========================================================================================
//		Constant
//	===========================================================================================

//	-----------------------------------------------------------
//		Contant
//	-----------------------------------------------------------

//#region Constant

/** @type {Array.<string>} Supported language list */
const supportedLanguages = ['en', 'zh-CN', 'zh-TW', 'ja'];

/** @type {Object.<string, string>} */
const parsingStatuses = Object.freeze({
	PARSABLE: 'parsable',
	PARSING: 'parsing'
});

/** @type {Object.<string, *>} Storage keys */
const storageKeys = Object.freeze({
	OPTIONS: 'options',
	HISTORY: 'history',
	PARSING_STATUS: 'parsingStatus',
	LAST_PARSING_TIMESTAMP: 'lastParsingTimestamp',
	FINISHED_TUTORIAL_IDS: 'finishedTutorialIDs'
});

/** @type {Object.<string, *>} Option data keys */
const optionKeys = Object.freeze({
	LANGUAGE: 'language',
	HISTORY_RENTENTION_PERIOD: 'historyRententionPeriod',
	INSERT_BUTTON_INTO_VIDEO_PAGE: 'insertButtonIntoVideoPage'
});

/** @type {Object.<string, *>} Default storage data */
const defaultStorageData = Object.freeze({
	[storageKeys.OPTIONS]: {
		[optionKeys.LANGUAGE]: 'default',
		[optionKeys.HISTORY_RENTENTION_PERIOD]: 168,
		[optionKeys.INSERT_BUTTON_INTO_VIDEO_PAGE]: true
	},
	[storageKeys.HISTORY]: [],
	[storageKeys.PARSING_STATUS]: parsingStatuses.PARSABLE,
	[storageKeys.LAST_PARSING_TIMESTAMP]: 0,
	[storageKeys.FINISHED_TUTORIAL_IDS]: []
});

/** @type {RegExp} Regexp to get BVID */
const getBVIDRegexp = /https:\/\/www.bilibili.com\/.*(BV[a-zA-Z0-9]{10})/;

//#endregion

//	-----------------------------------------------------------
//		Custom Object
//	-----------------------------------------------------------

//#region Custom Object

/** @type {Object.<string, Function>} Custom console object */
let debug = {
	log: (...args) => console.log('[Bili2VRC]', ...args),
	warn: (...args) => console.warn('[Bili2VRC]', ...args),
	error: (...args) => console.error('[Bili2VRC]', ...args)
};

//#endregion

//	===========================================================================================
//		Module Function
//	===========================================================================================

//	-----------------------------------------------------------
//		Getter
//	-----------------------------------------------------------

//#region Getter

/**
 * Get browser object.
 * @returns {Object.<string, *>} Browser object
 */
function getBrowserObject() {

	if (typeof browser !== 'undefined') {
		return browser;
	} else if (typeof chrome !== 'undefined') {
		return chrome;
	} else {
		throw new Error('This browser not supported');
	}

}

/**
 * Get current version text.
 * @returns {string} Version text
 */
function getVersionText() {

	/* Get browser object */
	const browserObj = getBrowserObject();

	/* Get version text from manifest */
	const versionText = browserObj.runtime.getManifest().version;

	return versionText;

}

/**
 * Get current language code.
 * @returns {Promise.<string>} Current language code
 */
async function getCurrentLanguage() {

	/* Get browser object */
	const browserObj = getBrowserObject();

	/* Find current language code */
	const optionLanguage = await getOptionData(optionKeys.LANGUAGE);
	const UILanguage = browserObj.i18n.getUILanguage();
	let currentLanguage;
	if (optionLanguage === 'default') {
		if (supportedLanguages.includes(UILanguage)) {
			currentLanguage = UILanguage;
		} else {
			currentLanguage = supportedLanguages[0];
		}
	} else {
		currentLanguage = optionLanguage;
	}

	return currentLanguage;

}

/**
 * Get UI language code.
 * @returns {Promise.<string>} UI language code
 */
async function getUILanguage() {

	/* Get browser object */
	const browserObj = getBrowserObject();

	/* Find UI language code */
	const UILanguage = browserObj.i18n.getUILanguage();
	if (supportedLanguages.includes(UILanguage)) {
		return UILanguage;
	} else {
		return supportedLanguages[0];
	}

}

/**
 * Get messages in specified language.
 * @param {string} lang - Language code
 * @returns {Promise.<Object.<string, Object.<string, string>>>} Message
 */
async function getMessages(lang) {
	try {
		const path = `_locales/${lang.replaceAll('-', '_')}/messages.json`;
		const messages = await loadJSONFile(path);
		return messages;
	} catch (error) {
		throw new Error('Failed to read messages');
	}
}

/**
 * Get option data.
 * @param {string} key Key of the option data
 * @returns {Promise.<*>} Option data
 */
async function getOptionData(key) {

	/* Get option data from storage */
	const options = await loadFromStorage(storageKeys.OPTIONS, true) || {};
	const defaultOptions = defaultStorageData[storageKeys.OPTIONS];

	/* If the key is missing from the object,
	   return a default value and save it by adding it to the options data */
	if (key in options === false) {
		if (key in defaultOptions === false) {
			throw new Error(`Unknown option data key "${key}"`)
		}
		options[key] = defaultOptions[key];
		await saveToStorage(storageKeys.OPTIONS, options, true);
		debug.log(`New option data "${key}" created.`);
		debug.log('Option data:', options);
	}

	return options[key];

}

/**
 * Check whether the current tab's URL is valid.
 * @param {string} currentTabURL Current tab's URL
 * @returns {boolean} True: valid, False: invalid
 */
function isValidURL(currentTabURL) {

	/* Check whether the current tab's URL includes BVID */
	const regexpResult = currentTabURL.match(getBVIDRegexp) || undefined;

	return (
		currentTabURL.startsWith('https://www.bilibili.com/') &&
		regexpResult !== undefined
	);

}

/**
 * Get formatted date and time in current language.
 * @param {number} timestamp - Timestamp
 * @param {Object.<string, *>} options - Format options
 * @returns {Promise.<string>} Formatted date and time
 */
async function getFormattedDatetime(timestamp, options) {

	/* Get current language code */
	const currentLanguage = await getOptionData(optionKeys.LANGUAGE);

	/* Format date and time */
	const formatter = Intl.DateTimeFormat(currentLanguage, options);
	const formattedDatetime = formatter.format(timestamp);

	return formattedDatetime;

}

//#endregion

//	-----------------------------------------------------------
//		HTML Control
//	-----------------------------------------------------------

//#region HTML Control

/**
 * Execute when the window is loaded.
 * @param {Function} callback - Callback function
 */
function executeOnWindowLoad(callback) {

	/* If the window is already loaded, execute immediately */
	if (document.readyState === 'complete') {
		callback();
	} else {
		window.addEventListener('load', callback);
	}

}

/**
 * Set lang attributes with the attribute "data-bili2vrc-set-lang-attribute".
 */
async function setLangAttributes() {

	/* Get current language */
	const currentLanguage = await getCurrentLanguage();

	/* Set value lang attribute to HTML elements has attribute "data-bili2vrc-set-lang-attribute" */
	document.querySelectorAll('[data-bili2vrc-set-lang-attribute]').forEach(element => {
		element.setAttribute('lang', currentLanguage);
	});

}

/**
 * Set resource texts in selected language.
 */
async function setResourceTexts() {

	/* Get current language code */
	const currentLanguage = await getCurrentLanguage();

	/* Get UI language code */
	const UILanguage = await getUILanguage();

	/* Set resource texts in option's language */
	let id;
	for (const element of document.querySelectorAll('[data-bili2vrc-msg]')) {
		try {
			id = element.getAttribute('data-bili2vrc-msg');
			const messages = await getMessages(currentLanguage);
			element.innerHTML = messages[id].message;
			element.setAttribute('lang', currentLanguage);
		} catch (error) {
			debug.error(`Cannot read message of "${id}" in "${currentLanguage}".`);
			element.innerHTML = '### RESOURCE ERROR ###';
		}
	}

	/* Set resource texts in UI language */
	for (const element of document.querySelectorAll('[data-bili2vrc-i18n]')) {
		try {
			id = element.getAttribute('data-bili2vrc-i18n');
			const messages = await getMessages(UILanguage);
			element.innerHTML = messages[id].message;
			element.setAttribute('lang', UILanguage);
		} catch (error) {
			debug.error(`Cannot read message of "${id}" in "${currentLanguage}".`);
			element.innerHTML = '### RESOURCE ERROR ###';
		}
	}

}

/**
 * Includes HTML content in the HTML element with the attribute "bili2vrc-i18n-src".
 */
async function includeHTMLs() {

	/* Get current language */
	const currentLanguage = await getCurrentLanguage();

	/* Set HTML content */
	let src;
	for (const element of document.querySelectorAll('[data-bili2vrc-msg-src]')) {
		try {
			src = element.getAttribute('data-bili2vrc-msg-src');
			const path = `html/${currentLanguage}/${src}`;
			const html = await loadTextFile(path);
			element.innerHTML = html;
			element.setAttribute('lang', currentLanguage);
		} catch (error) {
			debug.error(`Cannot load HTML of "${src}" in "${currentLanguage}"`);
			element.innerHTML = '### HTML SOURCE ERROR ###';
		}
	}

}

/**
 * Set values to the document body dynamically.
 * @param {Object.<string, Object.<string, string>>} values
 */
function setDynamicValues(values) {

	/* Set constant texts to HTML elements */
	document.querySelectorAll('[data-bili2vrc-dynamic-value]').forEach(element => {
		const attributeValues = element.getAttribute('data-bili2vrc-dynamic-value').split(' ');
		attributeValues.forEach(id => {
			if (id in values) {
				if (values[id].attribute) {
					element.setAttribute(values[id].attribute, values[id].value);
				} else {
					const textNode = document.createTextNode(values[id].value);
					element.replaceChildren(textNode);
				}
			}
		});
	});

}

/**
 * Display content when the window loaded.
 */
async function displayContent() {

	/* Display the HTML elements with the attribute "data-bili2vrc-display-on-load" */
	document.querySelectorAll('[data-bili2vrc-display-on-load]').forEach(element => {
		element.removeAttribute('hidden');
	});

}

//#endregion

//	-----------------------------------------------------------
//		Storage API
//	-----------------------------------------------------------

//#region Storage API

/**
 * Load data from storage.
 * @param {string} key - Key
 * @param {boolean} isSynced - Whether to save to synced storage
 * @returns {Promise.<*>} Value
 */
async function loadFromStorage(key, isSynced = false) {

	/* Check storage key */
	if (isCorrectStorageKey(key) === false) {
		throw new Error('Unknown storage key');
	}

	/* Get browser object */
	const browserObj = getBrowserObject();

	/* Load data from storage */
	let result;
	try {
		if (isSynced) {
			result = await browserObj.storage.sync.get([key]);
		} else {
			result = await browserObj.storage.local.get([key]);
		}
	} catch (error) {
		throw new Error(`Failed to load "${key}" from storage`);
	}

	/* Return the value if the data exists */
	if (key in result) {
		if (result[key] !== undefined && result[key] !== null) {
			return result[key];
		}
	}

	/* If the value is not found, store the default data and return it */
	await saveToStorage(key, defaultStorageData[key], isSynced);
	debug.log(`New storage data "${key}" created:`, defaultStorageData[key]);
	return defaultStorageData[key];

}

/**
 * Save data to storage.
 * @param {string} key - Key
 * @param {*} value - Value
 * @param {boolean} isSynced - Whether to save to local storage
 */
async function saveToStorage(key, value, isSynced = false) {

	/* Check storage key */
	if (isCorrectStorageKey(key) === false) {
		throw new Error('Unknown storage key');
	}

	/* If the value is undefined/null, then throw error */
	if (value === undefined || value === null) {
		throw new Error('Cannot save undefined/null to the storage');
	}

	/* Get browser object */
	const browserObj = getBrowserObject();

	/* Save data to storage */
	try {
		if (isSynced) {
			await browserObj.storage.sync.set({[key]: value});
		} else {
			await browserObj.storage.local.set({[key]: value});
		}
	} catch (error) {
		throw new Error(`Failed to save "${key}" to storage`);
	}

}

/**
 * Check whether the storage key isn't unknown.
 * @param {string} key Storage key
 * @returns {boolean} True: correct, False: incorrect
 */
function isCorrectStorageKey(key) {
	return Object.keys(storageKeys).some(keyName => storageKeys[keyName] === key);
}

//#endregion

//	-----------------------------------------------------------
//		Tabs API
//	-----------------------------------------------------------

//#region Tabs API

/**
 * Open the extension's page.
 */
async function openExtensionsPage(path) {

	/* Get browser object */
	const browserObj = getBrowserObject();

	/* Get URL */
	const targetURL = browserObj.runtime.getURL(path);

	/* Open the extension's page */
	if (browserObj.tabs) {

		/* Get all tabs */
		const tabs = await browserObj.tabs.query({});

		/* If the tab is already open, activate that tab */
		const targetTab = tabs.find(tab => tab.url === targetURL || tab.pendingUrl === targetURL);
		if (targetTab) {
			await browserObj.tabs.update(targetTab.id, {active: true});
		} else {
			await browserObj.tabs.create({url: targetURL, active: true});
		}

	} else {

		/* Request opening the extension's page to the background script */
		browserObj.runtime.sendMessage({action: 'openExtensionPage', path: path});

	}

}

//#endregion

//	-----------------------------------------------------------
//		File I/O
//	-----------------------------------------------------------

//#region File I/O

/**
 * Load text file.
 * @param {string} path - File path to load
 * @returns {Promise.<string>} Loaded text
 */
async function loadTextFile(path) {

	/* Load text file */
	const browserObj = getBrowserObject();
	const url = browserObj.runtime.getURL(path);
	const response = await fetch(url);
	const text = await response.text();

	return text;

}

/**
 * Load JSON file.
 * @param {string} path - File path to load
 * @returns {Promise.<Object.<string, *>>} Loaded text
 */
async function loadJSONFile(path) {

	/* Load text file */
	const browserObj = getBrowserObject();
	const url = browserObj.runtime.getURL(path);
	const response = await fetch(url);
	const json = await response.json();

	return json;

}

//#endregion