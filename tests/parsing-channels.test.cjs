'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {test} = require('node:test');

const root = path.resolve(__dirname, '..');
const bvid = 'BV1G88y6xEQV';
const mediaURL = 'https://upos-sz-mirrorcos.bilivideo.com/test/video.mp4';
const mp4Header = Uint8Array.from([0, 0, 0, 32, 102, 116, 121, 112, 105, 115, 111, 109]);

function createContext({options = {}, local = {}, fetch, content = false, sendMessage} = {}) {
	const data = {sync: {options: structuredClone(options)}, local: structuredClone(local)};
	const writes = [];
	const storage = Object.fromEntries(['sync', 'local'].map(area => [area, {
		async get(keys) {
			return Object.fromEntries(keys.filter(key => key in data[area]).map(key => [key, structuredClone(data[area][key])]));
		},
		async set(values) {
			Object.assign(data[area], structuredClone(values));
			writes.push({area, values});
		}
	}]));
	const event = {addListener() {}};
	const context = vm.createContext({
		URL, URLSearchParams, AbortController, Uint8Array, setTimeout, clearTimeout,
		console: {log() {}, warn() {}, error() {}},
		fetch: fetch || (() => { throw new Error('Unexpected network request'); }),
		chrome: {
			storage,
			runtime: {onStartup: event, onInstalled: event, onMessage: event, sendMessage},
			action: {onClicked: event},
			contextMenus: {onClicked: event}
		}
	});
	const files = content
		? ['js/utils/common-utils.js', 'js/utils/history-utils.js', 'js/utils/video-parsing-utils.js']
		: ['js/utils/common-utils.js', 'js/background.js'];
	for (const file of files) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, {filename: file});
	vm.runInContext('debug = {log() {}, warn() {}, error() {}};', context);
	const api = vm.runInContext(`({parsingChannels, optionKeys, normalizeParsingOptions,
		getVideoParsingRequestURL, normalizeParsedVideoURL, loadOptionData,
		${content ? 'requestVideoParsing, getBvidAndPageNoFromURL' : 'fetchVideoParsingData, fetchVerifiedVideoURL, onMessageReceive'}})`, context);
	return {context, api, data, writes};
}

function response(body = mp4Header, {url = mediaURL, status = 206, type = 'video/mp4'} = {}) {
	const value = new Response(body, {status, headers: {'content-type': type}});
	Object.defineProperty(value, 'url', {value: url});
	return value;
}

function plain(value) {
	return JSON.parse(JSON.stringify(value));
}

test('only default and local channels construct their own parameters', () => {
	const {api} = createContext();
	assert.deepEqual(Object.values(api.parsingChannels), ['default', 'local']);
	const defaultURL = api.getVideoParsingRequestURL('default', bvid, 2);
	assert.equal(defaultURL.origin + defaultURL.pathname, 'https://api.squidtail.com/bili2vrc/parse/');
	assert.deepEqual(Object.fromEntries(defaultURL.searchParams), {bv: bvid, p: '2', format: 'mp4', otype: 'json'});
	const local = api.getVideoParsingRequestURL('local', bvid, 2);
	assert.equal(local.origin + local.pathname, 'https://api.bilibili.com/x/web-interface/view');
	assert.deepEqual(Object.fromEntries(local.searchParams), {bvid});
	assert.throws(() => api.getVideoParsingRequestURL('custom', bvid, 1), /Unknown parsing channel/);
	for (const p of [0, -1, 1.5, NaN, Infinity, '2']) {
		assert.throws(() => api.getVideoParsingRequestURL('local', bvid, p), /Invalid video/);
	}
	assert.throws(() => api.getVideoParsingRequestURL('local', 'BVbad&url=evil', 1), /Invalid video/);
});

test('retired channels use the default while obsolete options are removed', () => {
	const {api} = createContext();
	for (const parsingChannel of [undefined, 'retired', 'custom']) {
		const options = api.normalizeParsingOptions({
			parsingChannel, parsingServerEndpoint: 'https://example.com/',
			parsingServerMode: 'redirectUrl', parsingLinkMode: 'service',
			language: 'zh-CN', diagnosticLogLevel: 'error'
		});
		assert.deepEqual(plain(options), {parsingChannel: 'default', language: 'zh-CN', diagnosticLogLevel: 'error'});
	}
	assert.deepEqual(plain(api.normalizeParsingOptions({parsingChannel: 'local'})), {parsingChannel: 'local'});
});

test('migration is persisted once and leaves local history intact', async () => {
	const history = [{historyID: 10, bvid}];
	const {api, data, writes} = createContext({
		options: {parsingChannel: 'retired', parsingServerEndpoint: 'https://example.com/'},
		local: {history}
	});
	assert.equal(await api.loadOptionData(api.optionKeys.PARSING_CHANNEL), 'default');
	assert.equal(await api.loadOptionData(api.optionKeys.PARSING_CHANNEL), 'default');
	assert.deepEqual(data.sync.options, {parsingChannel: 'default'});
	assert.deepEqual(data.local.history, history);
	assert.equal(writes.filter(write => write.area === 'sync').length, 1);
});

test('default JSON channel resolves and validates the returned CDN media', async () => {
	const calls = [];
	const {api} = createContext({fetch: async (url, options) => {
		calls.push({url: String(url), options});
		if (calls.length === 1) return Response.json({code: 0, url: mediaURL, quality: 64});
		return response();
	}});
	const parsed = await api.fetchVideoParsingData('default', bvid, 1);
	assert.equal(parsed.parsedVideoURL, mediaURL);
	assert.equal(parsed.parsedVideoQuality, 64);
	assert.equal(parsed.parsedVideoResponseCode, 0);
	assert.equal(calls.length, 2);
	assert.equal(calls[1].url, mediaURL);
	assert.equal(calls[1].options.headers.Range, 'bytes=0-31');
	assert.equal(calls[1].options.credentials, 'omit');
});

test('unknown channels cannot issue network requests', async () => {
	const {api} = createContext();
	await assert.rejects(api.fetchVideoParsingData('retired', bvid, 1), /Unknown parsing channel/);
});

function localFetch(playback, calls, {backup = false} = {}) {
	return async (url, options) => {
		url = new URL(url);
		calls.push({url, options});
		if (url.pathname === '/x/web-interface/view') {
			return Response.json({code: 0, data: {pages: [{page: 1, cid: 101}, {page: 2, cid: 202}]}});
		}
		if (url.pathname === '/x/player/playurl') return Response.json(playback);
		if (backup && url.toString() === mediaURL) return response('Forbidden', {status: 403});
		return response(mp4Header, {url: url.toString()});
	};
}

test('local parsing uses only Bilibili and CDN requests, with the exact selected page', async () => {
	const calls = [];
	const {api} = createContext({fetch: localFetch({code: 0, data: {quality: 64, durl: [{url: mediaURL}]}}, calls)});
	const parsed = await api.fetchVideoParsingData('local', bvid, 2);
	assert.equal(parsed.parsedVideoURL, mediaURL);
	assert.equal(parsed.parsedVideoQuality, 64);
	assert.equal(calls.length, 3);
	assert.equal(calls[1].url.hostname, 'api.bilibili.com');
	assert.equal(calls[1].url.searchParams.get('cid'), '202');
	assert.equal(calls[1].url.searchParams.get('bvid'), bvid);
	assert.equal(calls[1].url.searchParams.get('platform'), 'html5');
	assert.equal(calls[1].url.searchParams.get('type'), 'mp4');
	assert.equal(calls[1].url.searchParams.get('fnval'), '0');
	assert.ok(calls.every(call => call.options.credentials === 'omit'));
});

test('local parsing rejects missing pages without using the first page instead', async () => {
	const calls = [];
	const {api} = createContext({fetch: localFetch({code: 0}, calls)});
	await assert.rejects(api.fetchVideoParsingData('local', bvid, 3), /no CID for page 3/);
	assert.equal(calls.length, 1);
});

test('local parsing rejects previews, DASH-only and incomplete multi-segment results', async () => {
	for (const data of [
		{is_preview: 1, durl: [{url: mediaURL}]},
		{dash: {video: [{baseUrl: mediaURL}], audio: [{}]}},
		{durl: [{url: mediaURL}, {url: mediaURL + '?part=2'}]},
		{durl: []}
	]) {
		const calls = [];
		const {api} = createContext({fetch: localFetch({code: 0, data}, calls)});
		await assert.rejects(api.fetchVideoParsingData('local', bvid, 1), /preview|single MP4/);
		assert.equal(calls.length, 2);
	}
});

test('local parsing reports Bilibili errors without falling back to a third-party parser', async () => {
	const calls = [];
	const {api} = createContext({fetch: localFetch({code: -412, message: 'Request blocked'}, calls)});
	await assert.rejects(api.fetchVideoParsingData('local', bvid, 1), /code -412: Request blocked/);
	assert.equal(calls.length, 2);
});

test('local parsing can use an official backup URL when the first CDN fails', async () => {
	const calls = [];
	const backupURL = 'https://upos-sz-mirrorali.bilivideo.com/test/video.mp4';
	const {api} = createContext({fetch: localFetch({code: 0, data: {
		quality: 64, durl: [{url: mediaURL, backup_url: [backupURL]}]
	}}, calls, {backup: true})});
	const parsed = await api.fetchVideoParsingData('local', bvid, 1);
	assert.equal(parsed.parsedVideoURL, backupURL);
	assert.equal(calls.length, 4);
});

test('validation rejects unavailable, expired, non-MP4 and spoofed media', async () => {
	const cases = [
		[() => response('Forbidden', {status: 403, type: 'text/html'}), /HTTP 403/],
		[() => response('<html>error</html>', {type: 'text/html'}), /did not return MP4/],
		[() => response('not really an mp4 file'), /invalid MP4 content/],
		[() => response('short'), /incomplete MP4/],
		[() => response(mp4Header, {url: mediaURL + '?deadline=1'}), /expired/],
		[() => response(mp4Header, {url: 'https://bilivideo.com.evil.test/video.mp4'}), /invalid MP4 URL/]
	];
	for (const [makeResponse, error] of cases) {
		const {api} = createContext({fetch: async () => makeResponse()});
		await assert.rejects(api.fetchVerifiedVideoURL(mediaURL), error);
	}
});

test('MP4 header validation handles split chunks and cancels the media body', async () => {
	let canceled = false;
	const body = new ReadableStream({
		start(controller) {
			controller.enqueue(mp4Header.slice(0, 6));
			controller.enqueue(mp4Header.slice(6));
		},
		cancel() { canceled = true; }
	});
	const {api} = createContext({fetch: async () => response(body)});
	assert.equal(await api.fetchVerifiedVideoURL(mediaURL), mediaURL);
	assert.equal(canceled, true);
});

test('JSON errors are surfaced without fetching or copying an absent video', async () => {
	let calls = 0;
	const {api} = createContext({fetch: async () => { calls++; return Response.json({code: 500, message: 'Provider unavailable'}); }});
	const parsed = await api.fetchVideoParsingData('default', bvid, 1);
	assert.equal(parsed.parsedVideoResponseCode, 1);
	assert.equal(parsed.parsedVideoResponseMessage, 'Provider unavailable');
	assert.equal(parsed.parsedVideoURL, undefined);
	assert.equal(calls, 1);
});

test('malformed JSON success results cannot bypass CDN URL validation', async () => {
	for (const data of [null, {}, {code: '0', url: mediaURL}, {code: 0}, {code: 0, url: 'https://example.com/video.mp4'}]) {
		const {api} = createContext({fetch: async () => Response.json(data)});
		await assert.rejects(api.fetchVideoParsingData('default', bvid, 1));
	}
});

test('timeouts cover stalled response bodies for JSON and media requests', async () => {
	for (const kind of ['json', 'media']) {
		const {api, context} = createContext({fetch: async (url, options) => response(new ReadableStream({
			start(controller) {
				options.signal.addEventListener('abort', () => controller.error(new Error('Request aborted')));
			}
		}), {type: kind === 'json' ? 'application/json' : 'video/mp4'})});
		context.setTimeout = callback => setTimeout(callback, 5);
		const request = kind === 'json' ? api.fetchVideoParsingData('default', bvid, 1) : api.fetchVerifiedVideoURL(mediaURL);
		await assert.rejects(request, /aborted/);
	}
});

function createContent({channel = 'local', history = [], validate = true, fail = false} = {}) {
	const copied = [];
	const messages = [];
	const setup = createContext({
		content: true,
		options: {parsingChannel: channel, historyRententionPeriod: 168},
		local: {history, parsingStatus: 'parsable', lastParsingTimestamp: 0},
		sendMessage: async message => {
			messages.push(message);
			if (message.action === 'validateVideoURL') return {status: validate ? 'successful' : 'error', url: message.url};
			if (fail) return {status: 'error', message: 'Provider failed'};
			return {status: 'successful', response: {parsedVideoURL: mediaURL, parsedVideoResponseCode: 0}};
		}
	});
	setup.context.captureClipboard = text => copied.push(text);
	vm.runInContext(`
		getDetailedVideoInfo = async () => ({title: 'Test video'});
		writeTextToClipboard = async text => captureClipboard(text);
		showProcessingPopup = async () => {};
		showParsingSuccessfulPopup = async () => {};
		showClipboardWriteSuccessfulPopup = async () => {};
		showFetchFailedPopup = async () => {};
		showUnknownErrorPopup = async () => {};
		showClipboardWriteFailedPopup = async () => {};
		showTooFrequentParsingRequest = () => {};
		showInvalidURLPopup = async () => {};
	`, setup.context);
	return {...setup, copied, messages};
}

test('invalid page numbers are rejected before requesting or copying a video', async () => {
	for (const p of ['0', '-1', '1.5', 'NaN', 'Infinity', '9007199254740992']) {
		const {api, copied, messages} = createContent();
		const url = `https://www.bilibili.com/video/${bvid}/?p=${p}`;
		assert.throws(() => api.getBvidAndPageNoFromURL(url), /Invalid video page/);
		assert.equal(await api.requestVideoParsing(url), false);
		assert.deepEqual(messages, []);
		assert.deepEqual(copied, []);
	}
});

test('click flow copies CDN results for both channels and records the provider', async () => {
	for (const channel of ['default', 'local']) {
		const {api, data, copied, messages, context} = createContent({channel});
		assert.equal(await api.requestVideoParsing(`https://www.bilibili.com/video/${bvid}/?p=2`), true);
		assert.deepEqual(copied, [mediaURL]);
		assert.equal(messages[0].action, 'fetchVideoParsingData');
		assert.equal(messages[0].channel, channel);
		assert.equal(messages[0].p, 2);
		assert.equal(data.local.history[0].parsingChannel, channel);
		assert.equal(data.local.parsingStatus, 'parsable');
		assert.equal(vm.runInContext('typeof composeAndCopyVideoURL', context), 'undefined');
	}
});

test('failed parsing does not overwrite the clipboard and unlocks the request', async () => {
	const {api, copied, data} = createContent({fail: true});
	assert.equal(await api.requestVideoParsing(`https://www.bilibili.com/video/${bvid}/`), false);
	assert.deepEqual(copied, []);
	assert.equal(data.local.parsingStatus, 'parsable');
	const logs = data.local.diagnosticLogs;
	assert.equal(logs.length, 1);
	assert.equal(logs[0].level, 'error');
	const detail = JSON.parse(logs[0].message.slice('parse '.length));
	assert.equal(detail.channel, 'local');
	assert.equal(detail.bvid, bvid);
	assert.equal(detail.phase, 'response');
	assert.deepEqual(detail.response, {status: 'error', message: 'Provider failed'});
});

test('other-channel and untagged legacy history are not reused', async () => {
	for (const parsingChannel of ['default', undefined]) {
		const {api, copied, messages} = createContent({history: [{
			bvid, p: 1, parsingChannel, parsedVideoURL: mediaURL + '?old', lastParsingTimestamp: Date.now()
		}]});
		assert.equal(await api.requestVideoParsing(`https://www.bilibili.com/video/${bvid}/`), true);
		assert.equal(messages[0].action, 'fetchVideoParsingData');
		assert.deepEqual(copied, [mediaURL]);
	}
});

test('same-channel history is validated before reuse and re-parsed when invalid', async () => {
	for (const validate of [true, false]) {
		const {api, copied, messages} = createContent({validate, history: [{
			bvid, p: 1, parsingChannel: 'local', parsedVideoURL: mediaURL, lastParsingTimestamp: Date.now()
		}]});
		assert.equal(await api.requestVideoParsing(`https://www.bilibili.com/video/${bvid}/`), true);
		assert.deepEqual(copied, [mediaURL]);
		assert.equal(messages[0].action, 'validateVideoURL');
		assert.equal(messages.length, validate ? 1 : 2);
	}
});

test('expired cached links are parsed again without attempting to copy them', async () => {
	const {api, copied, messages} = createContent({history: [{
		bvid, p: 1, parsingChannel: 'local', parsedVideoURL: mediaURL + '?deadline=1', lastParsingTimestamp: Date.now()
	}]});
	assert.equal(await api.requestVideoParsing(`https://www.bilibili.com/video/${bvid}/`), true);
	assert.equal(messages[0].action, 'fetchVideoParsingData');
	assert.deepEqual(copied, [mediaURL]);
});

test('options expose only the two channels and every locale includes their labels', () => {
	const html = fs.readFileSync(path.join(root, 'options.html'), 'utf8');
	assert.doesNotMatch(html, /parsing-server-endpoint|parsing-server-mode|parsing-link-mode/);
	const select = html.match(/<select name="parsing-channel"[^>]*>([\s\S]*?)<\/select>/)[1];
	assert.equal((select.match(/<option /g) || []).length, 2);
	const keys = [...html.matchAll(/data-bili2vrc-(?:msg|i18n)="([^"]+)"/g)].map(match => match[1]);
	for (const locale of ['en', 'zh_CN', 'zh_TW', 'ja']) {
		const messages = JSON.parse(fs.readFileSync(path.join(root, '_locales', locale, 'messages.json'), 'utf8'));
		for (const key of keys) {
			assert.ok(messages[key]?.message, `${locale}: ${key}`);
			assert.doesNotMatch(messages[key].message, /\?{2,}/, `${locale}: ${key}`);
		}
	}
	const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
	for (const entry of manifest.web_accessible_resources) {
		for (const file of entry.resources) assert.ok(fs.existsSync(path.join(root, file)), file);
	}
});
