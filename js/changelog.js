'use strict';

executeOnWindowLoad(init);

/**
 * Initialization.
 */
async function init() {

	try {

		/* includes HTML content */
		await includeHTMLs();
		await setLangAttributes();
		await setLocaleTexts();

		/* Display content */
		await displayContent();

	} catch (error) {

		/* Display unknown error popup */
		await showUnknownErrorPopup(error.stack);

	}

}