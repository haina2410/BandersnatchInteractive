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
let selectedDigits = [];
function addItem(ul, text, url, item) {
	const li = document.createElement('li');
	if (item.type !== 'scene:cs_bs_phone') {
		const link = document.createElement('a');
		if (item.image) {
			link.className = 'image-choice';
			link.style.backgroundImage = item.image.styles.backgroundImage;
			link.style.backgroundPosition = 'center';
			link.style.backgroundSize = 'contain';
			link.style.backgroundRepeat = 'no-repeat';
			link.setAttribute('aria-label', text);
		} else {
			link.textContent = text;
		}
		link.href = url;
		li.append(link);
	} else {
		selectedDigits = [];
		li.className = 'containerCode';

		const fields = document.createElement('div');
		fields.className = 'input-container';
		for (let index = 0; index < 5; index++) {
			const field = document.createElement('span');
			field.className = 'inputField';
			fields.append(field);
		}

		const keypad = document.createElement('div');
		keypad.className = 'buttonsCode';
		for (let digit = 0; digit < 10; digit++) {
			const button = document.createElement('button');
			button.type = 'button';
			button.textContent = digit;
			button.addEventListener('click', () => selectDigit(digit));
			keypad.append(button);
		}
		li.append(fields, keypad);
	}
	ul.append(li);
	if (li.className === 'containerCode')
		updateInputPlaceholders();
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
	if (selectedDigits.length <= 5) {
		const emptyInputField = getEmptyInputField();
		if (emptyInputField) {
			emptyInputField.innerText  = digit;
			selectedDigits.push(digit);
		}

		if (selectedDigits.length >= 5) {
			var code = selectedDigits.join('');
			if (code == "20541"){
				choice(0);
			} else{
				choice(1);
			}
		}
	}	
	

	updateInputPlaceholders();
}

function updateInputPlaceholders() {
	
	const inputFields = document.querySelectorAll('.inputField');
	for (let i = 0; i < inputFields.length; i++) {
		if (inputFields[i].textContent === '') {
			inputFields[i].textContent = "-";
		}
	}
}

function getEmptyInputField() {
	
	const inputFields = document.querySelectorAll('.inputField');
	for (let i = 0; i < inputFields.length; i++) {
		if (inputFields[i].textContent === '-') {
			return inputFields[i];
		}
	}
	
	return null;
}

function addChoices(r) {
	currentChoiceMoment = r;
	nextChoice = -1;
	var ul = newList("choices");
	document.getElementById("choiceCaption").innerHTML = '';
	if (!r) return;

	nextChoice = r.defaultChoiceIndex;
	if (r.type == "scene:cs_bs_phone"){
		addItem(ul, "", "", r);
	}else{
		let index = 0;
		for (let x of r.choices) {
			var caption = r.defaultChoiceIndex == index ? '[' + x.text + ']' : x.text;
			addItem(ul, caption, 'javascript:choice(' + index + ')', x);
			index++;
		}
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
	const status = document.getElementById('start-status');
	const choiceTranslation = document.getElementById('choice-translation');
	const controls = document.getElementById('video-controls');
	const seekBar = document.getElementById('seek-bar');
	const timeDisplay = document.getElementById('time-display');
	const playButton = document.getElementById('btn-play');
	const subtitles = document.getElementById('subtitles');

	let starting = false;
	let timelineReady = false;
	let dragging = false;
	let hideTimer;

	choiceTranslation.addEventListener('change', function () {
		translated_choices = window[choiceTranslation.value];
		momentsBySegment = switch_choices();
	});

	document.getElementById('reset-history').addEventListener('click', function () {
		if (confirm('Reset all choices, breadcrumbs, and watched scenes?'))
			reset();
	});

	function prepareTimeline() {
		if (!starting || timelineReady || video.readyState < HTMLMediaElement.HAVE_METADATA)
			return;

		timelineReady = true;
		if (!playHash(window.location.hash) && !playHash(ls.place))
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
		startButton.disabled = false;
		startLabel.textContent = 'Retry';
		status.textContent = mediaError && mediaError.code === MediaError.MEDIA_ERR_NETWORK
			? 'The video connection was interrupted. Try again to resume.'
			: 'The video could not be opened. Try again or use Chrome or Edge on a device with HEVC support.';
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
				startButton.disabled = false;
				startLabel.textContent = 'Play film';
				status.textContent = '';
				video.focus();
			}
		} catch (error) {
			if (video.error) {
				showMediaError();
			} else if (starting) {
				starting = false;
				startButton.disabled = false;
				startLabel.textContent = 'Play film';
				status.textContent = 'Playback could not start. Press Play to try again.';
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

	startButton.addEventListener('click', function () {
		starting = true;
		startButton.disabled = true;
		startLabel.textContent = 'Loading…';
		status.textContent = '';
		if (video.error)
			video.load();
		prepareTimeline();
		playVideo();
	});

	if (VIDEO_URL) {
		video.src = VIDEO_URL;
	} else {
		startButton.disabled = true;
		status.textContent = 'Video source pending.';
	}

	function updateControls() {
		const duration = video.duration || 0;
		const currentTime = dragging ? (seekBar.value / seekBar.max) * duration : video.currentTime;
		if (duration > 0 && !dragging)
			seekBar.value = Math.round((currentTime / duration) * seekBar.max);
		timeDisplay.textContent = formatTime(currentTime * 1000) + ' / ' + formatTime(duration * 1000);
		playButton.textContent = video.paused ? '▶' : '❚❚';
		playButton.setAttribute('aria-label', video.paused ? 'Play' : 'Pause');
	}

	playButton.addEventListener('click', togglePlayPause);
	document.getElementById('btn-replay').addEventListener('click', () => seekBy(-10000));
	document.getElementById('btn-forward').addEventListener('click', () => seekBy(10000));
	document.getElementById('btn-fullscreen').addEventListener('click', toggleFullScreen);

	seekBar.addEventListener('input', function () {
		dragging = true;
		updateControls();
	});
	seekBar.addEventListener('change', function () {
		dragging = false;
		if (Number.isFinite(video.duration))
			seek(Math.round((seekBar.value / seekBar.max) * video.duration * 1000));
		updateControls();
	});
	seekBar.addEventListener('pointercancel', function () {
		dragging = false;
		updateControls();
	});
	seekBar.addEventListener('keydown', function (event) {
		if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
			event.preventDefault();
			seekBy(event.key === 'ArrowLeft' ? -5000 : 5000);
		}
	});

	for (const event of ['timeupdate', 'durationchange', 'play', 'pause', 'seeked'])
		video.addEventListener(event, updateControls);

	const tracks = Array.from(video.textTracks);
	for (const [index, track] of tracks.entries())
		subtitles.add(new Option(track.label, String(index)));

	function updateSubtitles() {
		const activeTrack = tracks.findIndex(track => track.mode === 'showing');
		subtitles.value = activeTrack < 0 ? '' : String(activeTrack);
	}

	subtitles.addEventListener('change', function () {
		for (const [index, track] of tracks.entries())
			track.mode = String(index) === subtitles.value ? 'showing' : 'disabled';
	});
	video.textTracks.addEventListener('change', updateSubtitles);
	updateSubtitles();

	function showControls() {
		controls.classList.add('is-visible');
		clearTimeout(hideTimer);
		if (!video.paused)
			hideTimer = setTimeout(() => controls.classList.remove('is-visible'), 3000);
	}

	player.addEventListener('pointermove', showControls);
	video.addEventListener('play', showControls);
	video.addEventListener('pause', showControls);
	video.addEventListener('click', togglePlayPause);
	video.addEventListener('dblclick', toggleFullScreen);

	document.addEventListener('keydown', function (event) {
		if (player.hidden || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
			return;
		if (event.target instanceof Element
			&& (event.target.closest('input, select') || (event.code === 'Space' && event.target.closest('button, a'))))
			return;

		switch (event.code) {
			case 'KeyF': toggleFullScreen(); break;
			case 'KeyR': playSegment(null); break;
			case 'Space':
			case 'KeyK': togglePlayPause(); break;
			case 'KeyJ': seekBy(-10000); break;
			case 'KeyL': seekBy(10000); break;
			case 'ArrowLeft': jumpBack(); break;
			case 'ArrowRight': jumpForward(); break;
			case 'ArrowUp': video.playbackRate *= 2; break;
			case 'ArrowDown': video.playbackRate /= 2; break;
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

// Seek relative to the current position (delta in milliseconds; negative rewinds).
function seekBy(deltaMs) {
	var v = document.getElementById("video");
	var target = v.currentTime * 1000.0 + deltaMs;
	if (target < 0) target = 0;
	var durationMs = (v.duration || 0) * 1000.0;
	if (durationMs && target > durationMs) target = durationMs;
	seek(Math.round(target));
}

// Format milliseconds as m:ss or h:mm:ss.
function formatTime(ms) {
	if (!isFinite(ms) || ms < 0) ms = 0;
	var s = Math.floor(ms / 1000);
	var h = Math.floor(s / 3600);
	s = s % 3600;
	var m = Math.floor(s / 60);
	s = s % 60;
	var ss = (s < 10 ? '0' : '') + s;
	if (h > 0)
		return h + ':' + (m < 10 ? '0' : '') + m + ':' + ss;
	return m + ':' + ss;
}

function choice(choiceIndex) {
	nextChoice = choiceIndex;
	newList("choices");
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

function reset() {
	ls.clear();
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
