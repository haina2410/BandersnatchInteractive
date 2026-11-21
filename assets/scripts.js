/*
 * This is free and unencumbered software released into the public domain.
 *
 * Anyone is free to copy, modify, publish, use, compile, sell, or
 * distribute this software, either in source code form or as a compiled
 * binary, for any purpose, commercial or non-commercial, and by any
 * means.
 *
 * In jurisdictions that recognize copyright laws, the author or authors
 * of this software dedicate any and all copyright interest in the
 * software to the public domain. We make this dedication for the benefit
 * of the public at large and to the detriment of our heirs and
 * successors. We intend this dedication to be an overt act of
 * relinquishment in perpetuity of all present and future rights to this
 * software under copyright law.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR
 * OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
 * ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 * OTHER DEALINGS IN THE SOFTWARE.
 *
 * For more information, please refer to <http://unlicense.org>
 */

// Data
var segmentMap = SegmentMap;
var bv = bandersnatch.videos['80988062'].interactiveVideoMoments.value;
var choicePoints = bv.choicePointNavigatorMetadata.choicePointsMetadata.choicePoints;
var momentsBySegment = bv.momentsBySegment;
var segmentGroups = bv.segmentGroups;

// Transation of choices
var moments = JSON.parse(JSON.stringify(momentsBySegment));

var translated_choices = en;

function switch_choices() {

	for (var key in translated_choices) {

		for (var i = 0; i < Object.keys(moments[key]).length; i++) {

			if ("choices" in moments[key][i]) {

				for (var k = 0; k < Object.keys(moments[key][i]["choices"]).length; k++) {

					if ("id" in moments[key][i]["choices"][k]) {

						if (moments[key][i]["choices"][k]['id'] in translated_choices[key]) {

							moments[key][i]["choices"][k]['text'] = translated_choices[key][moments[key][i]["choices"][k]["id"]];

						}
					}
				}
			}
		}
	}

	return moments;
}

// Persistent state
var ls = window.localStorage || {};
if (!('initialized' in ls)) {
	for (let k in bv.stateHistory)
		ls["persistentState_" + k] = JSON.stringify(bv.stateHistory[k]);
	ls['initialized'] = 't';
}

function msToString(ms) {
	return new Date(ms).toUTCString().split(' ')[4];
}

function getCurrentMs() {
	return Math.round(document.getElementById("video").currentTime * 1000.0);
}

function preconditionToJS(cond) {
	if (cond[0] == 'persistentState') {
		return 'JSON.parse(ls["persistentState_' + cond[1] + '"])';
	} else if (cond[0] == 'not') {
		return '!(' + preconditionToJS(cond[1]) + ')';
	} else if (cond[0] == 'and') {
		return '(' + cond.slice(1).map(preconditionToJS).join(' && ') + ')';
	} else if (cond[0] == 'or') {
		return '(' + cond.slice(1).map(preconditionToJS).join(' || ') + ')';
	} else if (cond[0] == 'eql' && cond.length == 3) {
		return '(' + cond.slice(1).map(preconditionToJS).join(' == ') + ')';
	} else if (cond === false) {
		return 'false';
	} else if (cond === true) {
		return 'true';
	} else if (typeof cond === 'string') {
		return JSON.stringify(cond);
	} else {
		console.log('unsupported condition!', cond);
		return 'true';
	}
}

function evalPrecondition(precondition, text) {
	if (precondition) {
		let cond = preconditionToJS(precondition);
		let match = eval(cond);
		console.log('precondition', text, ':', cond, '==', match);
		return match;
	}

	return true;
}

function checkPrecondition(preconditionId) {
	return evalPrecondition(bv.preconditions[preconditionId], preconditionId);
}

function resolveSegmentGroup(sg) {
	let results = [];
	for (let v of segmentGroups[sg]) {
		if (v.precondition) {
			if (!checkPrecondition(v.precondition))
				continue;
		}
		if (v.segmentGroup) {
			results.push(resolveSegmentGroup(v.segmentGroup));
		} else if (v.segment) {
			results.push(v.segment);
		} else {
			if (!checkPrecondition(v))
				continue;
			results.push(v);
		}
	}
	console.log('segment group', sg, '=>', results);
	return results[0];
}

/// Returns the segment ID at the given timestamp.
/// There will be exactly one segment for any timestamp within the video file.
function getSegmentId(ms) {
	for (const [k, v] of Object.entries(segmentMap.segments)) {
		if (ms >= v.startTimeMs && (!v.endTimeMs || ms < v.endTimeMs)) {
			return k;
		}
	}
	return null;
}

function getSegmentMs(segmentId) {
	return segmentMap.segments[segmentId].startTimeMs;
}

function getMoments(segmentId, ms) {
	let result = {};
	let moments = momentsBySegment[segmentId] || [];
	for (let i = 0; i < moments.length; i++) {
		let m = moments[i];
		let momentId = segmentId + '/' + i;
		if (ms >= m.startMs && ms < m.endMs && evalPrecondition(m.precondition, 'moment ' + momentId)) {
			result[momentId] = m;
		}
	}
	return result;
}

function newList(id) {
	var ul = document.getElementById(id);
	while (ul.firstChild) {
		ul.removeChild(ul.firstChild);
	}
	return ul;
}
// Viewer preferences. They stay when the saved choices are erased.
function getPref(name) {
	return ls['pref_' + name];
}

function setPref(name, value) {
	try {
		ls['pref_' + name] = String(value);
	} catch (error) {
		// Storage can be full or blocked. The preference then applies to this visit only.
	}
}

// Links for the hidden debug lists.
function addItem(ul, text, url) {
	const li = document.createElement('li');
	const link = document.createElement('a');
	link.textContent = text;
	link.href = url;
	li.append(link);
	ul.append(li);
}

const CODE_LENGTH = 5;
let selectedDigits = [];
let codeLocked = false;
var currentChoiceMoment = null;

function addChoiceButton(ul, item, index) {
	const li = document.createElement('li');
	const button = document.createElement('button');
	button.type = 'button';
	button.className = 'choice';
	button.setAttribute('aria-pressed', 'false');

	const key = document.createElement('span');
	key.className = 'choice-key';
	key.setAttribute('aria-hidden', 'true');
	key.textContent = index + 1;

	const label = document.createElement('span');
	label.className = 'choice-text';
	if (item.image) {
		button.classList.add('choice-image');
		button.setAttribute('aria-label', item.text);
		label.style.backgroundImage = item.image.styles.backgroundImage;

		// Show the words when the picture does not load.
		const picture = new Image();
		picture.onerror = function () {
			button.classList.remove('choice-image');
			label.style.backgroundImage = '';
			label.textContent = item.text;
		};
		picture.src = item.image.styles.backgroundImage.replace(/^url\(["']?|["']?\)$/g, '');
	} else {
		label.textContent = item.text;
	}

	button.append(key, label);
	button.addEventListener('click', () => choice(index));
	li.append(button);
	ul.append(li);
}

function addKeypad(ul) {
	selectedDigits = [];
	codeLocked = false;

	const li = document.createElement('li');
	li.className = 'containerCode';

	const fields = document.createElement('div');
	fields.className = 'input-container';
	fields.setAttribute('role', 'img');
	for (let index = 0; index < CODE_LENGTH; index++) {
		const field = document.createElement('span');
		field.className = 'inputField';
		fields.append(field);
	}

	const keypad = document.createElement('div');
	keypad.className = 'buttonsCode';
	for (const digit of [1, 2, 3, 4, 5, 6, 7, 8, 9, 0]) {
		const button = document.createElement('button');
		button.type = 'button';
		button.textContent = digit;
		button.addEventListener('click', () => selectDigit(digit));
		keypad.append(button);
	}

	li.append(fields, keypad);
	ul.append(li);
	updateCode();
}

var nextChoice = -1;
var nextSegment = null;

function addZones(segmentId) {
	var ul = newList("interactionZones");
	let caption = 'currentSegment(' + segmentId + ')';
	addItem(ul, caption, 'javascript:playSegment("' + segmentId + '")', false);

	var segment = segmentMap.segments[segmentId];
	if (segment && segment.ui && segment.ui.interactionZones) {
		var index = 0;
		for (var z of segment.ui.interactionZones) {
			var startMs = z[0];
			var stopMs = z[1];
			let caption = segmentId + ' interactionZone ' + index;
			addItem(ul, caption, 'javascript:seek(' + startMs + ')', false);
			index++;
		}
	}

	ul = newList("nextSegments");
	if (segment) {
		for (const [k, v] of Object.entries(segment.next)) {
			let caption = k;
			if (segment.defaultNext == k)
				caption = '[' + caption + ']';
			addItem(ul, caption, 'javascript:playSegment("' + k + '")', false);
		}
	}
}


function selectDigit(digit) {
	if (codeLocked || selectedDigits.length >= CODE_LENGTH)
		return;

	selectedDigits.push(digit);
	updateCode();

	if (selectedDigits.length == CODE_LENGTH) {
		codeLocked = true;
		for (const button of document.querySelectorAll('.buttonsCode button'))
			button.disabled = true;
		let code = currentChoiceMoment.choices[0].code || '20541';
		choice(selectedDigits.join('') == code ? 0 : 1);
	}
}

function deleteDigit() {
	if (codeLocked || !selectedDigits.length)
		return false;
	selectedDigits.pop();
	updateCode();
	return true;
}

function updateCode() {
	const fields = document.querySelectorAll('.inputField');
	fields.forEach((field, index) => {
		field.textContent = index < selectedDigits.length ? selectedDigits[index] : '';
	});
	if (fields.length)
		fields[0].parentNode.setAttribute('aria-label', 'Number: ' + (selectedDigits.join(' ') || 'empty'));
}

// A number key picks a choice, or types a digit when the keypad shows.
function pressChoiceKey(digit) {
	if (!currentChoiceMoment)
		return false;
	if (document.querySelector('.containerCode')) {
		selectDigit(digit);
		return true;
	}
	if (digit >= 1 && digit <= document.querySelectorAll('#choices .choice').length) {
		choice(digit - 1);
		return true;
	}
	return false;
}

function setChoiceHint(text) {
	const hint = document.getElementById("choiceHint");
	hint.textContent = text;
	hint.hidden = !text;
}

function markChoice(choiceIndex) {
	const ul = document.getElementById("choices");
	ul.classList.add('has-pick');
	ul.querySelectorAll('.choice').forEach((button, index) => {
		button.setAttribute('aria-pressed', String(index == choiceIndex));
	});
	setChoiceHint('');
}

function addChoices(r) {
	currentChoiceMoment = r;
	nextChoice = -1;
	var ul = newList("choices");
	ul.classList.remove('has-pick');
	setChoiceHint('');
	document.getElementById("choiceCaption").innerHTML = '';
	if (!r) return;

	nextChoice = r.defaultChoiceIndex;
	if (r.type == "scene:cs_bs_phone") {
		addKeypad(ul);
		setChoiceHint('Enter the 5-digit number.');
	} else {
		r.choices.forEach((x, index) => addChoiceButton(ul, x, index));
		let fallback = r.choices[r.defaultChoiceIndex];
		if (r.choices.length > 1 && fallback && fallback.text)
			setChoiceHint('No answer picks ' + fallback.text + '.');
	}

	if (r.id in choicePoints)
		document.getElementById("choiceCaption").innerHTML = choicePoints[r.id].description;
}

function momentStart(m, seeked) {
	console.log('momentStart', m, seeked);
	if (m.choices) {
		addChoices(m);
	}
	if (!seeked)
		applyImpression(m.impressionData);
}

function momentUpdate(m, ms) {
	//console.log('momentUpdate', m);
	if (m.choices) {
		var p = 100 - ((ms - m.startMs) * 100.0 / (m.endMs - m.startMs));
		document.getElementById("progress").style.width = p + '%';
	}
}

function momentEnd(m, seeked) {
	console.log('momentEnd', m, seeked);
	if (m.choices) {
		addChoices(null);
		document.getElementById("progress").style.width = 0;
	}
}

var timerId = 0;
var lastMs = 0;
var currentSegment;
var lastSegment = null;
var prevSegment = null; // for breadcrumbs
var segmentTransition = false;
var lastMoments = [];

function ontimeupdate(evt) {
	var ms = getCurrentMs();
	currentSegment = getSegmentId(ms);
	let segment = segmentMap.segments[currentSegment];

	if (timerId) {
		clearTimeout(timerId);
		timerId = 0;
	}

	// Distinguish between the user seeking manually with <video> controls,
	// and the video playing normally (past some timestamp / boundary).
	let timeElapsed = ms - lastMs;
	let seeked = timeElapsed < 0 || timeElapsed >= 2000;
	lastMs = ms;

	// Recalculate title and hash only when we pass some meaningful timestamp.
	let placeChanged = false;

	// Handle segment change
	if (lastSegment != currentSegment) {
		console.log('ontimeupdate', lastSegment, '->', currentSegment, ms, msToString(ms), seeked);
		prevSegment = lastSegment;
		lastSegment = currentSegment;
		if (currentSegment)
			ls['seen_' + currentSegment] = '1';
		if (!seeked && prevSegment) {
			if (playNextSegment(prevSegment)) {
				// playSegment decided to seek, which means that this
				// currentSegment is invalid, and a recursive
				// ontimeupdate invocation should have taken care of
				// things already. Return.
				return;
			}
		}
		addZones(currentSegment);
		placeChanged = true;
	}

	var naturalTransition = !seeked || segmentTransition;
	segmentTransition = false;

	var currentMoments = getMoments(currentSegment, ms);
	for (let k in lastMoments)
		if (!(k in currentMoments)) {
			momentEnd(lastMoments[k], !naturalTransition);
			placeChanged = true;
		}
	for (let k in lastMoments)
		if (k in currentMoments)
			momentUpdate(lastMoments[k], ms);
	for (let k in currentMoments)
		if (!(k in lastMoments)) {
			momentStart(currentMoments[k], !naturalTransition);
			placeChanged = true;
		}
	lastMoments = currentMoments;

	if (placeChanged) {
		let title = 'Bandersnatch';
		title += ' - Chapter ' + currentSegment;
		for (let k in currentMoments) {
			let m = currentMoments[k];
			if (m.type.substr(0, 6) == 'scene:') {
				if (m.id && m.id in choicePoints && choicePoints[m.id].description)
					title += ' - Choice "' + choicePoints[m.id].description + '"';
				else
					title += ' - Choice ' + (m.id || k);
			}
		}
		document.title = title;

		let hash = currentSegment;
		// Pick the moment which starts closer to the current timestamp.
		let bestMomentStart = segment ? segment.startTimeMs : 0;
		for (let k in currentMoments) {
			let m = currentMoments[k];
			if (m.startMs > bestMomentStart) {
				hash = k;
				bestMomentStart = m.startMs;
			}
		}
		hash = '#' + hash;
		lastHash = hash; // suppress onhashchange event
		location.hash = hash;
		ls.place = hash;
	}

	// ontimeupdate resolution is about a second. Augment it using timer.
	let nextEvent = segment ? segment.endTimeMs : 0;
	for (let k in currentMoments) {
		let m = currentMoments[k];
		if (m.endMs < nextEvent)
			nextEvent = m.endMs;
	}
	for (let m of momentsBySegment[currentSegment] || [])
		if (ms < m.startMs && m.startMs < nextEvent)
			nextEvent = m.startMs;
	var timeLeft = nextEvent - ms;
	if (timeLeft > 0)
		timerId = setTimeout(ontimeupdate, timeLeft);
}

function playNextSegment(prevSegment) {
	let nextSegment = null;
	if (nextChoice >= 0) {
		let x = currentChoiceMoment.choices[nextChoice];
		if (x.segmentId)
			nextSegment = x.segmentId;
		else if (x.sg)
			nextSegment = resolveSegmentGroup(x.sg);
		else
			nextSegment = null;
		console.log('choice', nextChoice, 'nextSegment', nextSegment);
		nextChoice = -1;
		applyImpression(x.impressionData);
	}

	if (!nextSegment && prevSegment && prevSegment in segmentGroups)
		nextSegment = resolveSegmentGroup(prevSegment);

	if (!nextSegment && prevSegment && segmentMap.segments[prevSegment].defaultNext)
		nextSegment = segmentMap.segments[prevSegment].defaultNext;

	if (!nextSegment)
		return false;

	let breadcrumb = 'breadcrumb_' + nextSegment;
	if (!(breadcrumb in ls))
		ls[breadcrumb] = prevSegment;

	segmentTransition = true;
	return playSegment(nextSegment, true);
}

function jumpForward() {
	var ms = getCurrentMs();
	var segmentId = getSegmentId(ms);

	var interactionMs = 0;
	let moments = momentsBySegment[segmentId] || [];
	// Find the earliest moment within this segment after cursor
	for (let m of moments)
		if (m.startMs > ms && (interactionMs == 0 || m.startMs < interactionMs))
			interactionMs = m.startMs;

	segmentTransition = true;
	if (interactionMs) {
		seek(interactionMs);
	} else {
		playNextSegment(segmentId);
	}
}

function jumpBack() {
	var ms = getCurrentMs();
	var segmentId = getSegmentId(ms);
	let segment = segmentMap.segments[segmentId];

	var interactionMs = 0;
	let moments = momentsBySegment[segmentId] || [];
	let inMoment = false;
	// Find the latest moment within this segment before cursor
	for (let m of moments) {
		if (m.endMs < ms && m.startMs > interactionMs)
			interactionMs = m.startMs;
		if (m.startMs != segment.startTimeMs && m.startMs <= ms && ms < m.endMs)
			inMoment = true;
	}

	segmentTransition = true;
	if (interactionMs) {
		seek(interactionMs);
	} else if (inMoment) {
		seek(segment.startTimeMs);
	} else {
		let breadcrumb = 'breadcrumb_' + segmentId;
		if (breadcrumb in ls) {
			// Jump to last moment in previous segment
			segmentId = ls[breadcrumb];
			segment = segmentMap.segments[segmentId];

			interactionMs = segment.startTimeMs;
			let moments = momentsBySegment[segmentId] || [];
			for (let m of moments)
				if (m.startMs > interactionMs)
					interactionMs = m.startMs;
			seek(interactionMs);
		} else {
			seek(0);
		}
	}
}

function toggleFullScreen() {
	console.log('toggleFullScreen');
	var c = document.getElementById("c");
	if (!document.fullscreenElement && !document.mozFullScreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) {
		if (c.requestFullscreen) {
			c.requestFullscreen();
		} else if (c.msRequestFullscreen) {
			c.msRequestFullscreen();
		} else if (c.mozRequestFullScreen) {
			c.mozRequestFullScreen();
		} else if (c.webkitRequestFullscreen) {
			c.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
		}
	} else {
		if (document.exitFullscreen) {
			document.exitFullscreen();
		} else if (document.msExitFullscreen) {
			document.msExitFullscreen();
		} else if (document.mozCancelFullScreen) {
			document.mozCancelFullScreen();
		} else if (document.webkitExitFullscreen) {
			document.webkitExitFullscreen();
		}
	}
}

const VIDEO_URL = 'https://drive.haina.id.vn/f/dyfz/movie.mkv';

document.addEventListener('DOMContentLoaded', function () {
	const video = document.getElementById('video');
	const player = document.getElementById('wrapper-video');
	const startScreen = document.getElementById('start-screen');
	const startButton = document.getElementById('start-button');
	const startLabel = document.getElementById('start-label');
	const restartButton = document.getElementById('restart-button');
	const resetButton = document.getElementById('reset-history');
	const resetConfirm = document.getElementById('reset-confirm');
	const muteButton = document.getElementById('btn-mute');
	const volumeBar = document.getElementById('volume');
	const buffering = document.getElementById('buffering');
	const toastBox = document.getElementById('toast');

	const status = document.getElementById('start-status');
	const choiceTranslation = document.getElementById('choice-translation');
	const controls = document.getElementById('video-controls');
	const playButton = document.getElementById('btn-play');
	const subtitles = document.getElementById('subtitles');

	let starting = false;
	let timelineReady = false;
	let hideTimer;
	let toastTimer;
	let bufferTimer;
	let startOver = false;
	let controlsWereVisible = false;

	function applyChoiceLanguage() {
		translated_choices = window[choiceTranslation.value];
		momentsBySegment = switch_choices();
	}

	choiceTranslation.addEventListener('change', function () {
		applyChoiceLanguage();
		setPref('choices', choiceTranslation.value);
	});

	// Use the saved language, or the browser language when the film has it.
	const preferredLanguage = getPref('choices') || (navigator.language || '').slice(0, 2);
	if (preferredLanguage !== choiceTranslation.value
		&& Array.from(choiceTranslation.options).some(option => option.value === preferredLanguage)) {
		choiceTranslation.value = preferredLanguage;
		applyChoiceLanguage();
	}

	function showResetConfirm(show) {
		resetButton.hidden = show;
		resetConfirm.hidden = !show;
		(show ? document.getElementById('reset-no') : resetButton).focus();
	}

	resetButton.addEventListener('click', () => showResetConfirm(true));
	document.getElementById('reset-no').addEventListener('click', () => showResetConfirm(false));
	document.getElementById('reset-yes').addEventListener('click', reset);

	// The start screen offers to continue when there is a saved or linked place.
	function refreshStart() {
		const canResume = Boolean(ls.place) || window.location.hash.length > 1;
		startLabel.textContent = canResume ? 'Continue watching' : 'Play film';
		restartButton.hidden = !canResume;
		document.getElementById('scenes-seen').textContent =
			'Scenes seen: ' + countScenesSeen() + ' of ' + Object.keys(segmentMap.segments).length;
	}

	function setLoading(loading) {
		startScreen.classList.toggle('is-loading', loading);
		startButton.disabled = loading;
		restartButton.disabled = loading;
		if (loading)
			startLabel.textContent = 'Loading…';
		else
			refreshStart();
	}

	function toast(text) {
		toastBox.textContent = text;
		toastBox.hidden = false;
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => { toastBox.hidden = true; }, 1200);
	}

	function prepareTimeline() {
		if (!starting || timelineReady || video.readyState < HTMLMediaElement.HAVE_METADATA)
			return;

		timelineReady = true;
		if (startOver || (!playHash(window.location.hash) && !playHash(ls.place)))
			playSegment(null);
	}

	function showMediaError() {
		const wasPlaying = !player.hidden;
		const moveFocus = wasPlaying || starting;
		const mediaError = video.error;
		starting = false;
		timelineReady = false;
		lastHash = '';
		clearTimeout(timerId);
		timerId = 0;
		player.hidden = true;
		startScreen.hidden = false;
		setLoading(false);
		startLabel.textContent = 'Try again';
		status.textContent = mediaError && mediaError.code === MediaError.MEDIA_ERR_NETWORK
			? 'The connection to the video stopped. Try again to continue.'
			: 'This browser could not open the video. Try again, or use Chrome or Edge on a device that plays HEVC video.';
		if (document.fullscreenElement)
			document.exitFullscreen().catch(() => {});
		if (moveFocus)
			startButton.focus();
	}

	async function playVideo() {
		try {
			await video.play();
			if (starting) {
				starting = false;
				startScreen.hidden = true;
				player.hidden = false;
				setLoading(false);
				status.textContent = '';
				video.focus();
				showControls();
			}
		} catch (error) {
			if (video.error) {
				showMediaError();
			} else if (starting) {
				starting = false;
				setLoading(false);
				status.textContent = 'The film did not start. Select the button again.';
				startButton.focus();
			}
		}
	}

	function togglePlayPause() {
		if (video.paused)
			playVideo();
		else
			video.pause();
	}

	video.addEventListener('loadedmetadata', prepareTimeline);
	video.addEventListener('error', showMediaError);
	video.addEventListener('timeupdate', function () {
		if (timelineReady)
			ontimeupdate();
	});

	function begin(fromStart) {
		starting = true;
		startOver = fromStart;
		setLoading(true);
		status.textContent = '';
		if (video.error)
			video.load();
		if (timelineReady && fromStart)
			playSegment(null);
		prepareTimeline();
		playVideo();
	}

	startButton.addEventListener('click', () => begin(false));
	restartButton.addEventListener('click', () => begin(true));
	refreshStart();

	function exitToMenu() {
		video.pause();
		if (document.fullscreenElement)
			document.exitFullscreen().catch(() => {});
		player.hidden = true;
		startScreen.hidden = false;
		refreshStart();
		startButton.focus();
	}

	document.getElementById('btn-exit').addEventListener('click', exitToMenu);

	if (VIDEO_URL) {
		video.src = VIDEO_URL;
	} else {
		startButton.disabled = true;
		status.textContent = 'Video source pending.';
	}

	function updateControls() {
		playButton.dataset.state = video.paused ? 'paused' : 'playing';
		playButton.setAttribute('aria-label', video.paused ? 'Play' : 'Pause');
	}

	playButton.addEventListener('click', togglePlayPause);
	document.getElementById('btn-replay').addEventListener('click', () => seekBy(-10000));
	document.getElementById('btn-forward').addEventListener('click', () => seekBy(10000));
	document.getElementById('btn-previous').addEventListener('click', jumpBack);
	document.getElementById('btn-next').addEventListener('click', jumpForward);
	document.getElementById('btn-fullscreen').addEventListener('click', toggleFullScreen);

	for (const event of ['play', 'pause'])
		video.addEventListener(event, updateControls);

	// Volume
	const savedVolume = Number(getPref('volume'));
	if (getPref('volume') !== undefined && savedVolume >= 0 && savedVolume <= 1)
		video.volume = savedVolume;
	video.muted = getPref('muted') === 'true';

	function updateVolume() {
		const silent = video.muted || video.volume === 0;
		volumeBar.value = silent ? 0 : Math.round(video.volume * 100);
		volumeBar.style.setProperty('--fill', volumeBar.value + '%');
		muteButton.dataset.state = silent ? 'muted' : 'on';
		muteButton.setAttribute('aria-label', silent ? 'Unmute' : 'Mute');
		setPref('volume', video.volume);
		setPref('muted', video.muted);
	}

	function toggleMute() {
		if (video.muted || video.volume === 0) {
			video.muted = false;
			if (video.volume === 0)
				video.volume = 0.5;
		} else {
			video.muted = true;
		}
	}

	muteButton.addEventListener('click', toggleMute);
	volumeBar.addEventListener('input', function () {
		video.volume = volumeBar.value / 100;
		video.muted = false;
	});
	video.addEventListener('volumechange', updateVolume);
	updateVolume();

	// Show the loading sign only when the wait is longer than a moment.
	function setBuffering(waiting) {
		clearTimeout(bufferTimer);
		if (waiting)
			bufferTimer = setTimeout(() => { buffering.hidden = false; }, 400);
		else
			buffering.hidden = true;
	}

	video.addEventListener('waiting', () => setBuffering(true));
	for (const event of ['playing', 'canplay', 'error', 'emptied'])
		video.addEventListener(event, () => setBuffering(false));

	const tracks = Array.from(video.textTracks);
	for (const [index, track] of tracks.entries())
		subtitles.add(new Option(track.label, String(index)));

	function updateSubtitles() {
		const activeTrack = tracks.findIndex(track => track.mode === 'showing');
		subtitles.value = activeTrack < 0 ? '' : String(activeTrack);
	}

	function showSubtitles(value) {
		for (const [index, track] of tracks.entries())
			track.mode = String(index) === value ? 'showing' : 'disabled';
	}

	subtitles.addEventListener('change', function () {
		showSubtitles(subtitles.value);
		setPref('subtitles', subtitles.value === '' ? '' : tracks[Number(subtitles.value)].label);
	});
	video.textTracks.addEventListener('change', updateSubtitles);

	// Apply the saved subtitle language. Without one, the default track shows.
	const savedSubtitles = getPref('subtitles');
	if (savedSubtitles !== undefined) {
		for (const element of video.querySelectorAll('track[default]'))
			element.removeAttribute('default');
		const index = tracks.findIndex(track => track.label === savedSubtitles);
		showSubtitles(index < 0 ? '' : String(index));
	}
	updateSubtitles();

	function showControls() {
		player.classList.add('controls-visible');
		player.classList.remove('is-idle');
		clearTimeout(hideTimer);
		if (!video.paused)
			hideTimer = setTimeout(hideControls, 3000);
	}

	function hideControls() {
		// Stay visible while the pointer is on the playback bar.
		if (controls.matches(':hover')) {
			hideTimer = setTimeout(hideControls, 3000);
			return;
		}
		player.classList.remove('controls-visible');
		player.classList.add('is-idle');
	}

	player.addEventListener('pointerdown', function (event) {
		controlsWereVisible = event.pointerType !== 'touch' || player.classList.contains('controls-visible');
	}, true);
	player.addEventListener('pointermove', showControls);
	player.addEventListener('keydown', showControls);
	video.addEventListener('play', showControls);
	video.addEventListener('pause', showControls);
	video.addEventListener('click', function () {
		// On a touch screen, the first tap only shows the controls.
		if (controlsWereVisible)
			togglePlayPause();
		else
			showControls();
	});
	video.addEventListener('dblclick', toggleFullScreen);

	document.addEventListener('keydown', function (event) {
		if (player.hidden || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
			return;
		if (event.target instanceof Element
			&& (event.target.closest('input, select') || (event.code === 'Space' && event.target.closest('button, a'))))
			return;

		const digit = /^(?:Digit|Numpad)(\d)$/.exec(event.code);
		if (digit) {
			if (pressChoiceKey(Number(digit[1])))
				event.preventDefault();
			return;
		}

		switch (event.code) {
			case 'KeyF': toggleFullScreen(); break;
			case 'KeyR': playSegment(null); toast('From the beginning'); break;
			case 'Space':
			case 'KeyK': togglePlayPause(); break;
			case 'ArrowLeft': seekBy(-10000); toast('−10 s'); break;
			case 'ArrowRight': seekBy(10000); toast('+10 s'); break;
			case 'KeyM': toggleMute(); toast(video.muted ? 'Sound off' : 'Sound on'); break;
			case 'KeyJ': jumpBack(); toast('Previous scene'); break;
			case 'KeyL': jumpForward(); toast('Next scene'); break;
			case 'Backspace':
				if (!deleteDigit())
					return;
				break;
			default: return;
		}
		event.preventDefault();
	});

	window.addEventListener('hashchange', function () {
		if (timelineReady)
			playHash(window.location.hash);
	});
});

function seek(ms) {
	console.log('seek', ms);
	document.getElementById("video").currentTime = ms / 1000.0;
	ontimeupdate(null);
}

// The start and end of the scene (segment) at the given timestamp.
function getSceneRange(ms) {
	var segment = segmentMap.segments[getSegmentId(ms)];
	var durationMs = Math.round((document.getElementById("video").duration || 0) * 1000);
	if (!segment)
		return { startMs: 0, endMs: durationMs };
	return { startMs: segment.startTimeMs, endMs: segment.endTimeMs || durationMs };
}

// Seek, but stay in the scene. A seek past the end stops just before it, and
// the film then continues to the scene that the choices select.
function seekInScene(scene, ms) {
	var lastMs = Math.max(scene.startMs, scene.endMs - 500);
	seek(Math.round(Math.min(lastMs, Math.max(scene.startMs, ms))));
}

// Seek relative to the current position (delta in milliseconds; negative rewinds).
function seekBy(deltaMs) {
	var ms = getCurrentMs();
	seekInScene(getSceneRange(ms), ms + deltaMs);
}

function choice(choiceIndex) {
	if (!currentChoiceMoment)
		return;
	nextChoice = choiceIndex;
	markChoice(choiceIndex);
	if (!currentChoiceMoment.config.disableImmediateSceneTransition)
		playNextSegment(prevSegment);
}

function applyImpression(impressionData) {
	if (impressionData && impressionData.type == 'userState') {
		// some choices (e.g. SS8 "GET RABBIT FROM DAD") carry userState with empty data
		for (const [variable, value] of Object.entries(impressionData.data.persistent || {})) {
			let key = "persistentState_" + variable;
			console.log('persistentState set', variable, '=', value, '(was', key in ls ? ls[key] : 'unset', ')');
			ls[key] = JSON.stringify(value);
		}
	}
}

function playSegment(segmentId, noSeek) {
	if (!segmentId || typeof segmentId === "undefined")
		segmentId = segmentMap.initialSegment;
	var oldSegment = getSegmentId(getCurrentMs());
	console.log('playSegment', oldSegment, '->', segmentId);
	if (!noSeek || oldSegment != segmentId) {
		var ms = getSegmentMs(segmentId);
		seek(ms);
		return true;
	}
	return false;
}

// The number of scenes that the viewer has watched. Breadcrumbs count too,
// because they recorded visits before the player kept this list.
function countScenesSeen() {
	var seen = new Set();
	for (var key of Object.keys(ls)) {
		var match = /^(?:seen|breadcrumb)_(.+)$/.exec(key);
		if (match && match[1] in segmentMap.segments)
			seen.add(match[1]);
		if (match && key[0] == 'b' && ls[key] in segmentMap.segments)
			seen.add(ls[key]);
	}
	return seen.size;
}

function reset() {
	// Keep the viewer preferences (language, subtitles, volume).
	const prefs = Object.entries(ls).filter(([key]) => key.startsWith('pref_'));
	ls.clear();
	for (const [key, value] of prefs)
		ls[key] = value;
	location.hash = '';
	location.reload();
}

var lastHash = '';
function playHash(hash) {
	if (!hash)
		return false;
	if (hash === lastHash)
		return true;

	const [location, momentId] = hash.slice(1).split('/');
	let ms;
	if (location[0] === 't') {
		ms = Math.round(Number(location.slice(1)) * 1000);
	} else if (momentId !== undefined) {
		ms = momentsBySegment[location]?.[momentId]?.startMs;
	} else {
		ms = segmentMap.segments[location]?.startTimeMs;
	}

	if (!Number.isFinite(ms))
		return false;

	lastHash = hash;
	seek(ms);
	return true;
}
