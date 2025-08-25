'use strict';

/**
 * Open the tutorial page.
 */
async function openUnfinishedTutorial() {

	/* Open the page if there are any incomplete tutorials */
	const unfinishedTutorials = await getUnfinishedTutorials();
	if (unfinishedTutorials.length > 0) {
		await openExtensionsPage('tutorial.html');
	}

}

/**
 * Get the list of unfinished tutorials.
 * @returns {Promise.<Array.<Object.<string, string>>>} Unfinished tutorials
 */
async function getUnfinishedTutorials() {

	/** @type {Array.<Object.<string, string>>} Get all tutorial IDs */
	const tutorials = await loadJSONFile('json/tutorials.json');

	/** @type {Array.<string>} Get finished tutorial IDs */
	const finishedTutorialIDs = await loadFromStorage(storageKeys.FINISHED_TUTORIAL_IDS);

	/** @type {Array.<Object.<string, string>>} Get unfinished tutorial IDs */
	const unfinishedTutorials = tutorials.filter(item => {
		const hasFinished = finishedTutorialIDs.some(id => item.id === id);
		return !hasFinished;
	});

	return unfinishedTutorials;

}

/**
 * Register the tutorial as completed.
 * @param {Array.<string>} tutorialIDs - List of Tutorial IDs
 */
async function completeTutorials(tutorialIDs) {

	/** @type {Array.<string>} Get finished tutorial IDs */
	let finishedTutorialIDs = await loadFromStorage(storageKeys.FINISHED_TUTORIAL_IDS);

	/* Register the tutorial as completed */
	finishedTutorialIDs = finishedTutorialIDs.concat(tutorialIDs);
	await saveToStorage(storageKeys.FINISHED_TUTORIAL_IDS, [...new Set(finishedTutorialIDs)]);

}